# SOC 2 Type II Roadmap (Sprint 47)

**Evidence window:** 6 months (2027 Q1–Q2)  
**Target certification:** 2027 Q3

## Control themes

| Theme | Owner | S46–S47 status |
|-------|-------|----------------|
| Access control | Security | RBAC + audit_events |
| Change management | DevOps | PR + CI required |
| Incident response | DevOps | Runbooks in `knowledge-base/operations/` |
| Vendor management | PO | Sub-processor list in COMPLIANCE-01 |
| Monitoring | Backend | metrics_summary + AE events |

## Monthly evidence cadence

1. Export `GET /api/admin/audit/forensic.csv` monthly
2. Archive CI green runs for `main`
3. Pen-test #2 remediation sign-off (see PENTEST_02_SCOPE.md)
