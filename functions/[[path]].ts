import { createApp } from './api/app'
import type { Env } from './api/types'

const app = createApp()

export const onRequest: PagesFunction<Env> = (context) => {
  const url = new URL(context.request.url)
  if (!url.pathname.startsWith('/api/')) {
    return context.next()
  }
  const waitUntil = (context as unknown as { waitUntil?: (promise: Promise<unknown>) => void }).waitUntil
  const passThroughOnException = (context as unknown as { passThroughOnException?: () => void }).passThroughOnException
  const exec: ExecutionContext = {
    waitUntil: typeof waitUntil === 'function' ? waitUntil.bind(context) : () => {},
    passThroughOnException: typeof passThroughOnException === 'function' ? passThroughOnException.bind(context) : () => {},
    props: {},
  }
  return app.fetch(context.request, context.env, exec)
}
