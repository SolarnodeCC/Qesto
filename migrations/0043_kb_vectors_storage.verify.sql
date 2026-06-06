-- jankurai:allow HLT-030-SQL-BAD-BEHAVIOR reason=d1-sqlite-no-concurrent-index expires=2027-06-01
-- Verify kb_chunks.vector_json column exists after additive migration.
SELECT COUNT(*) AS ok FROM pragma_table_info('kb_chunks') WHERE name = 'vector_json';
