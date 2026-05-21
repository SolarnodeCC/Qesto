-- migrations/0043_kb_vectors_storage.sql
-- ADR-040 Phase 1: Add vector storage column to kb_chunks for embedding persistence.
-- Safety: Additive column, no data loss. PostgreSQL: Set lock/statement timeouts.
-- Metadata: migrations/.metadata/0043_kb_vectors_storage.json

SET lock_timeout = '5s';
SET statement_timeout = '30s';

ALTER TABLE kb_chunks ADD COLUMN vector_json TEXT;
-- vector_json stores the 1024-dim embedding as JSON array, set after Workers AI embedding succeeds

RESET lock_timeout;
RESET statement_timeout;
