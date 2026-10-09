-- "What we understood" drafts. /reports/understand stores the server's own result here;
-- /reports/confirm reads ONLY this row, so a client can never choose its own category,
-- agency or priority. Idempotent.
CREATE TABLE IF NOT EXISTS report_drafts (
  id         uuid PRIMARY KEY,
  payload    jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS report_drafts_created_idx ON report_drafts (created_at);
