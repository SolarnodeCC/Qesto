#!/usr/bin/env node
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

interface HelpSyncManifest {
  version: 1;
  lastSync: number;
  syncCount: number;
  files: Record<string, { hash: string; docId: string; syncedAt: number }>;
}

interface FileChange {
  path: string;
  status: 'new' | 'modified' | 'deleted';
  hash?: string;
}

interface HelpDocumentFrontmatter {
  id: string;
  title: string;
  topic: string;
  scope: 'free' | 'starter' | 'team';
  excerpt: string;
}

const MANIFEST_FILE = '.help-sync-manifest.json';
const HELP_DIR = 'knowledge-base/help';

function loadManifest(): HelpSyncManifest {
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

function saveManifest(manifest: HelpSyncManifest): void {
  fs.writeFileSync(MANIFEST_FILE, JSON.stringify(manifest, null, 2));
}

function computeFileHash(filePath: string): string {
  const content = fs.readFileSync(filePath, 'utf-8');
  return crypto.createHash('sha256').update(content).digest('hex');
}

function parseYamlFrontmatter(content: string): { frontmatter: HelpDocumentFrontmatter; body: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) {
    throw new Error('Invalid markdown: missing YAML frontmatter');
  }

  const yamlStr = match[1];
  const body = match[2];

  const frontmatter: Partial<HelpDocumentFrontmatter> = {};

  for (const line of yamlStr.split('\n')) {
    const [key, ...valueParts] = line.split(':');
    if (!key || !valueParts.length) continue;

    const value = valueParts.join(':').trim().replace(/^["']|["']$/g, '');
    switch (key.trim()) {
      case 'id':
        frontmatter.id = value;
        break;
      case 'title':
        frontmatter.title = value;
        break;
      case 'topic':
        frontmatter.topic = value;
        break;
      case 'scope':
        frontmatter.scope = value as 'free' | 'starter' | 'team';
        break;
      case 'excerpt':
        frontmatter.excerpt = value;
        break;
    }
  }

  const required: (keyof HelpDocumentFrontmatter)[] = ['id', 'title', 'topic', 'scope', 'excerpt'];
  for (const key of required) {
    if (!frontmatter[key]) {
      throw new Error(`Missing required field in frontmatter: ${key}`);
    }
  }

  return { frontmatter: frontmatter as HelpDocumentFrontmatter, body };
}

function findHelpFiles(): string[] {
  if (!fs.existsSync(HELP_DIR)) {
    return [];
  }

  const files = fs.readdirSync(HELP_DIR, { withFileTypes: true });
  return files
    .filter((f) => f.isFile() && f.name.endsWith('.md'))
    .map((f) => path.join(HELP_DIR, f.name))
    .sort();
}

function detectChanges(): FileChange[] {
  const manifest = loadManifest();
  const currentFiles = findHelpFiles();
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

async function embedDocumentWithCF(text: string): Promise<number[]> {
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;

  if (!apiToken || !accountId) {
    throw new Error('Missing CLOUDFLARE_API_TOKEN or CLOUDFLARE_ACCOUNT_ID');
  }

  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/baai/bge-m3`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Cloudflare API error: ${response.status} ${body}`);
  }

  const data = (await response.json()) as {
    result?: { data?: Array<{ embeddings?: number[] }> } | { embeddings?: number[] };
  };
  const result = data.result as any
  const embeddings = result?.data?.[0]?.embeddings || result?.embeddings

  if (!embeddings || !Array.isArray(embeddings)) {
    throw new Error('Invalid embedding response from Cloudflare');
  }

  if (embeddings.length !== 1024) {
    throw new Error(`Expected 1024-dim vector (bge-m3), got ${embeddings.length}`);
  }

  return embeddings;
}

async function upsertToVectorize(
  vector: { id: string; values: number[]; metadata: Record<string, unknown> }
): Promise<void> {
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;

  if (!apiToken || !accountId) {
    throw new Error('Missing CLOUDFLARE_API_TOKEN or CLOUDFLARE_ACCOUNT_ID');
  }

  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/vectorize/indexes/qesto-help/upsert`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ vectors: [vector] }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Vectorize upsert failed: ${response.status} ${body}`);
  }
}

async function upsertToD1(doc: HelpDocumentFrontmatter & { content: string }): Promise<void> {
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const databaseId = process.env.CLOUDFLARE_D1_DATABASE_ID;

  if (!apiToken || !accountId || !databaseId) {
    throw new Error('Missing CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, or CLOUDFLARE_D1_DATABASE_ID');
  }

  const now = Math.floor(Date.now() / 1000);

  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`;

  const sql = `
    INSERT OR REPLACE INTO help_documents (id, title, content, topic, scope, excerpt, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sql,
      params: [doc.id, doc.title, doc.content, doc.topic, doc.scope, doc.excerpt, now, now],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`D1 upsert failed: ${response.status} ${body}`);
  }
}

async function syncFile(filePath: string, dryRun: boolean = false): Promise<{ success: boolean; docId?: string; error?: string }> {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const { frontmatter, body } = parseYamlFrontmatter(content);

    console.log(`  📄 Processing ${path.basename(filePath)}: ${frontmatter.title}`);

    if (dryRun) {
      console.log(`    [DRY RUN] Would sync: ${frontmatter.id}`);
      return { success: true, docId: frontmatter.id };
    }

    // Embed the title + content
    console.log(`    🔄 Embedding...`);
    const fullText = `${frontmatter.title}\n${frontmatter.excerpt}\n\n${body}`;
    const embedding = await embedDocumentWithCF(fullText);

    // Generate vector ID
    const vectorId = `help-${frontmatter.id}-${Date.now()}`;

    // Upsert to Vectorize
    console.log(`    📤 Upserting to Vectorize...`);
    await upsertToVectorize({
      id: vectorId,
      values: embedding,
      metadata: {
        document_id: frontmatter.id,
        title: frontmatter.title,
        topic: frontmatter.topic,
        scope: frontmatter.scope,
      },
    });

    // Upsert to D1
    console.log(`    💾 Upserting to D1...`);
    await upsertToD1({
      ...frontmatter,
      content: body,
    });

    console.log(`    ✅ Done`);
    return { success: true, docId: frontmatter.id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`    ❌ Error: ${msg}`);
    return { success: false, error: msg };
  }
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const force = process.argv.includes('--force');

  console.log(`🚀 Help Docs Sync - ${dryRun ? '[DRY RUN]' : '[LIVE]'}`);
  console.log();

  const manifest = loadManifest();
  let changes = detectChanges();

  if (force) {
    console.log(`⚠️  Force mode: re-syncing all files\n`);
    changes = findHelpFiles().map((path) => ({
      path,
      status: 'modified' as const,
      hash: computeFileHash(path),
    }));
  }

  if (changes.length === 0) {
    console.log('✨ No changes detected');
    return;
  }

  console.log(`📊 Changes detected: ${changes.length}`);
  for (const change of changes) {
    console.log(`   ${change.status.toUpperCase()}: ${path.basename(change.path)}`);
  }
  console.log();

  // Process changes
  let synced = 0;
  let failed = 0;

  for (const change of changes) {
    if (change.status === 'deleted') {
      console.log(`  🗑️  Skipping deletion: ${change.path} (manual cleanup required)`);
      continue;
    }

    const result = await syncFile(change.path, dryRun);
    if (result.success) {
      synced++;
      if (!dryRun) {
        manifest.files[change.path] = {
          hash: change.hash!,
          docId: result.docId!,
          syncedAt: Date.now(),
        };
      }
    } else {
      failed++;
    }
  }

  console.log();
  console.log(`📈 Summary: ${synced} synced, ${failed} failed`);

  if (!dryRun) {
    manifest.lastSync = Date.now();
    manifest.syncCount++;
    saveManifest(manifest);
    console.log(`💾 Manifest updated`);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
