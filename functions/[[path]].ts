import { createApp } from './api/app'
import type { Env } from './api/types'

const app = createApp()

export const onRequest: PagesFunction<Env> = (context) => {
  const url = new URL(context.request.url)
  if (!url.pathname.startsWith('/api/')) {
    return context.next()
  }
  return app.fetch(context.request, context.env, context as unknown as ExecutionContext)
}
