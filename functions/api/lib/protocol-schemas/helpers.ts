// Generic boundary-crossing parse helpers.

import { z } from 'zod'
import {
  ClientMessageSchema,
  VersionedClientEnvelopeSchema,
  type ValidClientMessage,
} from './protocol'
import { absent } from '../absent'

// Generic KV validator: parse and optionally validate with a schema
export function validateKvJson<T>(
  raw: string | null,
  schema?: z.ZodSchema<T>,
): T | null {
  if (!raw) return absent<T>()
  try {
    const parsed = JSON.parse(raw)
    if (schema) {
      return schema.parse(parsed)
    }
    return parsed as T
  } catch {
    return absent<T>()
  }
}

// Safely parse client message with type guard
// Validates before returning to ensure type safety at boundary
export function parseClientMessage(text: string): ValidClientMessage | null {
  try {
    const envelope = VersionedClientEnvelopeSchema.parse(JSON.parse(text))
    if (typeof envelope.type === 'string') {
      return ClientMessageSchema.parse(envelope) as ValidClientMessage
    }
    return absent<ValidClientMessage>()
  } catch {
    return absent<ValidClientMessage>()
  }
}

// Validate already-parsed object with a schema
export function validateData<T>(data: unknown, schema: z.ZodSchema<T>): T | null {
  try {
    return schema.parse(data)
  } catch {
    return absent<T>()
  }
}
