-- CA2: tables for the bridge to the separate government portal (NyaySetu_Gov). Idempotent.
-- gov_nonces      : replay defence for signed requests that arrive FROM the gov portal
-- gov_sync_cursor : the last event seq of each ticket that gov has acknowledged (push sync, citizen -> gov)
-- gov_close_requests : idempotency + the 24 h rate limit memory for "close request" write-backs
CREATE TABLE IF NOT EXISTS gov_nonces (
  nonce text PRIMARY KEY,
  at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS gov_nonces_at_idx ON gov_nonces (at);

CREATE TABLE IF NOT EXISTS gov_sync_cursor (
  ticket_id uuid PRIMARY KEY REFERENCES tickets (id) ON DELETE CASCADE,
  acked_seq int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS gov_close_requests (
  idempotency_key text PRIMARY KEY,
  ticket_id uuid NOT NULL REFERENCES tickets (id) ON DELETE CASCADE,
  gov_user_id text NOT NULL,
  event_seq int,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS gov_close_requests_ticket_idx ON gov_close_requests (ticket_id, created_at DESC);

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'app_rw') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON gov_nonces, gov_sync_cursor, gov_close_requests TO app_rw;
  END IF;
END $$;
