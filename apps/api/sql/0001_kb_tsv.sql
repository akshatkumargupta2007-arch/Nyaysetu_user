-- Bible §14 kb_chunks.tsv: a generated full-text column for hybrid search (RRF).
-- Drizzle's schema.ts declares `tsv` as a plain text column as a placeholder;
-- this migration turns it into the real generated column if it isn't one yet.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'kb_chunks' AND column_name = 'tsv'
      AND is_generated = 'NEVER'
  ) THEN
    ALTER TABLE kb_chunks DROP COLUMN tsv;
    ALTER TABLE kb_chunks ADD COLUMN tsv tsvector
      GENERATED ALWAYS AS (to_tsvector('simple', body)) STORED;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS kb_chunks_tsv_idx ON kb_chunks USING gin (tsv);
