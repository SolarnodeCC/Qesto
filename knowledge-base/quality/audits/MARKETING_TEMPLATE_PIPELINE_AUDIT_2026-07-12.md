# Marketing Template Pipeline Audit — 2026-07-12

> **Fix status (added 2026-07-14, backlog audit):** all CRITICAL, HIGH, and MEDIUM findings — plus lows MKTP-016/018/019 — were **fixed the same day** in commit `6335af3` ("Fix marketing template pipeline: critical/high/medium audit findings"): real question text in generation (MKTP-001), working email-capture "use this template" flow (MKTP-002), fail-closed anonymisation gates (MKTP-008), draft-first publish with confidence gate (MKTP-009), D1 template registry via migration 0079 (MKTP-010/012), and the rest per the commit message. **Still open: MKTP-017 and MKTP-020 (both LOW)** — tracked in [`BACKLOG_ACTIVE.md`](../../product/backlog/BACKLOG_ACTIVE.md) §Audit triage. Reconciliation: [`BACKLOG_AUDIT_2026-07-14.md`](./BACKLOG_AUDIT_2026-07-14.md).

**Scope:** Growth Engine template lifecycle, end to end: session→template generation (`worker/TemplateGenerationWorkflow.ts`), webhook trigger (`functions/api/routes/webhooks-marketing.ts`, `functions/api/lib/webhooks-marketing.ts`), storage layer (`functions/api/lib/templates-kv.ts`, `functions/api/lib/template-schemas.ts`), public gallery API (`functions/api/routes/templates-marketing.ts` → `/api/gallery`), in-app customer templates (`functions/api/routes/templates.ts` → `/api/templates`), external pages (`src/pages/TemplateGallery.tsx`, `src/pages/TemplateDetail.tsx`), and SEO surface (`functions/seo-meta.ts`, `functions/api/routes/seo-sitemap.ts`).

**Excluded (per audit charter):** styling/layout, interaction specifics, micro-performance tuning, authn/authz, GDPR/DSA compliance.

## Observed pipeline configuration (as-built, not as-assumed)

- **Template format:** JSON blobs in Cloudflare KV (`MARKETING_KV`), Zod-validated on read (`TemplateRecord`). No R2 asset storage exists for templates — no preview images, thumbnails, or file payloads. D1 is only touched to read source-session questions.
- **Versioning strategy:** none for marketing templates (in-place overwrite). In-app customer templates carry a `version` counter but overwrite in place (see MKTP-003).
- **Cache/TTL strategy:** marketing templates stored with **no TTL**; customer templates with **1-year TTL** (see MKTP-004); no listing cache — every gallery request walks `templates:index` and fetches each record (see MKTP-012). Dynamic sitemap has `Cache-Control: max-age=86400`.
- **Public/private:** generated templates are `isPublic: true` immediately at creation, with an IndexNow SEO ping in the same workflow run — there is no draft/review state (see MKTP-009).
- **Trigger:** `session.closed` → HMAC-signed internal webhook → Cloudflare Workflow (`WORKFLOWS` binding, wrangler.toml:158-160).

## Findings (JSON)

```json
{
  "findings": [
    {
      "id": "MKTP-001",
      "severity": "critical",
      "category": "templateCreation",
      "title": "Workflow never fetches question text — every generated template contains AI-invented placeholder questions",
      "description": "Step 1 ('fetch-session-metadata') selects only `id, kind as type` from the questions table — the prompt text is never read. Step 2 then builds the rewrite input as the literal string 'Q{n}: [type] Generic question about topic' for every question. The AI therefore 'rewrites' placeholder text, and the resulting template questions have no relationship to the source session. Every template the pipeline has ever published is content-garbage, yet it is published publicly and pinged to search engines (Step 8).",
      "location": {
        "file": "worker/TemplateGenerationWorkflow.ts",
        "function": "TemplateGenerationWorkflow.run (steps 'fetch-session-metadata', 'rewrite-questions')",
        "lineRange": [122, 156]
      },
      "stage": "creation",
      "currentBehavior": "SELECT id, kind FROM questions; rewrite prompt receives 'Generic question about topic' N times; AI hallucinates N generic questions; template stored and SEO-indexed.",
      "expectedBehavior": "SELECT id, kind, prompt (and options_json) so the anonymisation rewrite operates on real question text; downstream similarity/NER gates then have real content to check.",
      "affectedWorkflow": "creation → modification → storage → retrieval → presentation",
      "dataImpact": "100% of auto-generated templates in MARKETING_KV are semantically void. The gallery, detail pages, sitemap, and IndexNow-submitted URLs all present fabricated content attributed to 'real Qesto sessions' (seo-meta.ts intro copy claims 'Created from real Qesto sessions').",
      "remediationSteps": [
        "1. Extend the Step 1 D1 query to `SELECT id, kind AS type, prompt, options_json FROM questions WHERE session_id = ?1 ORDER BY position`.",
        "2. Feed the real `prompt` values into the rewrite prompt in Step 2 and thread original text through Steps 3-4 (see MKTP-008).",
        "3. Backfill/purge: iterate `templates:index`, mark all existing generated records `isDiscarded: true` (they are unrecoverable), and regenerate from retained public sessions where possible.",
        "4. Add an end-to-end workflow test that asserts the rewrite input contains the source prompt text."
      ],
      "codeExample": {
        "before": "const questionsData = await env.DB.prepare(\n  `SELECT id, kind as type FROM questions WHERE session_id = ?1`,\n).bind(sessionId).all<QuestionMetadata>()\n...\nconst questionTexts = metadata.map((q, i) => `Q${i + 1}: [${q.type}] Generic question about topic`).join('\\n')",
        "after": "const questionsData = await env.DB.prepare(\n  `SELECT id, kind AS type, prompt, options_json FROM questions WHERE session_id = ?1 ORDER BY position`,\n).bind(sessionId).all<QuestionMetadata>()\n...\nconst questionTexts = metadata.map((q, i) => `Q${i + 1}: [${q.type}] ${q.prompt}`).join('\\n')"
      }
    },
    {
      "id": "MKTP-002",
      "severity": "critical",
      "category": "dataFlow",
      "title": "'Use this template' journey dead-ends: session written to a key nothing reads, magic link token never consumable, /s/:id route does not exist",
      "description": "POST /api/gallery/:id/use writes the draft session as a JSON blob to SESSIONS_KV under `session:{id}` — no API route reads that key (session reads go through D1 `sessions`). It writes `magic_link:{token}` to USERS_KV — the auth magic-link consumer reads hashed tokens from the D1 `magic_links` table, never that KV key. And the returned link points to `${PAGES_URL}/s/{sessionId}?token=...` — the SPA router (src/App.tsx) has no `/s/:id` route, so the user lands on the 404 page. The terminal step of the entire marketing funnel is broken; meanwhile usageCount is still incremented, inflating the social-proof metric shown on cards.",
      "location": {
        "file": "functions/api/routes/templates-marketing.ts",
        "function": "POST /api/gallery/:id/use",
        "lineRange": [87, 143]
      },
      "stage": "presentation",
      "currentBehavior": "Modal shows a magic link; opening it renders the NotFound page; the created 'session' expires unread from KV after 1 hour; usageCount++ anyway.",
      "expectedBehavior": "The use action creates a real D1 draft session (or a claimable KV draft with a consuming route), the link resolves to a working claim/present flow, and usageCount increments only on successful creation.",
      "affectedWorkflow": "retrieval → presentation → conversion",
      "dataImpact": "Orphan KV writes in SESSIONS_KV and USERS_KV on every click; usageCount (and therefore sitemap priority/changefreq, card badges) is inflated by conversions that never happened.",
      "remediationSteps": [
        "1. Decide the claim model: simplest is to INSERT the draft session + questions into D1 with `owner_id = NULL, is_public = 1` and mint a one-time claim token in D1 (mirroring the existing magic_links pattern).",
        "2. Add the consuming route (`GET /s/:id` edge redirect or SPA route) that validates the token and lands on `/sessions/:id` (or a guest-host Launchpad).",
        "3. Move `incrementUsageCount` after successful session creation and link validation.",
        "4. Add an integration test that walks template → use → open-link → session visible."
      ],
      "codeExample": {
        "before": "await sessionsKv.put(`session:${sessionId}`, JSON.stringify(session), { expirationTtl: MARKETING_MAGIC_LINK_TTL_SECONDS })\nconst magicToken = nanoid()\nawait usersKv.put(`magic_link:${magicToken}`, sessionId, { expirationTtl: MARKETING_MAGIC_LINK_TTL_SECONDS })\nconst magicLink = `${c.env.PAGES_URL}/s/${sessionId}?token=${magicToken}`",
        "after": "// Persist where the app actually reads sessions:\nawait c.env.DB.batch([\n  c.env.DB.prepare('INSERT INTO sessions (id, owner_id, code, title, status, anonymity, created_at, is_public) VALUES (?1, NULL, ?2, ?3, \\'draft\\', \\'full\\', ?4, 1)').bind(sessionId, code, title, now),\n  ...questionInserts,\n])\nconst claimToken = generateMagicLinkToken()\nawait c.env.DB.prepare('INSERT INTO magic_links (token_hash, email, created_at, expires_at) VALUES (?1, ?2, ?3, ?4)')\n  .bind(await hashMagicLinkToken(claimToken), `guest-session:${sessionId}`, now, now + 3600_000).run()\nconst magicLink = `${c.env.PAGES_URL}/sessions/${sessionId}?claim=${claimToken}`"
      }
    },
    {
      "id": "MKTP-008",
      "severity": "high",
      "category": "templateCreation",
      "title": "Anonymisation gates are decorative: similarity check compares against a hardcoded string and both gates fail open",
      "description": "Step 3's similarity prompt embeds a hardcoded 'Original context: \"How did your team handle [specific scenario]?\"' instead of the actual source question, so the score is meaningless. On JSON parse failure the score defaults to 0 (= accept). Step 4's NER scan keeps the question when the AI response fails to parse (fail-open). Today MKTP-001 means no customer text reaches these gates; the moment MKTP-001 is fixed, customer-identifying content flows through gates that cannot reject it deterministically.",
      "location": {
        "file": "worker/TemplateGenerationWorkflow.ts",
        "function": "steps 'similarity-check' and 'proper-noun-scan'",
        "lineRange": [206, 287]
      },
      "stage": "creation",
      "currentBehavior": "Similarity is scored against a fixed example sentence; parse errors on either gate admit the question; whole-step errors return the unfiltered input array.",
      "expectedBehavior": "Gates compare rewritten text against the real original, and any gate failure (parse error, AI error) discards the question (fail-closed) — this is a privacy control, not a quality nicety.",
      "affectedWorkflow": "creation → storage → presentation",
      "dataImpact": "Post-MKTP-001-fix: PII / company-identifying question text from customer sessions can be published verbatim to public, search-indexed pages.",
      "remediationSteps": [
        "1. Thread the original prompt (from the fixed Step 1 query) into the similarity prompt: `Original: \"${q.originalPrompt}\"`.",
        "2. Invert the parse-failure defaults: similarity parse failure → score 100 (reject/retry); NER parse failure → discard.",
        "3. Compute and store `originalHash` (currently always '') so similarity decisions are auditable.",
        "4. Per Hard Rule 6 (REV-10), this is AI safety logic: add golden fixtures in tests/eval/fixtures/ and gate on `npm run test:eval`."
      ],
      "codeExample": {
        "before": "Original context: \"How did your team handle [specific scenario]?\"\n...\n} catch {\n  score = 0 // Default to accept if parse fails\n}",
        "after": "Original context: \"${q.originalPrompt}\"\n...\n} catch {\n  score = 100 // fail-closed: unparseable verdict = do not publish\n}"
      }
    },
    {
      "id": "MKTP-009",
      "severity": "high",
      "category": "workflowModification",
      "title": "No draft/review state: AI-generated templates go straight to public + IndexNow, one per closed session, with no dedup",
      "description": "Step 7 stores every template with `isPublic: true` and Step 8 immediately pings IndexNow. There is no draft → review → published state machine, no human/QA gate, and no similarity check against *existing templates*, so every closed public session mints another near-identical public, search-indexed page. Combined with the confidence<70 fallback that still publishes (as industry 'general'), low-confidence junk is published rather than parked.",
      "location": {
        "file": "worker/TemplateGenerationWorkflow.ts",
        "function": "steps 'store-template' and 'index-now-ping'",
        "lineRange": [391, 496]
      },
      "stage": "creation",
      "currentBehavior": "Create → public → SEO ping in one unreviewed run; gallery grows unboundedly with duplicates.",
      "expectedBehavior": "Templates land as `isPublic: false` (draft), pass a dedup check against existing templates, and are published (with the IndexNow ping) by an explicit publish action or a quality threshold.",
      "affectedWorkflow": "creation → modification → presentation",
      "dataImpact": "Unbounded index growth (amplifies MKTP-012), duplicate thin-content pages in search engines, no rollback point before public exposure.",
      "remediationSteps": [
        "1. Store with `isPublic: false`; move the IndexNow ping into a new `POST /api/gallery/:id/publish` (or admin action) that flips the flag.",
        "2. Add a dedup step: compare classified topic+theme+question set against existing templates (Vectorize or simple hash of normalized question texts) and discard/merge near-duplicates.",
        "3. Park `confidence < 70` results as drafts for review instead of publishing as 'general'."
      ],
      "codeExample": {
        "before": "isPublic: true,\nisDiscarded: false,\n...\nawait steps.do('index-now-ping', async () => { ... })",
        "after": "isPublic: false, // draft until reviewed/published\nisDiscarded: false,\n// IndexNow moves to the publish endpoint:\n// POST /api/gallery/:id/publish → set isPublic=true → pingIndexNow(templateId)"
      }
    },
    {
      "id": "MKTP-005",
      "severity": "high",
      "category": "validation",
      "title": "Workflow stores unvalidated AI output; invalid records become invisible-but-indexed ghosts",
      "description": "The workflow defines its own local `TemplateRecord` interface instead of importing the shared Zod schema, and merges raw parsed AI JSON over defaults (`{ ...classification, ...parsed }`) without validating enums. If the model returns e.g. theme 'Retrospective' (not in the Theme enum) the record is stored as-is. `getTemplate()` safeParses on read and returns null for such records — so the template silently disappears from the gallery, detail page, and sitemap, while its id stays in `templates:index` forever and its URL was already pinged to IndexNow (search engines index a 404).",
      "location": {
        "file": "worker/TemplateGenerationWorkflow.ts",
        "function": "steps 'classify-and-generate' and 'store-template'",
        "lineRange": [316, 454]
      },
      "stage": "creation",
      "currentBehavior": "Invalid enum/type from the AI → stored → unreadable everywhere → dead index entry + indexed dead URL.",
      "expectedBehavior": "Record is validated with the shared `TemplateRecord` Zod schema (and `ClassificationOutput` for the AI response) before storage; invalid classifications fall back to safe defaults or the run is discarded with a logged reason.",
      "affectedWorkflow": "creation → storage → retrieval",
      "dataImpact": "Silent template loss (stored but unreachable), permanent index pollution, SEO 404s.",
      "remediationSteps": [
        "1. Delete the local interface; import `TemplateRecord` and `ClassificationOutput` from functions/api/lib/template-schemas.ts.",
        "2. Validate the AI response with `ClassificationOutput.safeParse` — on failure use the existing defaults object wholesale rather than spreading unvalidated fields.",
        "3. Run `TemplateRecord.parse(record)` before the KV put; throw (workflow retry) on failure.",
        "4. Add an index-repair job: drop ids from `templates:index` whose records fail validation or are missing."
      ],
      "codeExample": {
        "before": "const parsed = JSON.parse(response)\nclassification = { ...classification, ...parsed }\n...\nawait env.MARKETING_KV.put(`template:${id}`, JSON.stringify(record))",
        "after": "const result = ClassificationOutput.safeParse(JSON.parse(response))\nif (result.success) classification = result.data\n// else keep defaults wholesale\n...\nconst validated = TemplateRecordSchema.parse(record) // throws → workflow retries/discards\nawait env.MARKETING_KV.put(`template:${id}`, JSON.stringify(validated))"
      }
    },
    {
      "id": "MKTP-007",
      "severity": "high",
      "category": "templateCreation",
      "title": "Multiple-choice options are never captured; /use fabricates options by splitting the question text on '|'",
      "description": "`TemplateQuestion` has no options field, and the workflow never reads `options_json` from D1, so answer options are lost at creation for every multiple_choice question. The /use endpoint then invents options by splitting the *question text* on '|' — for any normal question text this yields a single option equal to the question itself, producing a broken single-option multi_select in the created session.",
      "location": {
        "file": "functions/api/routes/templates-marketing.ts",
        "function": "POST /api/gallery/:id/use (question mapping); schema: functions/api/lib/template-schemas.ts:31-37",
        "lineRange": [118, 128]
      },
      "stage": "creation",
      "currentBehavior": "MC options dropped in the pipeline; sessions created from templates get one nonsense option per MC question.",
      "expectedBehavior": "TemplateQuestion carries localized options (anonymised alongside the prompt); /use maps them 1:1 into session question options.",
      "affectedWorkflow": "creation → storage → presentation → conversion",
      "dataImpact": "Structural data loss for every multiple_choice question in every generated template; sessions created from templates are unusable for MC questions.",
      "remediationSteps": [
        "1. Add `options: z.array(z.object({ id: z.string(), label: z.record(Lang, z.string()) })).default([])` to TemplateQuestion.",
        "2. In the workflow, read `options_json` (per MKTP-001 fix) and pass options through the rewrite/NER gates like prompts.",
        "3. In /use, map `q.options` directly instead of splitting text; delete the '|' hack.",
        "4. Migrate existing records (they have no options; regeneration per MKTP-001 covers this)."
      ],
      "codeExample": {
        "before": "options: q.type === 'multiple_choice'\n  ? (q.text[userLang] || q.text.en).split('|').map((label) => ({ id: nanoid(), label }))\n  : [],",
        "after": "options: (q.options ?? []).map((opt) => ({ id: nanoid(), label: opt.label[userLang] || opt.label.en })),"
      }
    },
    {
      "id": "MKTP-003",
      "severity": "high",
      "category": "workflowModification",
      "title": "Customer-template 'versioning' overwrites in place: parentId points to itself, prior version unrecoverable",
      "description": "PATCH /api/templates/mine/:id bumps `version` and sets `parentId: existing.id` — i.e. its own id — then writes back to the same KV key. The previous content is destroyed; there is no version chain to walk and no rollback. The s6b 'versioning' fields are cosmetic.",
      "location": {
        "file": "functions/api/routes/templates.ts",
        "function": "PATCH /mine/:id",
        "lineRange": [546, 576]
      },
      "stage": "modification",
      "currentBehavior": "Every edit destroys the prior version; parentId is a self-reference; rollback impossible.",
      "expectedBehavior": "Each update snapshots the prior record (e.g. `customer_template_v:{userId}:{templateId}:{version}`) before overwriting, and parentId references the snapshot; a revert endpoint restores it.",
      "affectedWorkflow": "modification → storage",
      "dataImpact": "Irreversible loss of user-authored template content on every edit.",
      "remediationSteps": [
        "1. Before the overwrite, `writeKvJson(kv, `customer_template_v:${userId}:${templateId}:${existing.version ?? 1}`, existing)`.",
        "2. Set `parentId` to that snapshot key/version, not `existing.id`.",
        "3. Add `POST /mine/:id/revert` that restores the latest snapshot.",
        "4. Add optimistic concurrency: require the client to send the version it edited and 409 on mismatch (concurrent edits currently last-write-wins silently)."
      ],
      "codeExample": {
        "before": "const updated: CustomerTemplate = {\n  ...existing,\n  ...,\n  version: (existing.version ?? 1) + 1,\n  parentId: existing.id, // self-reference; old content is gone\n}\nawait writeKvJson(c.env.TEMPLATES_KV, key, updated, ...)",
        "after": "const prevVersion = existing.version ?? 1\nawait writeKvJson(c.env.TEMPLATES_KV, `customer_template_v:${userId}:${templateId}:${prevVersion}`, existing, { expirationTtl: TEMPLATE_TTL_SECONDS })\nconst updated: CustomerTemplate = {\n  ...existing, ...,\n  version: prevVersion + 1,\n  parentId: `${templateId}@v${prevVersion}`,\n}\nawait writeKvJson(c.env.TEMPLATES_KV, key, updated, ...)"
      }
    },
    {
      "id": "MKTP-004",
      "severity": "high",
      "category": "dataFlow",
      "title": "Customer templates and their list index expire after 1 year (silent user-content loss)",
      "description": "Every customer template write — and the `customer_templates_list:{userId}` index — uses `expirationTtl: TEMPLATE_TTL_SECONDS` (1 year). A template a user saved and relies on simply vanishes 12 months after its last write; if the list key expires first, still-live template records become permanently orphaned. Saved user content is not a cache and must not carry a TTL; soft-delete (the archived-flag pattern) is entirely absent.",
      "location": {
        "file": "functions/api/routes/templates.ts",
        "function": "POST /mine, PATCH /mine/:id, DELETE /mine/:id (all writes); constant: functions/api/lib/constants.ts:36",
        "lineRange": [524, 532]
      },
      "stage": "storage",
      "currentBehavior": "Templates and the per-user index silently expire; deletes are hard deletes.",
      "expectedBehavior": "User templates persist indefinitely; deletion sets an archived flag (or moves to an archive key) preserving history.",
      "affectedWorkflow": "storage → retrieval",
      "dataImpact": "Guaranteed eventual loss of all untouched customer templates; orphaned records when the list key expires before member keys.",
      "remediationSteps": [
        "1. Drop `expirationTtl` from customer_template and customer_templates_list writes (KV keys without TTL persist).",
        "2. Convert DELETE to a soft delete: set `archivedAt` on the record and filter it out of GET /mine.",
        "3. One-time repair: rewrite all existing customer template keys without TTL (a metadata-preserving put)."
      ],
      "codeExample": {
        "before": "await writeKvJson(c.env.TEMPLATES_KV, key, template, { expirationTtl: TEMPLATE_TTL_SECONDS })\nawait writeKvJson(c.env.TEMPLATES_KV, listKey, list, { expirationTtl: TEMPLATE_TTL_SECONDS })",
        "after": "await writeKvJson(c.env.TEMPLATES_KV, key, template) // user content: no TTL\nawait writeKvJson(c.env.TEMPLATES_KV, listKey, list)  // index: no TTL"
      }
    },
    {
      "id": "MKTP-006",
      "severity": "high",
      "category": "externalPresentation",
      "title": "Spanish locale breaks the public gallery: app supports 'es' but the pipeline Lang enum does not",
      "description": "The app supports 5 languages (SUPPORTED_LANGUAGES = en/nl/es/de/fr, src/i18n/index.ts:36) but `Lang` in template-schemas.ts is only nl/en/de/fr. TemplateGallery.tsx sends `lang=<html lang>` unconditionally; for a Spanish-locale visitor the query is `lang=es`, `TemplatesListQuerySchema` rejects it, and the API returns 400 'Invalid query params' — the gallery renders the error state with zero templates for every Spanish user.",
      "location": {
        "file": "src/pages/TemplateGallery.tsx",
        "function": "TemplateGallery useEffect (lang param); schema: functions/api/lib/template-schemas.ts:3",
        "lineRange": [134, 156]
      },
      "stage": "retrieval",
      "currentBehavior": "lang=es → 400 → empty gallery + error message for es-locale visitors.",
      "expectedBehavior": "Unknown/unsupported langs degrade gracefully (fallback to en content), never a request failure.",
      "affectedWorkflow": "retrieval → presentation",
      "dataImpact": "Whole discovery surface unavailable for one of five supported locales.",
      "remediationSteps": [
        "1. Server: make the lang filter forgiving — `lang: z.string().optional()` and only apply the filter when `Lang.safeParse` succeeds (or add 'es' to the enum and content model).",
        "2. Client: clamp the sent lang to the pipeline's supported set (`['nl','en','de','fr'].includes(l) ? l : 'en'`).",
        "3. Add a unit test for GET /api/gallery?lang=es returning 200."
      ],
      "codeExample": {
        "before": "const lang: Lang = (document.documentElement.lang?.slice(0, 2) as Lang) || 'en'\n...\nparams.set('lang', lang)",
        "after": "const raw = document.documentElement.lang?.slice(0, 2)\nconst lang: Lang = (['nl','en','de','fr'] as const).includes(raw as Lang) ? (raw as Lang) : 'en'\nparams.set('lang', lang)"
      }
    },
    {
      "id": "MKTP-010",
      "severity": "medium",
      "category": "dataFlow",
      "title": "All index and counter updates are non-atomic read-modify-write on KV (lost updates under concurrency)",
      "description": "`addToIndex` (both copies), `incrementUsageCount`, and the customer `customer_templates_list` updates all do get→mutate→put on shared keys. KV is last-write-wins with no compare-and-swap: two concurrent workflow completions can drop an id from `templates:index` (template stored but unreachable); concurrent /use calls lose usage counts; `incrementUsageCount` rewrites the entire template record and can clobber a concurrent metadata update. The comment 'thread-safe list operations' in the workflow is wrong.",
      "location": {
        "file": "functions/api/lib/templates-kv.ts",
        "function": "addToIndex, incrementUsageCount (also worker/TemplateGenerationWorkflow.ts:81-88; functions/api/routes/templates.ts:528-532,595-602)",
        "lineRange": [99, 124]
      },
      "stage": "storage",
      "currentBehavior": "Concurrent writers silently drop index entries and usage counts.",
      "expectedBehavior": "Single-writer serialization (Durable Object or D1 table with atomic UPDATE ... SET usage_count = usage_count + 1) for indices and counters.",
      "affectedWorkflow": "creation → storage → retrieval",
      "dataImpact": "Orphaned templates (stored, sitemap-absent, gallery-absent), undercounted usage, occasional clobbered records.",
      "remediationSteps": [
        "1. Move the template registry to D1 (a `marketing_templates` table with id/industry/theme/lang columns and usage_count) — atomic increments and real WHERE-filtered queries; keep the KV blob for the full record.",
        "2. Alternatively route index/counter mutations through a small Durable Object to serialize writes.",
        "3. Store usageCount separately from the content record so counting never rewrites content."
      ],
      "codeExample": {
        "before": "template.usageCount = (template.usageCount || 0) + 1\nawait kv.put(templateKey(templateId), JSON.stringify(template))",
        "after": "await db.prepare('UPDATE marketing_templates SET usage_count = usage_count + 1 WHERE id = ?1').bind(templateId).run()"
      }
    },
    {
      "id": "MKTP-011",
      "severity": "medium",
      "category": "dataFlow",
      "title": "storeTemplate fires language-index writes unawaited, and all secondary indices are write-only dead weight",
      "description": "`storeTemplate` updates language indices inside `(['nl','en','de','fr']).forEach(async ...)` — the async callbacks are never awaited, so in a Workers request context the writes can be cancelled when the handler returns. Separately, the by-industry/by-theme/by-lang/by-team/by-org index keys are written by both store paths but read by nothing: `listTemplates` always loads `templates:index` and filters in memory. The pipeline pays the write cost and the race risk for indices that serve no read.",
      "location": {
        "file": "functions/api/lib/templates-kv.ts",
        "function": "storeTemplate, listTemplates",
        "lineRange": [43, 97]
      },
      "stage": "storage",
      "currentBehavior": "Unawaited index writes (nondeterministic persistence) maintaining indices no query uses.",
      "expectedBehavior": "Either the filtered list endpoints read the per-facet indices, or the indices are deleted; all writes awaited.",
      "affectedWorkflow": "storage → retrieval",
      "dataImpact": "Inconsistent index state; wasted KV writes; misleading architecture (readers assume facet indices are authoritative).",
      "remediationSteps": [
        "1. Replace forEach(async) with `await Promise.all(langs.map(...))`.",
        "2. Pick one: (a) make listTemplates read byIndustryKey/byThemeKey when a single filter is set, or (b) remove the facet indices entirely (preferred if migrating to D1 per MKTP-010)."
      ],
      "codeExample": {
        "before": ";(['nl', 'en', 'de', 'fr'] as const).forEach(async (lang) => {\n  if (template.title[lang]) {\n    await addToIndex(byLangKey(lang), id, kv)\n  }\n})",
        "after": "await Promise.all((['nl', 'en', 'de', 'fr'] as const)\n  .filter((lang) => template.title[lang])\n  .map((lang) => addToIndex(byLangKey(lang), id, kv)))"
      }
    },
    {
      "id": "MKTP-012",
      "severity": "medium",
      "category": "dataFlow",
      "title": "Every gallery/sitemap request does N+1 KV reads over the full, never-pruned index",
      "description": "`listTemplates` fetches `templates:index` then sequentially `get`s every template — for every gallery pageview, every filter change, and every sitemap generation. Discarded and unparseable templates are never removed from the index, so N only grows (one template per closed public session, per MKTP-009). There is no cached listing document and no Cache-Control on /api/gallery. This is an architecture/data-flow defect (unbounded fan-out on the hot path), not a tuning concern.",
      "location": {
        "file": "functions/api/lib/templates-kv.ts",
        "function": "listTemplates (consumers: templates-marketing.ts:60, seo-sitemap.ts:43)",
        "lineRange": [43, 71]
      },
      "stage": "retrieval",
      "currentBehavior": "O(N) sequential KV gets per request; index entries for discarded/invalid templates fetched forever.",
      "expectedBehavior": "Listing served from a precomputed summary document (rebuilt on store/publish/discard) or a D1 query; index pruned when templates are discarded.",
      "affectedWorkflow": "storage → retrieval → presentation",
      "dataImpact": "Gallery latency grows linearly with lifetime session count; KV read amplification; stale/dead ids never reclaimed.",
      "remediationSteps": [
        "1. Maintain a `templates:listing` summary blob (id, title, purpose, industry, theme, counts) rewritten by storeTemplate/publish/discard; serve GET /api/gallery from it with `Cache-Control: public, max-age=300`.",
        "2. Remove ids from `templates:index` (and the listing) when isDiscarded is set.",
        "3. Longer term, fold into the D1 registry from MKTP-010 and query with WHERE/LIMIT/OFFSET."
      ],
      "codeExample": {
        "before": "for (const id of allIds) {\n  const template = await getTemplate(kv, id) // sequential N+1 per request\n  ...\n}",
        "after": "const listing = await kv.get('templates:listing', 'json') // one read\nconst rows = TemplateListingSchema.parse(listing ?? [])\nreturn rows.filter(matchesFilters)"
      }
    },
    {
      "id": "MKTP-013",
      "severity": "medium",
      "category": "externalPresentation",
      "title": "NL/DE/FR template content is English mislabeled as localized",
      "description": "The workflow copies the English rewrite into text.nl/de/fr (or falls back to the literal words 'Vraag'/'Frage'/'Question'), copies bestUsedFor and whatYoullLearn arrays unchanged into all four languages, and the similarity-retry loop updates only text.en (leaving other langs on the pre-retry text). Only purpose_* is genuinely translated. Detail pages then declare `inLanguage: lang` in JSON-LD for content that is actually English.",
      "location": {
        "file": "worker/TemplateGenerationWorkflow.ts",
        "function": "steps 'rewrite-questions' (171-183), 'similarity-check' (241-245), 'store-template' (414-426)",
        "lineRange": [171, 426]
      },
      "stage": "presentation",
      "currentBehavior": "Non-English gallery/detail pages show English questions and tags labeled as localized; per-lang texts can diverge from the approved (post-retry) English.",
      "expectedBehavior": "Either generate real translations for question text and tag arrays, or store en-only and let the frontend fall back explicitly (no fake lang keys, no inLanguage claim).",
      "affectedWorkflow": "creation → presentation",
      "dataImpact": "Misleading multilingual metadata (SEO + UX); post-retry text divergence between language variants of the same question.",
      "remediationSteps": [
        "1. In the retry loop, propagate the accepted rewrite to all language keys (or regenerate translations from it).",
        "2. Add a translate step for question text / bestUsedFor / whatYoullLearn, or drop the non-en keys and rely on the existing `|| title.en` fallbacks.",
        "3. Only emit `inLanguage` in JSON-LD when the displayed strings are genuinely in that language."
      ],
      "codeExample": {
        "before": "valid.push({ ...q, text: { ...q.text, en: currentText } }) // nl/de/fr keep stale text",
        "after": "valid.push({ ...q, text: { en: currentText, nl: currentText, de: currentText, fr: currentText } })\n// followed by a real translation step, or store en-only"
      }
    },
    {
      "id": "MKTP-014",
      "severity": "medium",
      "category": "supportingPages",
      "title": "All template detail pages serve identical generic meta to crawlers (title/description/OG duplicated at scale)",
      "description": "resolveRouteSeo gives every /templates/:id the gallery's static title/description (only the canonical is self-referencing); the real title, description, OG image, and JSON-LD are injected client-side by PageSeo after JS runs. For non-rendering crawlers and social scrapers, every template page is a duplicate of the gallery — undermining exactly the pages the pipeline pings IndexNow about.",
      "location": {
        "file": "functions/seo-meta.ts",
        "function": "resolveRouteSeo",
        "lineRange": [262, 273]
      },
      "stage": "presentation",
      "currentBehavior": "Edge HTML for every detail page: 'Qesto — Session Template Gallery' + gallery description; unique meta only post-hydration.",
      "expectedBehavior": "The edge injector fetches the template record (title/purpose per lang) from MARKETING_KV and writes per-page title/description/OG/JSON-LD into the shell.",
      "affectedWorkflow": "retrieval → presentation",
      "dataImpact": "Duplicate-content signals across every template URL; social shares show generic cards.",
      "remediationSteps": [
        "1. In the /templates/<id> branch, `await getTemplate(env.MARKETING_KV, id)` and build title/description from the record (fallback to gallery defaults on miss).",
        "2. Emit the CreativeWork JSON-LD server-side in the same injector.",
        "3. Return 404/410-style meta (noindex) for discarded/missing ids so dead URLs de-index."
      ],
      "codeExample": {
        "before": "if (segments.length === 2 && segments[0] === 'templates') {\n  const gallery = ROUTE_SEO['/templates']\n  return { ...gallery, canonicalPath: normalized }\n}",
        "after": "if (segments.length === 2 && segments[0] === 'templates') {\n  const tmpl = await getTemplate(env.MARKETING_KV, segments[1])\n  if (!tmpl || tmpl.isDiscarded) return { ...ROUTE_SEO['/templates'], canonicalPath: normalized, noindex: true }\n  return {\n    title: `${tmpl.title.en} — Qesto Template`,\n    description: tmpl.purpose.en,\n    canonicalPath: normalized,\n    h1: tmpl.title.en,\n    intro: tmpl.purpose.en,\n  }\n}"
      }
    },
    {
      "id": "MKTP-015",
      "severity": "medium",
      "category": "discovery",
      "title": "Gallery hard-caps at 60 templates with no pagination UI while the sitemap lists everything",
      "description": "TemplateGallery requests `limit=60` and renders one page; the API caps limit at 100 and supports offset, but the UI never paginates. Since the pipeline mints a template per closed public session (MKTP-009), templates beyond the newest 60 become unreachable through navigation — yet they remain in sitemap-templates.xml and are IndexNow-pinged, creating indexed pages with no internal links (orphan pages).",
      "location": {
        "file": "src/pages/TemplateGallery.tsx",
        "function": "TemplateGallery useEffect",
        "lineRange": [141, 156]
      },
      "stage": "retrieval",
      "currentBehavior": "Newest 60 visible; the rest exist only via direct URL/sitemap.",
      "expectedBehavior": "Cursor or offset pagination (e.g. 12/page with 'Load more'), so every published template is reachable by browsing.",
      "affectedWorkflow": "retrieval → presentation",
      "dataImpact": "Discovery ceiling; orphaned indexed pages; template counts shown ('templateCount') reflect the page, not the catalog (pagination.total is returned but unused).",
      "remediationSteps": [
        "1. Use the returned `pagination.total` for the count label and render a Load-more/paged control driving `offset`.",
        "2. Keep page size modest (12-24) to bound the N+1 cost until MKTP-012 lands."
      ],
      "codeExample": {
        "before": "params.set('limit', '60')\n...\nif (result.ok) setTemplates(result.data)",
        "after": "params.set('limit', '24'); params.set('offset', String(page * 24))\n...\nif (result.ok) { setTemplates((prev) => page ? [...prev, ...result.data] : result.data); setTotal(result.pagination.total) }"
      }
    },
    {
      "id": "MKTP-019",
      "severity": "low",
      "category": "validation",
      "title": "PATCH /api/templates/mine/:id accepts an unvalidated body (no schema, no length limits)",
      "description": "Unlike POST /mine (which uses validateBody + CreateTemplateSchema), the PATCH handler reads raw JSON and applies only typeof checks — name/description have no length limits (a multi-megabyte string is stored verbatim into KV), and ownedByTeamId is accepted without checking membership consistency with scope.",
      "location": {
        "file": "functions/api/routes/templates.ts",
        "function": "PATCH /mine/:id",
        "lineRange": [550, 573]
      },
      "stage": "modification",
      "currentBehavior": "Arbitrary-size strings and inconsistent scope/team combinations persist.",
      "expectedBehavior": "A Zod UpdateTemplateSchema mirroring CreateTemplateSchema limits (name/description max lengths, scope/ownedByTeamId cross-field rule).",
      "affectedWorkflow": "modification → storage",
      "dataImpact": "Oversized/inconsistent records in TEMPLATES_KV; downstream renderers assume bounded fields.",
      "remediationSteps": [
        "1. Define UpdateTemplateSchema in domain-schemas.ts (partial of create fields + scope/ownedByTeamId with a refine).",
        "2. Swap the manual body handling for `validateBody(c, UpdateTemplateSchema)`."
      ],
      "codeExample": {
        "before": "const body = await c.req.json().catch(() => null) as Record<string, unknown> | null\n...(typeof body.name === 'string' ? { name: body.name.trim() } : {})",
        "after": "const validated = await validateBody(c, UpdateTemplateSchema)\nif ('error' in validated) return validated.error\nconst { name, description, scope, ownedByTeamId } = validated.data"
      }
    },
    {
      "id": "MKTP-016",
      "severity": "low",
      "category": "externalPresentation",
      "title": "usageCount increments rewrite updatedAt, churning sitemap lastmod and JSON-LD dateModified without content change",
      "description": "incrementUsageCount bumps `updatedAt` on every /use click; the sitemap emits that as <lastmod> and the detail page as dateModified. Crawlers see constant fake modifications, which erodes lastmod trust for the whole sitemap.",
      "location": {
        "file": "functions/api/lib/templates-kv.ts",
        "function": "incrementUsageCount (consumers: seo-sitemap.ts:53, TemplateDetail.tsx:199)",
        "lineRange": [99, 110]
      },
      "stage": "presentation",
      "currentBehavior": "lastmod/dateModified change on every use with no content change.",
      "expectedBehavior": "updatedAt reflects content edits only; usage counting is metadata-side (separate key or D1 counter per MKTP-010).",
      "affectedWorkflow": "retrieval → presentation",
      "dataImpact": "Misleading freshness signals; no data loss.",
      "remediationSteps": [
        "1. Stop touching updatedAt in incrementUsageCount (or store the counter outside the record).",
        "2. Also note sitemap <lastmod> emits the raw ISO string — fine — but only once updatedAt is meaningful."
      ],
      "codeExample": {
        "before": "template.usageCount = (template.usageCount || 0) + 1\ntemplate.updatedAt = new Date().toISOString()",
        "after": "template.usageCount = (template.usageCount || 0) + 1\n// updatedAt unchanged: usage is not a content modification"
      }
    },
    {
      "id": "MKTP-017",
      "severity": "low",
      "category": "supportingPages",
      "title": "Route documentation contradicts the mount point, and generated template names are near-duplicates",
      "description": "templates-marketing.ts's header and JSDoc all claim `/api/templates` while the router mounts at `/api/gallery` (line 168) — and a second, unrelated router (templates.ts) actually owns `/api/templates`. Additionally, generated titles are the formulaic 'Template: {topic}' in every language; with one template per closed session (MKTP-009) the gallery fills with visually identical names — the classic 'Template 1' anti-pattern.",
      "location": {
        "file": "functions/api/routes/templates-marketing.ts",
        "function": "module docs + mount; naming: worker/TemplateGenerationWorkflow.ts:402-407",
        "lineRange": [1, 168]
      },
      "stage": "modification",
      "currentBehavior": "Misleading docs for future maintainers; undifferentiated template names in listing and search results.",
      "expectedBehavior": "Docs match mounts; titles generated from theme+topic+audience (e.g. 'Sprint Health Retrospective for Agile Teams').",
      "affectedWorkflow": "creation → presentation",
      "dataImpact": "None directly; maintainability and discovery quality.",
      "remediationSteps": [
        "1. Fix the JSDoc paths to /api/gallery (or rename the mount to /api/gallery/templates deliberately).",
        "2. Ask the classify step for a distinctive human title per language instead of prefixing 'Template:'."
      ],
      "codeExample": {
        "before": "/** GET /api/templates — list all public templates with optional filters. */\n...\nparent.route('/api/gallery', app)",
        "after": "/** GET /api/gallery — list all public marketing templates with optional filters. */\n...\nparent.route('/api/gallery', app)"
      }
    },
    {
      "id": "MKTP-018",
      "severity": "low",
      "category": "templateCreation",
      "title": "Seed-template KV writes are dead code: list and detail always serve from the in-memory array",
      "description": "ensureSeedTemplates writes all SEED_TEMPLATES (plus a seeded flag) into TEMPLATES_KV with a 1-year TTL on first request, but GET / and GET /:id iterate the in-memory SEED_TEMPLATES constant and never read those keys. The KV copies expire and get rewritten forever, serving no reader.",
      "location": {
        "file": "functions/api/routes/templates.ts",
        "function": "ensureSeedTemplates, GET /, GET /:id",
        "lineRange": [395, 428]
      },
      "stage": "creation",
      "currentBehavior": "Pointless KV writes and an awaited KV get on every list/detail request.",
      "expectedBehavior": "Either serve seeds from KV (making them editable/extensible without deploys) or delete ensureSeedTemplates.",
      "affectedWorkflow": "creation → retrieval",
      "dataImpact": "None; wasted writes and latency, plus a false impression that KV is the source of truth.",
      "remediationSteps": [
        "1. Remove ensureSeedTemplates and its call sites (simplest), or",
        "2. Invert: read `qesto_template:*` keys via the seeded list and fall back to the constant."
      ],
      "codeExample": {
        "before": "app.get('/', async (c) => {\n  await ensureSeedTemplates(c.env.TEMPLATES_KV) // written, never read\n  for (const tmpl of SEED_TEMPLATES) { ... }\n})",
        "after": "app.get('/', async (c) => {\n  const templates = category ? SEED_TEMPLATES.filter((t) => t.category === category) : SEED_TEMPLATES\n  return c.json({ ok: true, data: { templates }, trace_id: c.get('trace_id') })\n})"
      }
    },
    {
      "id": "MKTP-020",
      "severity": "low",
      "category": "externalPresentation",
      "title": "Gallery cards have no preview imagery; no template asset pipeline exists",
      "description": "Template cards render text + a gradient strip only; there is no R2 (or other) storage for preview images/thumbnails anywhere in the template pipeline. The in-app seed templates define `previewAlt` strings describing preview images that don't exist. OG images are generated dynamically (og-image route) for social shares, but on-site discovery has no visual differentiation between templates.",
      "location": {
        "file": "src/pages/TemplateGallery.tsx",
        "function": "TemplateCard",
        "lineRange": [68, 125]
      },
      "stage": "presentation",
      "currentBehavior": "Text-only cards; previewAlt metadata dangles with no image counterpart.",
      "expectedBehavior": "Cards show a lightweight generated preview (the existing og-image generator could render card thumbnails) or the previewAlt fields are removed.",
      "affectedWorkflow": "presentation",
      "dataImpact": "None; discovery/scanability only.",
      "remediationSteps": [
        "1. Reuse generateOgImageUrl at card size for a per-template thumbnail (cached at the edge), or",
        "2. Drop previewAlt from the seed schema to stop implying imagery exists."
      ],
      "codeExample": {
        "before": "<div className=\"h-1 w-full\" style={gradientBrand} />",
        "after": "<img src={generateOgImageUrl({ title, industry: template.industry, theme: template.theme, size: 'card' })} alt=\"\" loading=\"lazy\" className=\"h-24 w-full object-cover\" />"
      }
    }
  ],
  "summary": {
    "totalFindings": 20,
    "byCriticality": {
      "critical": 2,
      "high": 7,
      "medium": 6,
      "low": 5
    },
    "byStage": {
      "creation": 6,
      "modification": 3,
      "storage": 3,
      "retrieval": 3,
      "presentation": 5
    },
    "pipelineHealth": 31,
    "recommendedPriority": [
      "MKTP-001",
      "MKTP-002",
      "MKTP-008",
      "MKTP-009",
      "MKTP-005",
      "MKTP-004",
      "MKTP-003",
      "MKTP-007",
      "MKTP-006",
      "MKTP-010",
      "MKTP-012",
      "MKTP-013",
      "MKTP-011",
      "MKTP-014",
      "MKTP-015",
      "MKTP-019",
      "MKTP-016",
      "MKTP-017",
      "MKTP-018",
      "MKTP-020"
    ]
  }
}
```

## Reading guide

**The two pipeline-severing defects:**

1. **MKTP-001 — the pipeline generates fiction.** The workflow's D1 query omits the question `prompt` column, and the rewrite step feeds the AI the literal placeholder *"Generic question about topic"* for every question. Nothing a customer actually asked ever reaches the template. Every template in MARKETING_KV today is fabricated content, published publicly and submitted to search engines with marketing copy claiming it was "created from real Qesto sessions."
2. **MKTP-002 — the funnel's last step is a 404.** "Use this template" writes a session blob and a magic-link token to KV keys that no code ever reads, and returns a link to `/s/:id` — a route that does not exist in the SPA. Every conversion from the template gallery dead-ends, while `usageCount` (the social-proof number on the cards and the sitemap priority signal) still increments.

**Sequencing note for remediation:** fix MKTP-008 (fail-closed privacy gates, real-original comparison) **in the same change as or before** MKTP-001. Fixing MKTP-001 alone starts flowing real customer question text through anonymisation gates that currently cannot reject anything — that is a PII exposure, and per Hard Rule 6 (REV-10) both changes require `npm run test:eval` evidence with updated golden fixtures.

**Structural recommendation:** MKTP-005, MKTP-010, MKTP-011, and MKTP-012 share one root cause — using KV read-modify-write lists as a queryable registry. Migrating template metadata (id, facets, state, usage_count) to a D1 table while keeping the full record in KV resolves all four with one migration and gives the state machine from MKTP-009 a natural home.
