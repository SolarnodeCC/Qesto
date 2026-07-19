# Security Policy

## Reporting a vulnerability

**Please do not open a public issue for security vulnerabilities.**

Report privately through either channel:

1. **GitHub private vulnerability reporting** — the preferred route. On this
   repository, use **Security → Report a vulnerability** (Privately report a
   vulnerability). This keeps the report confidential and tracked.
2. **Email** — `info@solarnode.cc` with subject prefix `[SECURITY]`.

Please include: affected area (route, workflow, or component), reproduction
steps, impact, and any suggested remediation. We aim to acknowledge within
**3 business days** and to agree on a disclosure timeline with you.

## Supported versions

Qesto is a continuously deployed edge application. Only the **current production
deployment** (`https://qesto.cc`, served from `main`) is supported; there are no
back-ported release branches.

## Scope

In scope: the Cloudflare Pages/Workers application (`functions/`, `worker/`,
`src/`), the CI/CD workflows under `.github/workflows/`, authentication and
multi-tenant isolation, Stripe billing flows, and data handling (D1/KV/Vectorize).

Out of scope: third-party services (Cloudflare, Stripe, Resend) themselves,
volumetric denial-of-service testing, and social-engineering.

## Related material

- Security operations and runbooks: [`knowledge-base/operations/security/`](../knowledge-base/operations/security/)
- Compliance and audit posture: [`knowledge-base/security/`](../knowledge-base/security/)
- Past incident record: [`SECURITY_INCIDENT.md`](./SECURITY_INCIDENT.md)

## Handling of credentials

Secrets are never committed to the repository (Hard Rule #2). CI enforces
secret-pattern scanning via [`ops/ci/secret-scan.sh`](../ops/ci/secret-scan.sh)
and gitleaks via [`ops/ci/supply-chain.sh`](../ops/ci/supply-chain.sh). If you
discover an exposed credential, treat it as a vulnerability and report it through
the channels above so it can be rotated.
