#!/usr/bin/env node
// scripts/package-session.mjs
//
// Deterministic session data packager.
//
// Assembles a SessionBundle JSON from D1 for a given session ID — no AI calls,
// no probabilistic logic. Use this to debug insight generation, audit what data
// would be sent to the AI layer, or perform offline analysis.
//
// Usage:
//   node scripts/package-session.mjs --session-id <id> [--env local|remote] [--output <file>]
//
// Requirements:
//   wrangler must be installed and authenticated (run `npx wrangler login` for --env remote).

import { parseArgs } from 'node:util'
import { execSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'

const DB_NAME = 'qesto_2_db'

const { values: args } = parseArgs({
  options: {
    'session-id': { type: 'string' },
    env: { type: 'string', default: 'local' },
    output: { type: 'string' },
    help: { type: 'boolean', default: false },
  },
  strict: false,
})

if (args.help || !args['session-id']) {
  process.stdout.write(`
Usage: node scripts/package-session.mjs --session-id <id> [options]

Assembles a deterministic SessionBundle JSON for a closed session.
No AI calls are made — this is the pure data layer before the handoff boundary.

Options:
  --session-id <id>    Session ULID to package (required)
  --env local|remote   'local' uses local D1 miniflare DB (default); 'remote' queries production
  --output <file>      Write JSON to a file instead of stdout
  --help               Show this message

Examples:
  node scripts/package-session.mjs --session-id 01HXY123456789ABCDEFGHIJK
  node scripts/package-session.mjs --session-id 01HXY... --env remote --output bundle.json
`)
  process.exit(args.help ? 0 : 1)
}

const sessionId = args['session-id']

// Validate ULID format to prevent command injection
if (!/^[0-9A-HJ-NP-TV-Z]{26}$/i.test(sessionId)) {
  process.stderr.write('Error: --session-id must be a 26-character ULID (base32 characters only)\n')
  process.exit(1)
}

const envFlag = args.env === 'remote' ? '--remote' : '--local'

function d1(sql) {
  try {
    const out = execSync(
      `npx wrangler d1 execute ${DB_NAME} ${envFlag} --json --command ${JSON.stringify(sql)}`,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
    )
    const parsed = JSON.parse(out)
    return parsed[0]?.results ?? []
  } catch (err) {
    const msg = err.stderr ?? err.message ?? String(err)
    throw new Error(`D1 query failed:\n${msg}\nSQL: ${sql}`)
  }
}

// ── Fetch session metadata ──────────────────────────────────────────────────
process.stderr.write(`Fetching session ${sessionId} (${args.env})…\n`)
const sessions = d1(
  `SELECT id, title, status, owner_id, closed_at FROM sessions WHERE id = '${sessionId}'`,
)
if (sessions.length === 0) {
  process.stderr.write(`Error: session not found: ${sessionId}\n`)
  process.exit(1)
}
const session = sessions[0]
if (!['closed', 'archived'].includes(session.status)) {
  process.stderr.write(
    `Warning: session status is '${session.status}' (expected 'closed' or 'archived')\n`,
  )
}

// ── Fetch open-ended free-text responses ────────────────────────────────────
const openRows = d1(
  `SELECT v.option_id AS text
     FROM votes v
     JOIN questions q ON q.id = v.question_id
    WHERE v.session_id = '${sessionId}' AND q.kind = 'open'
    ORDER BY v.submitted_at ASC
    LIMIT 500`,
)
const openResponses = openRows.map((r) => r.text).filter(Boolean)

// ── Fetch poll/ranking/consent questions and vote counts ────────────────────
const questions = d1(
  `SELECT id, prompt, kind, options_json
     FROM questions
    WHERE session_id = '${sessionId}'
      AND kind IN ('poll', 'ranking', 'consent')
    ORDER BY position`,
)

const pollBreakdown = []
for (const q of questions) {
  const votes = d1(
    `SELECT option_id, COUNT(*) AS votes
       FROM votes
      WHERE question_id = '${q.id}'
      GROUP BY option_id`,
  )

  let options = []
  try {
    options = JSON.parse(q.options_json ?? '[]')
  } catch {
    options = []
  }

  const optionBreakdowns = options.map((o) => {
    const voteRow = votes.find((v) => v.option_id === o.id)
    return { label: o.label, votes: voteRow?.votes ?? 0 }
  })

  pollBreakdown.push({
    questionId: q.id,
    prompt: q.prompt,
    kind: q.kind,
    options: optionBreakdowns,
  })
}

// ── Assemble the bundle ─────────────────────────────────────────────────────
// similarSessionTitles is intentionally empty: Vectorize requires a live AI
// embedding call, which is out of scope for this deterministic packager.
const bundle = {
  sessionId,
  sessionTitle: session.title,
  closedAt: session.closed_at ?? Date.now(),
  openResponses,
  pollBreakdown,
  similarSessionTitles: [],
}

const json = JSON.stringify(bundle, null, 2)

if (args.output) {
  writeFileSync(args.output, json, 'utf8')
  process.stderr.write(`SessionBundle written to ${args.output}\n`)
} else {
  process.stdout.write(json + '\n')
}
