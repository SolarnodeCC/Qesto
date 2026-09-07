import { describe, expect, it } from 'vitest'
import * as fs from 'fs'
import {
  BGE_M3_EMBED_DIM,
  BGE_M3_MODEL,
  workersAiRunUrl,
} from '../../functions/api/lib/embedding-model'
import { KB_EMBED_MODEL, KB_EMBED_DIM } from '../../functions/api/services/kbSearchService'
import { HELP_EMBED_MODEL, HELP_EMBED_DIM } from '../../functions/api/lib/help-vectorize'
import {
  DECISIONS_EMBED_MODEL,
  DECISIONS_EMBED_DIM,
} from '../../functions/api/lib/insights-vectorize'

describe('embedding model/dimension consistency (audit #20, #22)', () => {
  it('every index declares the same model', () => {
    expect(KB_EMBED_MODEL).toBe(BGE_M3_MODEL)
    expect(HELP_EMBED_MODEL).toBe(BGE_M3_MODEL)
    expect(DECISIONS_EMBED_MODEL).toBe(BGE_M3_MODEL)
  })

  it('every index declares the same dimension', () => {
    expect(KB_EMBED_DIM).toBe(BGE_M3_EMBED_DIM)
    expect(HELP_EMBED_DIM).toBe(BGE_M3_EMBED_DIM)
    expect(DECISIONS_EMBED_DIM).toBe(BGE_M3_EMBED_DIM)
  })

  it('the ingest scripts import the shared constant instead of hardcoding the model', () => {
    for (const file of ['scripts/embed-kb.ts', 'scripts/sync-help-docs.ts']) {
      const src = fs.readFileSync(file, 'utf-8')
      expect(src).toMatch(/from '\.\.\/functions\/api\/lib\/embedding-model'/)
      // The literal must appear nowhere but the shared module.
      expect(src).not.toMatch(/ai\/run\/@cf\/baai\/bge-m3/)
    }
  })
})

describe('workersAiRunUrl (audit #20)', () => {
  it('uses the direct Workers AI endpoint when no gateway is configured', () => {
    expect(workersAiRunUrl('acct-1')).toBe(
      'https://api.cloudflare.com/client/v4/accounts/acct-1/ai/run/%40cf/baai/bge-m3',
    )
  })

  it('routes through AI Gateway when a gateway id is supplied', () => {
    expect(workersAiRunUrl('acct-1', BGE_M3_MODEL, 'gw-9')).toBe(
      'https://gateway.ai.cloudflare.com/v1/acct-1/gw-9/workers-ai/%40cf/baai/bge-m3',
    )
  })

  it('keeps the model path separators intact', () => {
    // The model id's own slashes are structural; only the segments are encoded.
    expect(workersAiRunUrl('a', '@cf/meta/llama-3.3-70b-instruct-fp8-fast')).toContain(
      '/ai/run/%40cf/meta/llama-3.3-70b-instruct-fp8-fast',
    )
  })
})
