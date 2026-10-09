-- Bolo (the ElevenLabs voice agent): one row per voice session the API hands out, so a citizen has a daily cap
-- (agent minutes are billed). Holds no speech, no text, nothing but who and when. Idempotent.
CREATE TABLE IF NOT EXISTS agent_sessions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  citizen_id  uuid NOT NULL REFERENCES citizens(id) ON DELETE CASCADE,
  lang        text NOT NULL,
  started_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS agent_sessions_citizen_day_idx ON agent_sessions (citizen_id, started_at DESC);
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_rw') THEN
    GRANT SELECT, INSERT ON agent_sessions TO app_rw;
  END IF;
END $$;
