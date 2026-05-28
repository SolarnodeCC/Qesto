# ADR-0036: EU multi-region write GA + tenant pinning

**Status:** Proposed (kickoff S74)  
**Date:** 2026-05-27

## Context

S60–S70 established MR write foundation (`MR_WRITE_EU_COHORT`). S74 kicks off tenant pinning design; GA lands S74–S75 per master plan.

## Decision (S74)

- Document pinning model in `lib/residency-enforce.ts` (S75 enforce).
- Cost attribution (`tenant-cost`) ships before write GA.

## Forbidden

Do not enable SessionRoom DO split (ADR-0035) in the same sprint as MR write GA.
