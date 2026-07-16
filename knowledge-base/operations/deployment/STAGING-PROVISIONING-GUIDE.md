# Staging Provisioning Guide

> **Removed.** Qesto does not run a dedicated staging environment, and one is
> not currently planned. The Cloudflare D1/KV/DO provisioning steps that used to
> live here have been retired along with the `[env.staging]` block in
> `wrangler.toml` and the `scripts/provision-staging.sh` helper.
>
> Deployments go straight to production via the `build · deploy` GitHub Action
> (`.github/workflows/ci.yml`) → the `qesto` Cloudflare Pages project. For local
> testing use `npm run dev` / `wrangler pages dev`. See
> [`SPEC_DEPLOYMENT.md`](../../specifications/domain/SPEC_DEPLOYMENT.md).
