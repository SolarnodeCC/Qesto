// Wire format for the SessionRoom WebSocket protocol. The SPEC_REALTIME.md
// taxonomy is the north star; v1 ships the subset below (enough for S1–S5
// acceptance). Extra types get added alongside new client features, never
// ahead of them.
//
// Split into focused modules (Jankurai code-shape): protocol versioning/flags,
// energizer state, townhall board types, and the message envelopes.
export * from './protocol'
export * from './energizer'
export * from './townhall'
export * from './messages'
