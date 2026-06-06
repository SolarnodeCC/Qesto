-- Verify kb_chunks.vector_json column exists after additive migration.
SELECT COUNT(*) AS ok FROM pragma_table_info('kb_chunks') WHERE name = 'vector_json';
