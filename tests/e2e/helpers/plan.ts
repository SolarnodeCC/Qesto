import { execSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const D1_DB = process.env.E2E_D1_DATABASE ?? 'qesto_3_db'

function syncSleep(ms: number): void {
  // Cross-platform busy-wait — avoids spawning powershell on Linux CI when D1 is locked.
  const deadline = Date.now() + ms
  while (Date.now() < deadline) {
    // noop
  }
}

/** Bump plan in local D1 for entitlement-gated E2E (ranking, consent, reaction). */
export function setLocalUserPlan(email: string, plan: 'starter' | 'team'): void {
  const safeEmail = email.replace(/'/g, "''")
  const cmd =
    `npx wrangler d1 execute ${D1_DB} --local --command ` +
    `"UPDATE users SET plan='${plan}' WHERE email='${safeEmail}'"`
  let lastErr: unknown
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      execSync(cmd, { cwd: REPO_ROOT, stdio: 'pipe', encoding: 'utf8' })
      return
    } catch (err) {
      lastErr = err
      const msg = err instanceof Error ? err.message : String(err)
      if (!msg.includes('SQLITE_BUSY') && !msg.includes('database is locked')) throw err
      syncSleep(800 * (attempt + 1))
    }
  }
  throw lastErr
}
