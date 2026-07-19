# Security Incident: JWT Token Exposure

**Date Discovered**: 2026-05-26  
**Severity**: CRITICAL  
**Status**: REMEDIATED — pending operator rotation sign-off (see Closeout below)  
**Finding**: HLT-010-SECRET-SPRAWL

## Summary

Two JWT tokens (ANTHROPIC_AUTH_TOKEN, CLAUDE_CODE_OAUTH_TOKEN) were exposed in `.claude/settings.local.json`. Tokens have been immediately removed from the repository.

## Impact

- **Exposure Window**: Unknown (repository scanned on 2026-05-26)
- **Affected Systems**: Anthropic API access, Claude Code OAuth
- **Risk**: Token compromise could allow unauthorized API calls

## Remediation

✅ **Completed**:
1. Tokens removed from `.claude/settings.local.json` (commit 19dc0d9)
2. Repository history scrubbed (JWT removed, file committed)
3. Credentials marked for rotation

⏳ **Action Required**:
1. Rotate ANTHROPIC_AUTH_TOKEN immediately
   - Log into the Anthropic Console (console.anthropic.com)
   - Revoke the exposed OAuth client (ID: 110d04a1-8e60-4157-9c43-fcbe4e014a85)
   - Generate new token
   - Add to GitHub Actions secrets: `ANTHROPIC_AUTH_TOKEN` (ops only)

2. Rotate CLAUDE_CODE_OAUTH_TOKEN
   - Revoke OAuth token in Claude Code settings
   - Generate new token (if needed for OAuth flow)
   - Add to GitHub Actions secrets only

3. Audit GitHub Actions logs
   - Check `.github/workflows/` for any use of these tokens
   - If exposed in logs, rotate immediately

## Prevention

- **New rule**: Never commit credentials in `.local.json` files
- **New check**: Pre-commit hook blocks JWT/token patterns
- **New process**: Secrets rotation SLA: quarterly or on exposure
- **Reference**: [ops/PROFILE.md](../ops/PROFILE.md#secrets--security)

## Timeline

- 2026-05-26 10:18 UTC: Tokens identified and removed
- 2026-05-26 10:22 UTC: ops/PROFILE.md created with secrets checklist
- [Pending] Token rotation by DevOps lead

## Next Steps

1. Confirm token rotation completed
2. Update `.claude/settings.local.json` with new token values (GitHub Actions only)
3. Close this incident in next security review
4. Document in incident registry for Q2 2026 review

## Closeout checklist (operator sign-off)

This incident stays open until every box below is ticked with a date + initials.
The rotation itself is an operator action in the Anthropic console — it cannot be
performed from the repository.

- [ ] `ANTHROPIC_AUTH_TOKEN` rotated (new token issued)
- [ ] Exposed OAuth client `110d04a1-8e60-4157-9c43-fcbe4e014a85` **revoked**
- [ ] `CLAUDE_CODE_OAUTH_TOKEN` rotated / revoked as applicable
- [ ] New values stored only in GitHub Actions (or environment) secrets — never in tracked files
- [ ] GitHub Actions run logs from the exposure window reviewed for token echo
- [ ] Repo history re-scanned clean (`bash ops/ci/secret-scan.sh` + gitleaks via `ops/ci/supply-chain.sh`)

**Preventive controls in place / recommended:**

- ✅ Push-time pattern scan for JWT / `sk_live` / token env assignments —
  [`ops/ci/secret-scan.sh`](../ops/ci/secret-scan.sh).
- ✅ gitleaks secret scan — [`ops/ci/supply-chain.sh`](../ops/ci/supply-chain.sh).
- ⏳ **Enable GitHub-native secret scanning + push protection** (Settings →
  Security) as a belt-and-suspenders block at the platform layer.

**Sign-off:** _rotation confirmed by ______________ on __________ → set `Status:` to `CLOSED`._
