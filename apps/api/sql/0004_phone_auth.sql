-- Build map #D8: citizens are phone accounts (Phone + OTP, no passwords).
-- Idempotent; applied after the drizzle migrations by migrate.ts.

-- The abandoned username/password experiment (drizzle/0002) is not part of the spec.
ALTER TABLE citizens DROP CONSTRAINT IF EXISTS citizens_username_unique;
ALTER TABLE citizens DROP COLUMN IF EXISTS username;
ALTER TABLE citizens DROP COLUMN IF EXISTS password_hash;

ALTER TABLE citizens ALTER COLUMN device_token_hash DROP NOT NULL;

-- One account per phone number.
CREATE UNIQUE INDEX IF NOT EXISTS citizens_phone_hash_uq
  ON citizens (phone_hash) WHERE phone_hash IS NOT NULL;

-- Short-lived one-time codes. Only a salted hash of the code is stored.
CREATE TABLE IF NOT EXISTS otp_codes (
  id          bigserial PRIMARY KEY,
  phone_hash  text        NOT NULL,
  code_hash   text        NOT NULL,
  expires_at  timestamptz NOT NULL,
  attempts    integer     NOT NULL DEFAULT 0,
  consumed_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS otp_codes_phone_idx ON otp_codes (phone_hash, created_at DESC);
