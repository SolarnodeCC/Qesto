import { type Context } from 'hono'
import { z } from 'zod'

export async function validateBody<T>(
  c: Context,
  schema: z.ZodSchema<T>,
): Promise<{ data: T } | { error: Response }> {
  const body = (await c.req.json().catch(() => null)) as unknown

  const result = schema.safeParse(body)

  if (!result.success) {
    const errorResponse = c.json(
      {
        ok: false,
        error: {
          code: 'validation',
          message: 'Invalid request payload',
          details: result.error.flatten(),
        },
      },
      400,
    )
    return { error: errorResponse }
  }

  return { data: result.data }
}
