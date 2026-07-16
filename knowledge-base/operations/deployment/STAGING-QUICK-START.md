# Staging Environment Setup — Quick Start

> **Removed.** Qesto does not run a dedicated staging environment, and one is
> not currently planned. The provisioning steps that used to live here (and the
> `scripts/provision-staging.sh` helper) have been retired.
>
> Deployments go straight to production via the `build · deploy` GitHub Action
> (`.github/workflows/ci.yml`) → the `qesto` Cloudflare Pages project. For local
> testing use `npm run dev` / `wrangler pages dev`. See
> [`SPEC_DEPLOYMENT.md`](../../specifications/domain/SPEC_DEPLOYMENT.md).
