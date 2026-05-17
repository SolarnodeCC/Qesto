-- migrations/0042_kb_vectors.sql
-- ADR-040 Phase 1: Knowledge-base vector embedding pipeline.
-- Mirrors authoritative chunk text + metadata for the KB_VECTORIZE index.
-- Idempotent: uses IF NOT EXISTS so it can be re-applied safely.

CREATE TABLE IF NOT EXISTS kb_documents (
  doc_id          TEXT PRIMARY KEY,             -- frontmatter `id`, e.g. ADR-040
  file_path       TEXT NOT NULL UNIQUE,         -- /knowledge-base/adr/ADR-040-...md (repo-relative)
  type            TEXT NOT NULL,                -- adr | spec | guide | runbook | experiment | unknown
  domain          TEXT NOT NULL,                -- security | ai-context | infrastructure | ...
  category        TEXT,                         -- optional secondary grouping
  status          TEXT NOT NULL,                -- draft | proposed | accepted | deprecated
  version         TEXT,                         -- frontmatter `version`
  owner           TEXT,                         -- frontmatter `owner`
  title           TEXT NOT NULL,                -- first H1 or frontmatter `title`
  tags_json       TEXT NOT NULL DEFAULT '[]',   -- JSON array of tag strings
  relates_to_json TEXT NOT NULL DEFAULT '[]',   -- JSON array of related doc ids
  size_bytes      INTEGER NOT NULL,             -- raw file size on disk
  doc_hash        TEXT NOT NULL,                -- sha256 of full file (frontmatter + body)
  chunk_count     INTEGER NOT NULL,             -- denormalized for fast doc-level reporting
  created_at      INTEGER NOT NULL,             -- epoch ms (first index time)
  updated_at      INTEGER NOT NULL              -- epoch ms (last re-index time)
);

CREATE INDEX IF NOT EXISTS idx_kb_documents_domain ON kb_documents(domain);
CREATE INDEX IF NOT EXISTS idx_kb_documents_type   ON kb_documents(type);
CREATE INDEX IF NOT EXISTS idx_kb_documents_status ON kb_documents(status);

CREATE TABLE IF NOT EXISTS kb_chunks (
  chunk_id       TEXT PRIMARY KEY,              -- {doc_id}#{chunk_index}
  doc_id         TEXT NOT NULL REFERENCES kb_documents(doc_id) ON DELETE CASCADE,
  chunk_index    INTEGER NOT NULL,              -- 0-based position within doc
  heading_path   TEXT,                          -- "Architecture > Runtime > KV"
  start_line     INTEGER,                       -- 1-based line of first char in source
  end_line       INTEGER,                       -- 1-based line of last char in source
  text           TEXT NOT NULL,                 -- rendered chunk text (prompt-ready)
  token_estimate INTEGER NOT NULL,              -- chars / 4 heuristic
  chunk_hash     TEXT NOT NULL,                 -- sha256 of embedding input (NOT raw text)
  vector_id      TEXT NOT NULL,                 -- Vectorize record id == chunk_id
  embedded_at    INTEGER NOT NULL,              -- epoch ms when embedding produced
  UNIQUE(doc_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS idx_kb_chunks_doc   ON kb_chunks(doc_id);
CREATE INDEX IF NOT EXISTS idx_kb_chunks_hash  ON kb_chunks(chunk_hash);
