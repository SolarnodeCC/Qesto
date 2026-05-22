---
id: COMPLIANCE-02
type: legal-template
status: draft
created: 2026-05-22
---

# Data Processing Agreement (Template)

> **Not legal advice.** Customer-specific terms require counsel review before signature.

## Parties

- **Controller:** [Customer legal name]
- **Processor:** Qesto / SolarnodeCC — contact: privacy@qesto.cc

## Subject matter

Processing of personal data submitted to the Qesto interactive session platform (hosts, team admins, and participants per session anonymity settings).

## Sub-processors

Listed in [`SOC2_EVIDENCE.md`](./SOC2_EVIDENCE.md). Customer notified of material changes via changelog + 30-day notice.

## Standard Contractual Clauses

Where personal data is transferred outside the EEA, parties incorporate the EU Commission SCC modules applicable to Processor → Sub-processor chains (Module 3) as updated 2021.

## Security measures

Reference SOC 2 control inventory CC6–CC9, P1–P8 in `SOC2_EVIDENCE.md`.

## Data subject rights

Deletion requests: `DELETE /api/users/me/gdpr-delete` (authenticated) or email privacy@qesto.cc. Runbook: [`GDPR_DATA_SUBJECT_RUNBOOK.md`](./GDPR_DATA_SUBJECT_RUNBOOK.md).

## Retention

Session data retained per product defaults; closed sessions deletable by host; account deletion removes user-owned rows per GDPR delete implementation.
