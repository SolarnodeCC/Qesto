// functions/api/lib/shared/uuid.ts — UUID generation utility
// Consolidates unique identifier generation

export function generateUuid(): string {
  return crypto.randomUUID()
}
