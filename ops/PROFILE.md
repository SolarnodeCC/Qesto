# Operations Reference Profile

**Owner**: DevOps & Infrastructure Lead  
**Proof Lane**: `security` (CI/CD, secrets, deployment)  
**Expiry**: Q3 2026 (review with each major release)  
**Migration**: Replaces `.github/workflows/` standalone documentation

## Scope

Operations profile covers:
- Deployment pipelines (wrangler, Pages, D1)
- Secret management (GitHub Actions, wrangler CLI)
- Incident response & monitoring
- Infrastructure as Code patterns (Cloudflare Workers, KV, DO)
- Service reliability targets

## Checklist

### Deployment & CI/CD
```
□ All deployments via GitHub Actions (no manual `wrangler` in shared envs)
□ Secrets rotated before each release (see SECRETS_ROTATION.md)
□ Build artifacts signed (npm packages only)
□ Rollback plan documented per environment
□ Zero-downtime deployment for Pages (via route versioning)
```

### Infrastructure & Data
```
□ D1 backups automated (via Cloudflare automation)
□ KV namespace replication configured (SESSIONS_KV, USERS_KV, AUDIT_KV)
□ Durable Objects durability set to STRONG (production)
□ Worker rate limits enforced (see wrangler.toml)
□ CORS configured (allow: https://app.qesto.com only)
```

### Secrets & Security
```
□ GitHub Actions secrets encrypted (never committed)
□ Wrangler secrets via 'wrangler pages secret put' (not wrangler.toml)
□ JWT_SECRET rotated quarterly
□ STRIPE_SECRET_KEY, RESEND_API_KEY in GitHub Secrets only
□ No private keys in repository
```

### Monitoring & Alerting
```
□ Error rate dashboard (>1% alerts on-call)
□ Latency p95 target: <500ms API, <100ms WebSocket votes
□ Uptime SLA: 99.5% (measured via Cloudflare Analytics)
□ On-call rotation escalation documented
```

### Incident Response
```
□ Incident response plan in INCIDENT_RESPONSE.md
□ Rollback procedure tested quarterly
□ Security incident timeline: disclosure within 72h
□ Post-incident review (PIR) template in .github/
```

## References

- **Deployment**: [knowledge-base/operations/DEPLOYMENT.md](../knowledge-base/operations/DEPLOYMENT.md)
- **Secrets Rotation**: [.claude/skills/devops.md](../.claude/skills/devops.md#secrets-rotation)
- **Wrangler Config**: [wrangler.toml](../wrangler.toml)
- **CI Workflows**: [.github/workflows/](../.github/workflows/)

## Proof Lane

This profile is validated by the `security` lane on every commit:
- Secret scanning: `gitleaks` + `npm audit`
- Wrangler config: `wrangler.toml` lint
- Workflow syntax: GitHub Actions validation
- Infrastructure as Code: no hardcoded secrets

Run locally:
```bash
just security    # Full security audit
just fast        # Quick type + lint + build
```
