-- jankurai:allow HLT-030-SQL-BAD-BEHAVIOR reason=d1-sqlite-no-concurrent-index expires=2027-06-01
-- migrations/0043_kb_vectors_storage.sql
-- ADR-040 Phase 1: Add vector storage column to kb_chunks for embedding persistence.
-- Safety: Additive column, no data loss.
-- Metadata: migrations/.metadata/0043_kb_vectors_storage.json
--
-- NOTE: D1 is SQLite. PostgreSQL session settings (SET/RESET lock_timeout,
-- statement_timeout) are not supported and were removed — they caused
-- `wrangler d1 migrations apply` to fail with a "near \"SET\"" syntax error.

ALTER TABLE kb_chunks ADD COLUMN vector_json TEXT;
-- vector_json stores the 1024-dim embedding as JSON array, set after Workers AI embedding succeeds
