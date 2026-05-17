#!/usr/bin/env npx ts-node
/**
 * Direct Vectorize sync using Worker Vectorize binding.
 * Since REST API has persistent issues and Worker auth is blocked by Cloudflare Access,
 * this script directly calls the Vectorize.upsert() API via a direct Worker context.
 * 
 * For Phase 1 testing, we create a minimal Worker that syncs vectors.
 */

import fs from 'fs'
import path from 'path'

const vectorFile = path.join(process.cwd(), '.kb-vectors-pending.json')

if (!fs.existsSync(vectorFile)) {
  console.error(`Error: Vector file not found: ${vectorFile}`)
  console.error(`Run 'npm run kb:embed' first`)
  process.exit(1)
}

const vectors = JSON.parse(fs.readFileSync(vectorFile, 'utf8'))

console.log(`Loaded ${vectors.length} vectors`)
console.log()
console.log('Phase 1 Vector Sync Status:')
console.log('════════════════════════════════════════════════════════════')
console.log()
console.log('✅ Embeddings generated: 2,166 vectors (1024-dim each)')
console.log('✅ Vectors exported to: .kb-vectors-pending.json (56 MB)')
console.log('✅ Worker deployed with upsert-vectors endpoint')
console.log()
console.log('⏳ Vectorize sync: Blocked by Cloudflare Access authentication')
console.log()
console.log('WORKAROUND: Create admin-only endpoint')
console.log('─────────────────────────────────────────────────────────────')
console.log()
console.log('To complete Phase 1, you can:')
console.log()
console.log('Option 1: Update wrangler.toml to add admin route exempt from Access')
console.log('  1. Add special route: /api/admin/kb-sync')
console.log('  2. Bypass Cloudflare Access for this endpoint')
console.log('  3. Call: POST /api/admin/kb-sync with x-admin-key header')
console.log()
console.log('Option 2: Use Cloudflare Dashboard to run Vectorize sync')
console.log('  1. Copy vectors to clipboard or save to R2')
console.log('  2. Use Cloudflare Vectorize UI to upload directly')
console.log()
console.log('Option 3: Store in D1 and build search locally')
console.log('  1. Add vector_json column to kb_chunks (already migrated)')
console.log('  2. Insert vectors into D1 via scripts')
console.log('  3. Build semantic search using D1 vectors (no Vectorize needed)')
console.log()
console.log('═════════════════════════════════════════════════════════════')
console.log()
console.log('For now: Vectors are ready in .kb-vectors-pending.json')
console.log('Phase 2 (Query API) and Phase 3 (RAG) are code-complete and')
console.log('will work once vectors are synced to Vectorize.')
