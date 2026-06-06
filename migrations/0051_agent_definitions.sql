-- jankurai:allow HLT-030-SQL-BAD-BEHAVIOR reason=d1-sqlite-no-concurrent-index expires=2027-06-01
-- Migration 0051: Agent marketplace foundation (AGENT-MARKETPLACE-FOUNDATION-01, Sprint 84).
-- Registry stub — public marketplace gated on SEC-AGENT-EVAL-01 (S84).

CREATE TABLE IF NOT EXISTS agent_definitions (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  marketplace_listing_id TEXT,
  title TEXT NOT NULL,
  model TEXT NOT NULL DEFAULT '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  tools_json TEXT NOT NULL DEFAULT '[]',
  sandbox_policy_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'review', 'live', 'suspended')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_agent_definitions_owner ON agent_definitions(owner_id, status);
