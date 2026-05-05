const UPSTREAM_API_ORIGIN = 'https://qesto-api.oostelaar.workers.dev'

export const onRequest: PagesFunction = async (context) => {
  const incoming = context.request
  const incomingUrl = new URL(incoming.url)

  if (!incomingUrl.pathname.startsWith('/api/')) {
    return context.next()
  }

  const upstreamUrl = new URL(incomingUrl.pathname + incomingUrl.search, UPSTREAM_API_ORIGIN)
  const headers = new Headers(incoming.headers)
  headers.delete('host')

  const init: RequestInit = {
    method: incoming.method,
    headers,
    redirect: 'manual',
  }
  if (!['GET', 'HEAD'].includes(incoming.method.toUpperCase()) && incoming.body) {
    init.body = incoming.body
  }

  return fetch(upstreamUrl.toString(), init)
}
