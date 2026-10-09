-- A ticket the gov portal rejects (for example an unknown city) used to be re-sent every 30 seconds forever,
-- filling gov's error table and, once 200 of them piled up, blocking every newer ticket from syncing.
-- Now a rejected ticket waits, doubling each time (2, 4, 8 ... minutes, at most 24 hours), and is cleared when gov
-- finally accepts it. Idempotent.
ALTER TABLE gov_sync_cursor ADD COLUMN IF NOT EXISTS reject_count int NOT NULL DEFAULT 0;
ALTER TABLE gov_sync_cursor ADD COLUMN IF NOT EXISTS rejected_until timestamptz;
ALTER TABLE gov_sync_cursor ADD COLUMN IF NOT EXISTS reject_reason text;
