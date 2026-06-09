# Workers (`crates/workers/`)

Qesto edge workers live at **`worker/`** and **`functions/api/`** (Cloudflare Pages Functions + Durable Objects). This path exists for jankurai reference-profile compatibility.

| Canonical | Alias |
|-----------|--------|
| `worker/` | scheduled worker cron |
| `functions/api/` | Hono API + `SessionRoom` DO |

**Owns:** Nothing directly — edit canonical paths above  
**Forbidden:** Duplicating runtime logic here  
**Proof lane:** `just fast`

See [worker/AGENTS.md](../../worker/AGENTS.md) and [functions/api/AGENTS.md](../../functions/api/AGENTS.md).
