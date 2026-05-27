# ADR-0033: Federation trust and cross-org consent

**Status:** Accepted (S67)  
**Date:** 2026-05-25

## Context

Multi-org deployments need controlled session sharing without merging tenant data.

## Decision

- Federation links stored in `TEAMS_KV` (`federation:link:{id}`) with `sourceTeamId`, `targetTeamId`, `scopes`, `consentAt`.
- Consent flow: target team admin accepts via `POST /api/federation/links/:id/consent`.
- No cross-region data replication in federation v1 — metadata only.

## Consequences

- STRIDE review required before enabling write scopes on federation links (S67 security gate).
