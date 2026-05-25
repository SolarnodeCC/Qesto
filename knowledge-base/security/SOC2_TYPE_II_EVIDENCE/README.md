# SOC 2 Type II Evidence Pack (S58–S59)

Evidence for auditor review. **Do not commit customer PII or raw audit logs.**

## Structure

| Folder | Contents |
|--------|----------|
| `controls/` | Control descriptions + design / operating effectiveness |
| `interviews/` | Interview notes (sanitized) |
| `pentest/` | Pentest scope, findings, remediation sign-off |
| `samples/` | Sample change tickets, access reviews |

## Status (S59)

- **SOC 2 Type II:** Report issued (see trust page `/trust/soc2`)
- **Pentest:** Remediation complete; retest green
- **Webhook audit:** DPA addendum tracked in `COMPLIANCE-WEBHOOK-AUDIT-01`

## API hooks

- `GET /api/admin/compliance/status` — prep status (admin)
- `POST /api/admin/compliance/soc2/complete` — AE `compliance.soc2_type2_completed`
- `POST /api/admin/compliance/pentest/resolve` — AE `compliance.pentest_resolved`

## References

- [`SOC2_TYPE2_ROADMAP.md`](../../operations/compliance/SOC2_TYPE2_ROADMAP.md)
- [`SOC2_EVIDENCE.md`](../SOC2_EVIDENCE.md)
