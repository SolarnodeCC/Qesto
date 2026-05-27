# Web surface (`apps/web`)

Qesto’s production web app lives at **`src/`** (Vite + React 19), not under `apps/web/`. This path exists for jankurai reference-profile compatibility.

| Canonical | Alias |
|-----------|--------|
| `src/` | `apps/web` (this document) |

**Owns:** UI, hooks, WebSocket client state, Tailwind v4, i18n  
**Forbidden:** `functions/api/` edits, secrets, direct D1  
**Proof lane:** `just ux-qa` (Playwright + build)

See also [src/AGENTS.md](../../src/AGENTS.md) if present, and [docs/testing.md](../../docs/testing.md).
