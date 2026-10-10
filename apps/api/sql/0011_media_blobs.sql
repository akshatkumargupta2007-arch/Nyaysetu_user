-- Photos a citizen attaches, kept in our own database when Cloudinary is not configured. The id stored in
-- media.cloudinary_public_id is then "local_<uuid>" and points at the row here. The government portal never reads
-- this table directly: it asks for one photo at a time over the signed internal door (modules/gov/bridge.ts).
-- Idempotent.
CREATE TABLE IF NOT EXISTS media_blobs (
  public_id   text PRIMARY KEY,
  citizen_id  uuid REFERENCES citizens(id) ON DELETE SET NULL,
  mime        text        NOT NULL CHECK (mime IN ('image/jpeg', 'image/png', 'image/webp')),
  bytes       integer     NOT NULL CHECK (bytes > 0),
  data        bytea       NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_rw') THEN
    GRANT SELECT, INSERT ON media_blobs TO app_rw;
  END IF;
END $$;
