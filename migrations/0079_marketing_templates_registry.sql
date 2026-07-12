-- Marketing template registry (Growth Engine pipeline audit remediation,
-- MKTP-005/009/010/012): queryable metadata + lifecycle state for the public
-- template gallery. The full multilingual TemplateRecord blob stays in
-- MARKETING_KV under template:{id}; this table is the source of truth for
-- listing, filtering, publish state, dedup, and usage counting — replacing the
-- non-atomic KV read-modify-write index lists (templates:index,
-- templates:by-industry:*, templates:by-theme:*, templates:by-lang:*).

CREATE TABLE IF NOT EXISTS marketing_templates (
  id                TEXT    PRIMARY KEY,                          -- tmpl_{nanoid}
  source_session_id TEXT    NOT NULL,
  content_hash      TEXT    NOT NULL UNIQUE,                      -- sha256 of normalized question set; UNIQUE = atomic dedup
  industry          TEXT    NOT NULL,
  theme             TEXT    NOT NULL,
  topic             TEXT    NOT NULL,
  title_en          TEXT    NOT NULL,
  question_count    INTEGER NOT NULL,
  estimated_minutes INTEGER NOT NULL,
  confidence        INTEGER NOT NULL,
  langs             TEXT    NOT NULL DEFAULT 'en',                -- csv of langs with real content
  is_public         INTEGER NOT NULL DEFAULT 0 CHECK (is_public IN (0, 1)),
  is_discarded      INTEGER NOT NULL DEFAULT 0 CHECK (is_discarded IN (0, 1)),
  usage_count       INTEGER NOT NULL DEFAULT 0,
  created_at        INTEGER NOT NULL,                             -- ms epoch
  updated_at        INTEGER NOT NULL                              -- ms epoch; content changes only, never usage bumps
);

CREATE INDEX IF NOT EXISTS idx_mkt_templates_public
  ON marketing_templates(is_public, is_discarded, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mkt_templates_industry ON marketing_templates(industry);
CREATE INDEX IF NOT EXISTS idx_mkt_templates_theme ON marketing_templates(theme);
