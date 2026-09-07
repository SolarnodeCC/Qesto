/**
 * The single source of truth for the embedding model and its output dimension.
 *
 * All three Vectorize indexes (DECISIONS / HELP / KB) are built with this model,
 * so the model name and the index dimension must move together — an index built
 * for one and queried with another returns plausible-looking nonsense with no
 * error (the vectors are simply in a different space), or, when the dimensions
 * differ, silently rejects every embedding.
 *
 * Deliberately free of Worker-runtime imports so the Node ingest scripts
 * (scripts/embed-kb.ts, scripts/sync-help-docs.ts) can share it with the edge
 * code instead of each hardcoding the string. Changing the model here is an
 * AI-eval-gated change (CLAUDE.md hard rule 6) AND requires recreating every
 * index at the new dimension.
 */
export const BGE_M3_MODEL = '@cf/baai/bge-m3' as const
export const BGE_M3_EMBED_DIM = 1024

/**
 * Build the Workers AI REST endpoint for `model`, routed through AI Gateway
 * when one is configured.
 *
 * The edge code funnels every inference through the gateway via runAI() for
 * caching and cost visibility; the bulk-embed scripts called the direct
 * `api.cloudflare.com/.../ai/run/...` endpoint, so the single largest source of
 * neuron spend in the system had neither (audit #20). Falls back to the direct
 * endpoint when CLOUDFLARE_AI_GATEWAY_ID is unset, matching how the Worker
 * bypasses the gateway when its secrets are absent.
 */
export function workersAiRunUrl(
  accountId: string,
  model: string = BGE_M3_MODEL,
  gatewayId?: string | undefined,
): string {
  // Model ids contain `/` segments (@cf/baai/...) that both endpoints expect
  // verbatim in the path — encode each segment, keep the separators.
  const modelPath = model.split('/').map(encodeURIComponent).join('/')
  return gatewayId
    ? `https://gateway.ai.cloudflare.com/v1/${accountId}/${gatewayId}/workers-ai/${modelPath}`
    : `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${modelPath}`
}
