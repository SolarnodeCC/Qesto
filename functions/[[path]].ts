import { createApp } from './api/app'
import type { Env } from './api/types'

const app = createApp()

export const onRequest: PagesFunction<Env> = (context) => {
  return app.fetch(context.request, context.env, context)
}
