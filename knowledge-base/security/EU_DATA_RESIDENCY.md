---
id: ENT-RESIDENCY-01
type: evidence
status: active
created: 2026-05-22
---

# EU Data Residency Evidence (ENT-RESIDENCY-01)

Qesto runs on **Cloudflare's global network**. Customer content is processed at the edge nearest the user; EU traffic is typically served from EU colos.

## Contractual position

- **DPA:** See [`DPA_SCC_TEMPLATE.md`](./DPA_SCC_TEMPLATE.md) (Standard Contractual Clauses for transfers where applicable).
- **Sub-processors:** [`SOC2_EVIDENCE.md`](./SOC2_EVIDENCE.md) registry.
- **D1 location:** Database region is chosen at creation time and **cannot be migrated** after provisioning. Production uses Cloudflare D1 with EU-oriented deployment configuration documented in ops runbooks.

## Evidence to collect (ops)

1. Cloudflare dashboard → account → **Data localization** / regional services settings (screenshot).
2. Wrangler deploy region and `placement` hints in `wrangler.toml` (if configured).
3. Resend / Stripe: confirm EU data processing options enabled where available.

## Marketing claim gate

Public copy may use **"EU-hosted"** only when this file and `SOC2_EVIDENCE.md` are referenced in the same release PR (`npm run check:compliance-claims`).

## Residency request runbook

1. Customer submits ticket with team ID and jurisdiction.
2. Support confirms sub-processors in SOC2 registry and DPA signature status.
3. If custom DPA required, legal sends `DPA_SCC_TEMPLATE.md` filled copy.
4. No database region migration is offered post-provisioning — disclose upfront.
