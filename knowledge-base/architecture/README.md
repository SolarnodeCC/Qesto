---
id: GOVERNANCE
type: guide
domain: governance
category: policy
status: active
version: 1.0
created: 2026-04-01
updated: 2026-05-11
tags:
  - governance
  - policy
  - guidelines
relates_to:
  - CONTRIBUTING
---

# Architecture & System Design

Technical overview, system diagrams, and design principles for Qesto.

## Contents

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** — Core system architecture
- **[CLOUDFLARE_WORKERS_OPTIMIZATION.md](./CLOUDFLARE_WORKERS_OPTIMIZATION.md)** — Edge runtime optimization
- **[DESIGN_GRID_GUIDE.md](./DESIGN_GRID_GUIDE.md)** — UI grid and layout system

## Key Concepts

1. **Edge-first**: Global low-latency via Cloudflare Workers + Durable Objects
2. **Session isolation**: One Durable Object per session for realtime state
3. **Privacy by default**: Anonymity modes, GDPR consent logging
4. **Multi-tenant**: Teams, roles, plan-gated features

See [ADRs](../adr/) for detailed decision rationale.

---

**See**: [Main Knowledge Base](../README.md) | [Specifications](../specifications/)
