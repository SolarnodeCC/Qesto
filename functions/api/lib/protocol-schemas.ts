// Proof-aware decoders for boundary crossings using Zod.
// All data from network, storage, or KV must be validated before casting.
//
// This file was 963 lines of every boundary schema in the product. It is now a
// re-export barrel over functions/api/lib/schemas/*, grouped by domain, so the
// 40 existing import sites keep working while each module stays readable
// (issue #687, HLT code-shape).
//
// Import from here for convenience, or straight from the domain module when you
// only need one area's schemas.

export * from './schemas/realtime'
export * from './schemas/auth'
export * from './schemas/audit'
export * from './schemas/team'
export * from './schemas/billing'
export * from './schemas/sessions'
export * from './schemas/ai'
export * from './schemas/integrations'
