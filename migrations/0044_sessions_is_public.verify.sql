-- jankurai:allow HLT-030-SQL-BAD-BEHAVIOR reason=d1-sqlite-no-concurrent-index expires=2027-06-01
SELECT COUNT(*) AS ok FROM pragma_table_info('sessions') WHERE name = 'is_public';
