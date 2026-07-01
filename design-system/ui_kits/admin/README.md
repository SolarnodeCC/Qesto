# Admin UI kit

The superadmin **Platform admin** console, recreated from `src/pages/AdminDashboard.tsx`.

Five tabs (segmented control, matching the source): **Dashboard · Observability · Users · Ops · Analytics**.

- **Dashboard** — platform health strip (operational / SEV counts / View ops), a 6-tile `StatCard` overview (live sessions, total users, sessions today/month/total, est. AI cost in €), a 5-tile live `MetricCard` strip (active sessions, participants, revenue 24h, P95 latency, error rate), the **P95 latency sparkline** (area+line, turns red >400ms), a **historical metrics table** (timestamp / route / p50·p95·p99 / error% / requests with date range + Export CSV), and the **audit log** (signed compliance events).
- **Users** — users & workspaces table with role/status badges and SSO org rows.
- **Observability / Ops / Analytics** — representative placeholder panels noting which live feed each wires to (the real app composes `ObservabilityPanel`, `OpsControlPanel`, `AnalyticsAdvancedPanel` here).

Section headers use the teal left-border accent from the source. Uses `Card`, `MetricCard`, `StatCard`, `Button`, `Badge` from the bundle; Lucide via CDN. Open `index.html`.

> Gated in production behind `auth.user.isAdmin` (server-resolved platform-admin authority). Currency is € throughout, matching the source.
