-- migrations/0043_kb_vectors_storage.sql
-- ADR-040 Phase 1: Add vector storage column to kb_chunks for embedding persistence.

ALTER TABLE kb_chunks ADD COLUMN vector_json TEXT;
-- vector_json stores the 1024-dim embedding as JSON array, set after Workers AI embedding succeeds
