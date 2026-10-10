-- What the photo check found, kept with the picture so an official can see it, and a fingerprint (SHA-256 of the
-- bytes) so the same picture cannot be reused by a different person. Idempotent.
ALTER TABLE media_blobs ADD COLUMN IF NOT EXISTS sha256 text;
ALTER TABLE media_blobs ADD COLUMN IF NOT EXISTS check_verdict text;
ALTER TABLE media_blobs ADD COLUMN IF NOT EXISTS check_confidence real;
ALTER TABLE media_blobs ADD COLUMN IF NOT EXISTS check_reason text;
CREATE INDEX IF NOT EXISTS media_blobs_sha256_idx ON media_blobs (sha256);
