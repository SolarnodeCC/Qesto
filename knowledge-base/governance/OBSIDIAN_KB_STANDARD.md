---
id: OBSIDIAN-KB-STANDARD
type: policy
domain: governance
category: documentation
status: active
version: 1.0
created: 2026-05-24
updated: 2026-05-24
tags:
  - obsidian
  - knowledge-base
  - notion-deprecation
relates_to:
  - CONTRIBUTING
  - README
---

# Obsidian Knowledge Base Standard

**Decision (2026-05):** All internal product, architecture, and operations documentation lives in the **Obsidian vault** at [`/knowledge-base/`](../README.md). **Do not use Notion** for specs, ADRs, sprint plans, runbooks, or team wikis.

Customer-facing **Notion OAuth** (session export integration) is **legacy** — no new internal or product work should assume Notion as a documentation or planning surface.

---

## Vault location

| Item | Path |
|------|------|
| Vault root | `knowledge-base/` (open as folder vault in Obsidian) |
| Vault config | `knowledge-base/.obsidian/` (committed; share via git) |
| Archive (imports) | `knowledge-base/archive/` |

**Open in Obsidian:** File → Open folder as vault → select repo `knowledge-base/` directory.

---

## Core plugins (enabled in repo)

Shipped in [`.obsidian/core-plugins.json`](../.obsidian/core-plugins.json):

- **Properties** — YAML frontmatter editing
- **Graph view** — link discovery
- **Backlinks / outgoing links** — cross-reference navigation
- **Templates** — sprint/spec templates under `metadata/templates/`
- **Daily notes** — optional ops diary (not required for specs)
- **Canvas** — diagrams where Mermaid in markdown is insufficient
- **Sync** — optional; **git is source of truth** for the team

---

## Recommended community plugins

Install via Obsidian → Settings → Community plugins (each teammate once per machine). Suggested set for “wiki-like” pages:

| Plugin | Purpose |
|--------|---------|
| **Dataview** | Tables and queries over frontmatter (backlog views, ADR lists) |
| **Obsidian Git** | Pull/commit/push from the vault without leaving Obsidian |
| **Folder Notes** | `README.md` as folder index pages (matches our folder README pattern) |
| **Excalidraw** | Whiteboard diagrams linked from markdown |
| **Linter** | Markdown style consistency (headings, lists) before commit |

Optional: **Kanban** (sprint boards), **Tag Wrangler** (tag cleanup), **Paste image rename** (screenshots in `archive/` or `experiments/` only).

Record installed community plugin IDs in [`.obsidian/community-plugins.json`](../.obsidian/community-plugins.json) when the team agrees on a standard set (Sprint 51: `KB-OBSIDIAN-01`).

---

## Authoring rules

1. **Markdown only** — no Notion exports as source of truth; import once to `archive/notion-import/` then edit in Obsidian.
2. **YAML frontmatter** on every new doc — see [CONTRIBUTING.md](../CONTRIBUTING.md).
3. **Wikilinks** — prefer `[[ADR-0022-multi-region-foundation]]` or relative paths; keep links valid for CI/agents.
4. **Naming** — existing conventions (`ADR-*`, `SPEC_*`, `SPRINT*_PLAN.md`) unchanged.
5. **Planning truth** — sprint horizons in `product/planning/`; do not duplicate in external tools.

---

## Notion sunset checklist (team)

- [ ] Export any remaining Notion pages → `knowledge-base/archive/notion-import/YYYY-MM-DD/`
- [ ] Cancel or downgrade Notion seats used only for Qesto docs
- [ ] Update bookmarks/onboarding to point to Obsidian vault + this doc
- [ ] Remove Notion links from active runbooks (search: `notion.so`, `notion.site`)
- [ ] Product/marketing copy may still mention “export to Notion” for **customers** until export targets are revised — track under `EXPORT-OBSIDIAN-01` if needed

---

## Agent / CI note

Cursor agents and `CLAUDE.md` already reference `/knowledge-base/`. Agents must **read and write** KB files in-repo, not Notion.
