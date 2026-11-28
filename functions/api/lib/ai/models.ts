/**
 * Workers AI model registry — the single source of truth for every text/embedding
 * model id the API calls.
 *
 * Why this exists: the AI binding is mocked in unit tests, so an invalid model id
 * passes CI and only fails in production. Two ids shipped that way
 * (`@cf/meta/distilbert-sst-2-int8`, `@cf/mistral/mistral-7b-instruct-v0.2`) and
 * silently broke live sentiment and every AI insights run.
 *
 * Guards:
 *   - tests/unit/ai-model-registry.test.ts fails when a `@cf/...` literal appears
 *     in functions/ or worker/ outside this file (marketing video models excepted).
 *   - scripts/check-ai-models.mjs validates every id here against the live Workers
 *     AI catalog (`/ai/models/schema?model=`) whenever CLOUDFLARE_API_TOKEN is set.
 *
 * Every id below was verified against the catalog on 2026-11-28.
 */
export const AI_MODELS = {
  /** General chat/JSON generation — insights, coaching, copilot, studio, recaps. */
  LLAMA_70B: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  /** Low-latency chat — wizard first pass, help answers, LinkedIn drafts. */
  LLAMA_8B: '@cf/meta/llama-3.1-8b-instruct-fp8',
  /** English sentiment classifier (SST-2). */
  SENTIMENT: '@cf/huggingface/distilbert-sst-2-int8',
  /** Speech-to-text for live captions. */
  WHISPER: '@cf/openai/whisper',
  /** Machine translation for live captions. */
  M2M100: '@cf/meta/m2m100-1.2b',
  /** Embeddings — 1024d, must match every Vectorize index (see embedding-model.ts). */
  BGE_M3: '@cf/baai/bge-m3',
} as const

export type AIModelId = (typeof AI_MODELS)[keyof typeof AI_MODELS]

export const ALL_AI_MODEL_IDS: readonly AIModelId[] = Object.values(AI_MODELS)
