#!/usr/bin/env node
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { execSync } from 'child_process';
import { z } from 'zod';

// Validate vectorize API responses at the boundary (HLT-031, #686).
const UpsertResponseSchema = z.object({
  data: z.object({ vectors_upserted: z.number().optional() }).optional(),
});
const DeleteResponseSchema = z.object({
  data: z.object({ vectors_deleted: z.number().optional() }).optional(),
});

interface SyncManifest {
  version: 1;
  lastSync: number;
  syncCount: number;
  files: Record<string, { hash: string; vectorCount: number; syncedAt: number; vectorIds?: string[] }>;
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
  const empty: SyncManifest = { version: 1, lastSync: 0, syncCount: 0, files: {} };
  if (!fs.existsSync(MANIFEST_FILE)) return empty;
  try {
    const raw = JSON.parse(fs.readFileSync(MANIFEST_FILE, 'utf-8'));
    // Be defensive: CI historically wrote a `{status:'unavailable'}` fallback
    // stub with no `files` key. Normalise so `manifest.files[...]` never throws.
    return {
      version: 1,
      lastSync: typeof raw?.lastSync === 'number' ? raw.lastSync : 0,
      syncCount: typeof raw?.syncCount === 'number' ? raw.syncCount : 0,
      files: raw?.files && typeof raw.files === 'object' ? raw.files : {},
    };
  } catch {
    return empty;
  }
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

    
    const tempList = '.kb-embed-temp-files.json';
    fs.writeFileSync(tempList, JSON.stringify(files));

    // Use the existing embed script with file filtering
    execSync(`npx tsx scripts/embed-kb.ts`, {
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
      // Key by the repo-relative file path (carried in `document.file_path`),
      // NOT doc_id. detectChanges()/the manifest are keyed by path, and sync()
      // calls computeFileHash() on this key — a doc_id there throws ENOENT and
      // silently aborts the whole sync (which is why the manifest never
      // persisted). Fall back to doc_id only for legacy vector-only records.
      const docFile: string | undefined = vec.document?.file_path ?? vec.metadata?.doc_id;
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
): Promise<{ success: number; failed: number; vectorIds: string[] }> {
  if (vectors.length === 0) {
    return { success: 0, failed: 0, vectorIds: [] };
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
  const uploadedIds: string[] = [];

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

      const parsed = UpsertResponseSchema.safeParse(await response.json());
      const upserted = (parsed.success ? parsed.data.data?.vectors_upserted : undefined) || batch.length;

      success += upserted;
      batch.forEach((v) => uploadedIds.push(v.id));
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

  return { success, failed, vectorIds: uploadedIds };
}

async function notifySlack(message: string, details?: Record<string, unknown>): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    return;
  }

  try {
    const payload = {
      text: message,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: message,
          },
        },
      ],
    };

    if (details) {
      (payload.blocks as any[]).push({
        type: 'section',
        fields: Object.entries(details).map(([key, value]) => ({
          type: 'mrkdwn',
          text: `*${key}*\n\`${String(value)}\``,
        })),
      });
    }

    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error('Failed to send Slack notification:', err);
  }
}

async function deleteVectors(vectorIds: string[]): Promise<{ success: number; failed: number }> {
  if (vectorIds.length === 0) {
    return { success: 0, failed: 0 };
  }

  const clientId = process.env.CF_ACCESS_CLIENT_ID;
  const clientSecret = process.env.CF_ACCESS_CLIENT_SECRET;
  const adminKey = process.env.KB_ADMIN_KEY;
  const endpoint = process.env.KB_SYNC_ENDPOINT || 'https://qesto-api.oostelaar.workers.dev/api/admin/kb-sync';

  if (!clientId || !clientSecret || !adminKey) {
    throw new Error('Missing Cloudflare Access credentials');
  }

  console.log(`\n🗑️  Deleting ${vectorIds.length} vector(s)...`);

  let success = 0;
  let failed = 0;

  for (let i = 0; i < vectorIds.length; i += BATCH_SIZE) {
    const batch = vectorIds.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(vectorIds.length / BATCH_SIZE);

    try {
      const response = await fetch(`${endpoint}-delete`, {
        method: 'POST',
        headers: {
          'cf-access-client-id': clientId,
          'cf-access-client-secret': clientSecret,
          'x-admin-key': adminKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ vector_ids: batch }),
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`HTTP ${response.status}: ${body}`);
      }

      const parsed = DeleteResponseSchema.safeParse(await response.json());
      const deleted = (parsed.success ? parsed.data.data?.vectors_deleted : undefined) || batch.length;

      success += deleted;
      console.log(`  ✓ Batch ${batchNum}/${totalBatches}: ${deleted} vectors deleted`);
    } catch (err) {
      failed += batch.length;
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  ✗ Batch ${batchNum}/${totalBatches} delete failed: ${msg}`);
    }

    if (i + BATCH_SIZE < vectorIds.length) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  return { success, failed };
}

async function sync(deleteVectorsFlag = true): Promise<void> {
  console.log('🔄 KB Sync CLI — Phase 5 Automated Update\n');

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
  const filesToDelete = changes.filter((c) => c.status === 'deleted');

  let uploadSuccess = 0;
  let uploadFailed = 0;
  let deleteSuccess = 0;
  let deleteFailed = 0;

  // Handle uploads
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
        vectorIds: data.vectors.map((v) => v.id),
      };
    }

    const uploadResult = await uploadVectors(allVectors);
    uploadSuccess = uploadResult.success;
    uploadFailed = uploadResult.failed;
    console.log(`\n📈 Upload complete: ${uploadResult.success} successful, ${uploadResult.failed} failed`);
  }

  // Handle deletions
  if (deleteVectorsFlag && filesToDelete.length > 0) {
    const vectorIdsToDelete: string[] = [];
    for (const file of filesToDelete) {
      const fileEntry = manifest.files[file.path];
      if (fileEntry?.vectorIds) {
        vectorIdsToDelete.push(...fileEntry.vectorIds);
      }
      delete manifest.files[file.path];
    }

    if (vectorIdsToDelete.length > 0) {
      const deleteResult = await deleteVectors(vectorIdsToDelete);
      deleteSuccess = deleteResult.success;
      deleteFailed = deleteResult.failed;
      console.log(`\n🗑️  Delete complete: ${deleteResult.success} successful, ${deleteResult.failed} failed`);
    } else {
      console.log('\n🗑️  No vectors to delete (not tracked in manifest)');
    }
  } else if (filesToDelete.length > 0) {
    console.log('\n⚠️  Skipping vector deletion (use --delete flag)');
    filesToDelete.forEach((c) => {
      delete manifest.files[c.path];
    });
  }

  manifest.lastSync = Date.now();
  manifest.syncCount += 1;
  saveManifest(manifest);

  console.log(`\n✅ Sync complete! (Sync #${manifest.syncCount})`);
  if (uploadFailed > 0 || deleteFailed > 0) {
    console.log(`⚠️  Some operations failed. Please review and re-run if needed.`);

    // Send failure notification
    await notifySlack(
      '❌ KB Sync Failed',
      {
        'Sync #': manifest.syncCount,
        'Uploaded': uploadSuccess,
        'Upload Failures': uploadFailed,
        'Deleted': deleteSuccess,
        'Delete Failures': deleteFailed,
        'Timestamp': new Date(manifest.lastSync).toISOString(),
      }
    );
  } else if (uploadSuccess > 0 || deleteSuccess > 0) {
    // Send success notification
    await notifySlack(
      '✅ KB Sync Successful',
      {
        'Sync #': manifest.syncCount,
        'Vectors Uploaded': uploadSuccess,
        'Vectors Deleted': deleteSuccess,
        'Total Changes': changes.length,
        'Timestamp': new Date(manifest.lastSync).toISOString(),
      }
    );
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
  const hasDeleteFlag = process.argv.includes('--delete') || process.argv.includes('-d');

  try {
    switch (cmd) {
      case 'sync':
        await sync(hasDeleteFlag);
        break;
      case 'status':
        await status();
        break;
      case 'reset':
        await reset();
        break;
      default:
        console.log(`
KB Sync CLI — Phase 5 Automated Knowledge Base Update

Commands:
  sync     - Detect changes and sync to Vectorize (default)
  status   - Show sync status and pending changes
  reset    - Clear sync manifest (forces full re-embed on next sync)

Flags:
  --delete, -d  - Delete vectors for deleted KB files (default: true)

Environment Variables (Required):
  CLOUDFLARE_API_TOKEN         - Cloudflare API token
  CLOUDFLARE_ACCOUNT_ID        - Cloudflare account ID
  CLOUDFLARE_D1_DATABASE_ID    - D1 database ID
  CF_ACCESS_CLIENT_ID          - Cloudflare Access client ID
  CF_ACCESS_CLIENT_SECRET      - Cloudflare Access client secret
  KB_ADMIN_KEY                 - Admin key for KB sync endpoint

Environment Variables (Optional):
  KB_SYNC_ENDPOINT             - Override endpoint URL
  SLACK_WEBHOOK_URL            - Slack webhook for notifications (Phase 5)

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
