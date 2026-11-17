# Agent-native standard (Qesto pointer)

Qesto targets **jankurai HL3** conformance. The canonical standard text is maintained upstream:

- https://github.com/neverhuman/jankurai-audit-standard/blob/9b0ff5d4845e76dd483d2aeae4614357b9fd337b/docs/agent-native-standard.md (jankurai-standard, pinned by the v1.7.6 hub `family.lock`)

Local bindings:

- Standard copy in repo: [agent/JANKURAI_STANDARD.md](../agent/JANKURAI_STANDARD.md)
- Owner map: [agent/owner-map.json](../agent/owner-map.json)
- Test map: [agent/test-map.json](../agent/test-map.json)
- Generated zones: [agent/generated-zones.toml](../agent/generated-zones.toml)

Run `just score` to regenerate `agent/repo-score.json` and `agent/repo-score.md`.
