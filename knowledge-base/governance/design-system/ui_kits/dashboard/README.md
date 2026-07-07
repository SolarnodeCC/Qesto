# Dashboard UI kit

The logged-in host interface, recreated from `src/pages/Dashboard.tsx` + `Launchpad.tsx`.

240px **sidebar** + topbar with search. Two views (toggle in the sidebar):
- **Launchpad** (default) — editable **session title** field, green **pre-flight checklist** (per-check status), **join code panel** (gradient code + copy-to-clipboard, real QR, "Go Live" + Share), an **energizer panel**, and a drag-to-reorder **question list** with kind badges, AI Generate + Add question.
- **Dashboard** — greeting + New session, 4-tile **metrics strip** (`MetricCard`), recent **session list** with status badges + Recap buttons, and the **AI recap** panel (violet left-border + `AIBadge` + `TallyBar` theme breakdown).

Uses `Button`, `Card`, `Badge`, `AIBadge`, `MetricCard`, `TallyBar`, `Eyebrow`; Lucide via CDN. Open `index.html`.
