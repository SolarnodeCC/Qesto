#!/usr/bin/env node
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { execSync } from 'child_process';

interface SyncManifest {
  version: 1;
  lastSync: number;
  syncCount: number;
  files: Record<string, { hash: string; vectorCount: number; syncedAt: number }>;
}

interface FileChange {
  path: string;
  status: 'new' | 'modified' | 'deleted';
  hash?: string;
}

const MANIFEST_FILE = '.kb-sync-manifest.json';
const KB_DIR = 'knowledge-base';
const BATCH_SIZE = 200;

function loadManifest(): SyncManifest {
  if (fs.existsSync(MANIFEST_FILE)) {
    return JSON.parse(fs.readFileSync(MANIFEST_FILE, 'utf-8'));
  }
  return {
    version: 1,
    lastSync: 0,
    syncCount: 0,
    files: {},
  };
}

function saveManifest(manifest: SyncManifest): void {
  fs.writeFileSync(MANIFEST_FILE, JSON.stringify(manifest, null, 2));
}

function computeFileHash(filePath: string): string {
  const content = fs.readFileSync(filePath, 'utf-8');
  return crypto.createHash('sha256').update(content).digest('hex');
}

function findKBFiles(): string[] {
  const files: string[] = [];

  function walk(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!entry.name.startsWith('.')) {
          walk(fullPath);
        }
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        files.push(fullPath);
      }
    }
  }

  walk(KB_DIR);
  return files.sort();
}

function detectChanges(): FileChange[] {
  const manifest = loadManifest();
  const currentFiles = findKBFiles();
  const changes: FileChange[] = [];
  const currentHashes = new Set<string>();

  for (const file of currentFiles) {
    currentHashes.add(file);
    const hash = computeFileHash(file);

    if (!manifest.files[file]) {
      changes.push({ path: file, status: 'new', hash });
    } else if (manifest.files[file].hash !== hash) {
      changes.push({ path: file, status: 'modified', hash });
    }
  }

  for (const file of Object.keys(manifest.files)) {
    if (!currentHashes.has(file)) {
      changes.push({ path: file, status: 'deleted' });
    }
  }

  return changes;
}

async function embedFiles(files: string[]): Promise<Map<string, { vectors: Array<{ id: string; values: number[]; metadata: Record<string, unknown> }> }>> {
  if (files.length === 0) {
    return new Map();
  }

  console.log(`\n📝 Embedding ${files.length} file(s)...`);

  try {
    const env = {
      CLOUDFLARE_API_TOKEN: process.env.CLOUDFLARE_API_TOKEN,
      CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID,
      CLOUDFLARE_D1_DATABASE_ID: process.env.CLOUDFLARE_D1_DATABASE_ID,
    };

    const missing = Object.entries(env).filter(([, v]) => !v).map(([k]) => k);
    if (missing.length > 0) {
      throw new Error(`Missing environment variables: ${missing.join(', ')}`);
    }

    // Create a temporary file list for the embed script to process
    const tempList = '.kb-embed-temp-files.json';
    fs.writeFileSync(tempList, JSON.stringify(files));

    // Use the existing embed script with file filtering
    const result = execSync(`npx tsx scripts/embed-kb.ts`, {
      env: { ...process.env, ...env, KB_EMBED_FILES: tempList },
      encoding: 'utf-8',
    });

    fs.unlinkSync(tempList);

    if (!fs.existsSync('.kb-vectors-pending.json')) {
      throw new Error('Embedding failed: no vectors generated');
    }

    const vectors = JSON.parse(fs.readFileSync('.kb-vectors-pending.json', 'utf-8'));
    const byFile = new Map<string, { vectors: Array<{ id: string; values: number[]; metadata: Record<string, unknown> }> }>();

    for (const vec of vectors) {
      const docFile = vec.metadata?.doc_id;
      if (!docFile) continue;

      if (!byFile.has(docFile)) {
        byFile.set(docFile, { vectors: [] });
      }
      byFile.get(docFile)!.vectors.push(vec);
    }

    return byFile;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Embedding failed: ${msg}`);
  }
}

async function uploadVectors(
  vectors: Array<{ id: string; values: number[]; metadata: Record<string, unknown> }>
): Promise<{ success: number; failed: number }> {
  if (vectors.length === 0) {
    return { success: 0, failed: 0 };
  }

  const clientId = process.env.CF_ACCESS_CLIENT_ID;
  const clientSecret = process.env.CF_ACCESS_CLIENT_SECRET;
  const adminKey = process.env.KB_ADMIN_KEY;
  const endpoint = process.env.KB_SYNC_ENDPOINT || 'https://qesto-api.oostelaar.workers.dev/api/admin/kb-sync';

  if (!clientId || !clientSecret || !adminKey) {
    throw new Error('Missing Cloudflare Access credentials (CF_ACCESS_CLIENT_ID, CF_ACCESS_CLIENT_SECRET, KB_ADMIN_KEY)');
  }

  console.log(`\n⬆️  Uploading ${vectors.length} vector(s)...`);

  let success = 0;
  let failed = 0;

  for (let i = 0; i < vectors.length; i += BATCH_SIZE) {
    const batch = vectors.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(vectors.length / BATCH_SIZE);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'cf-access-client-id': clientId,
          'cf-access-client-secret': clientSecret,
          'x-admin-key': adminKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(batch),
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`HTTP ${response.status}: ${body}`);
      }

      const data = (await response.json()) as { data?: { vectors_upserted?: number } };
      const upserted = data.data?.vectors_upserted || batch.length;

      success += upserted;
      console.log(`  ✓ Batch ${batchNum}/${totalBatches}: ${upserted} vectors`);
    } catch (err) {
      failed += batch.length;
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  ✗ Batch ${batchNum}/${totalBatches} failed: ${msg}`);
    }

    // Small delay between batches
    if (i + BATCH_SIZE < vectors.length) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  return { success, failed };
}

async function sync(): Promise<void> {
  console.log('🔄 KB Sync CLI — Phase 4 Automated Update\n');

  const manifest = loadManifest();
  const changes = detectChanges();

  if (changes.length === 0) {
    console.log('✨ No changes detected. Knowledge base is up-to-date.');
    return;
  }

  console.log(`📊 Detected ${changes.length} change(s):`);
  changes.forEach((c) => {
    const prefix = c.status === 'new' ? '➕' : c.status === 'modified' ? '🔄' : '❌';
    console.log(`  ${prefix} ${c.path}`);
  });

  const filesToEmbed = changes.filter((c) => c.status !== 'deleted').map((c) => c.path);

  if (filesToEmbed.length > 0) {
    const vectorsByFile = await embedFiles(filesToEmbed);

    let totalVectors = 0;
    const allVectors: Array<{ id: string; values: number[]; metadata: Record<string, unknown> }> = [];

    for (const [file, data] of vectorsByFile) {
      totalVectors += data.vectors.length;
      allVectors.push(...data.vectors);
      manifest.files[file] = {
        hash: computeFileHash(file),
        vectorCount: data.vectors.length,
        syncedAt: Date.now(),
      };
    }

    const uploadResult = await uploadVectors(allVectors);
    console.log(`\n📈 Upload complete: ${uploadResult.success} successful, ${uploadResult.failed} failed`);

    // Handle deletions (mark in manifest)
    changes.filter((c) => c.status === 'deleted').forEach((c) => {
      delete manifest.files[c.path];
    });

    manifest.lastSync = Date.now();
    manifest.syncCount += 1;
    saveManifest(manifest);

    console.log(`\n✅ Sync complete! (Sync #${manifest.syncCount})`);
  }
}

async function status(): Promise<void> {
  const manifest = loadManifest();
  const changes = detectChanges();

  console.log('📊 KB Sync Status\n');
  console.log(`Last sync: ${manifest.lastSync ? new Date(manifest.lastSync).toISOString() : 'Never'}`);
  console.log(`Total syncs: ${manifest.syncCount}`);
  console.log(`Tracked files: ${Object.keys(manifest.files).length}`);
  console.log(`Total vectors: ${Object.values(manifest.files).reduce((sum, f) => sum + f.vectorCount, 0)}`);
  console.log(`\nPending changes: ${changes.length}`);

  if (changes.length > 0) {
    changes.forEach((c) => {
      const prefix = c.status === 'new' ? '➕' : c.status === 'modified' ? '🔄' : '❌';
      console.log(`  ${prefix} ${c.path}`);
    });
  } else {
    console.log('  (None)');
  }
}

async function reset(): Promise<void> {
  if (fs.existsSync(MANIFEST_FILE)) {
    fs.unlinkSync(MANIFEST_FILE);
    console.log('✅ Manifest reset. Next sync will process all files.');
  } else {
    console.log('ℹ️  No manifest found.');
  }
}

async function main() {
  const cmd = process.argv[2] || 'sync';

  try {
    switch (cmd) {
      case 'sync':
        await sync();
        break;
      case 'status':
        await status();
        break;
      case 'reset':
        await reset();
        break;
      default:
        console.log(`
KB Sync CLI — Phase 4 Automated Knowledge Base Update

Commands:
  sync     - Detect changes and sync to Vectorize (default)
  status   - Show sync status and pending changes
  reset    - Clear sync manifest (forces full re-embed on next sync)

Environment Variables:
  CLOUDFLARE_API_TOKEN         - Cloudflare API token
  CLOUDFLARE_ACCOUNT_ID        - Cloudflare account ID
  CLOUDFLARE_D1_DATABASE_ID    - D1 database ID
  CF_ACCESS_CLIENT_ID          - Cloudflare Access client ID
  CF_ACCESS_CLIENT_SECRET      - Cloudflare Access client secret
  KB_ADMIN_KEY                 - Admin key for KB sync endpoint
  KB_SYNC_ENDPOINT             - Override endpoint URL

Example:
  $ npm run kb:sync                    # Sync changes
  $ npm run kb:sync -- status          # Show status
  $ npm run kb:sync -- reset           # Reset manifest

For production/CI:
  export CLOUDFLARE_API_TOKEN="..." \\
         CLOUDFLARE_ACCOUNT_ID="..." \\
         CLOUDFLARE_D1_DATABASE_ID="..." \\
         CF_ACCESS_CLIENT_ID="..." \\
         CF_ACCESS_CLIENT_SECRET="..." \\
         KB_ADMIN_KEY="..."
  npm run kb:sync
`);
        process.exit(1);
    }
  } catch (err) {
    console.error('\n❌ Error:', err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

main();
