-- Closure Court: proof contracts (frozen), proof media, and every assessed submission. Idempotent.
CREATE TABLE IF NOT EXISTS proof_contracts (
  ticket_id   uuid NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  version     int  NOT NULL,
  contract    jsonb NOT NULL,
  sha256      text NOT NULL,
  source      text NOT NULL CHECK (source IN ('gemini', 'template')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ticket_id, version)
);
CREATE TABLE IF NOT EXISTS court_media (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id   uuid NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  submission_id uuid,
  kind        text NOT NULL CHECK (kind IN ('before', 'proof', 'citizen_counter')),
  name        text NOT NULL,
  mime        text NOT NULL,
  bytes       bytea NOT NULL,
  sha256      text NOT NULL,
  hashes      jsonb,
  exif        jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS court_media_ticket_idx ON court_media (ticket_id, created_at);
CREATE TABLE IF NOT EXISTS court_submissions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id     uuid NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  contract_version int NOT NULL,
  submitted_by  text NOT NULL,
  actor_type    text NOT NULL,
  note          text,
  gates         jsonb NOT NULL,
  pass_a        jsonb,
  pass_b        jsonb,
  merged        jsonb NOT NULL,
  verdict       text NOT NULL,
  rule          text NOT NULL,
  next_evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  models        jsonb NOT NULL DEFAULT '{}'::jsonb,
  latency_ms    int,
  ai_called     boolean NOT NULL DEFAULT false,
  media_ids     uuid[] NOT NULL DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS court_submissions_ticket_idx ON court_submissions (ticket_id, created_at);
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_rw') THEN
    GRANT SELECT, INSERT ON proof_contracts TO app_rw;
    GRANT SELECT, INSERT, UPDATE ON court_media, court_submissions TO app_rw;
  END IF;
END $$;
