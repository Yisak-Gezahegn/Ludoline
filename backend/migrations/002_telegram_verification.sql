-- Migration 002: Telegram Verification
-- Run: psql -U ludoline_user -d ludoline -f migrations/002_telegram_verification.sql
-- Rollback: psql -U ludoline_user -d ludoline -f migrations/002_telegram_verification_rollback.sql

-- ─── Add Telegram columns to users ─────────────────────────────────────────

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS telegram_id        BIGINT UNIQUE,
  ADD COLUMN IF NOT EXISTS telegram_username  VARCHAR(64),
  ADD COLUMN IF NOT EXISTS telegram_linked_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id);

-- ─── Telegram link sessions ────────────────────────────────────────────────
-- Each session represents one "Verify with Telegram" attempt.
-- The linking_token is sent to the bot via deep link.
-- Status lifecycle: pending → linked → verified | expired | cancelled

CREATE TABLE IF NOT EXISTS telegram_link_sessions (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phone            VARCHAR(20)   NOT NULL,
  linking_token    VARCHAR(128)  UNIQUE NOT NULL,
  token_hmac       VARCHAR(128)  NOT NULL, -- HMAC-SHA256 of linking_token for replay protection
  status           VARCHAR(20)   DEFAULT 'pending'
                   CHECK (status IN ('pending', 'linked', 'verified', 'expired', 'cancelled')),
  telegram_id      BIGINT,
  telegram_username VARCHAR(64),
  otp_hash         VARCHAR(128), -- bcrypt hash of OTP (never plaintext)
  otp_attempts     INT           DEFAULT 0,
  language         VARCHAR(5)    DEFAULT 'en',
  ip_address       INET,
  user_agent       TEXT,
  expires_at       TIMESTAMPTZ   NOT NULL,
  linked_at        TIMESTAMPTZ,
  verified_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ   DEFAULT NOW(),
  updated_at       TIMESTAMPTZ   DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tls_phone         ON telegram_link_sessions(phone);
CREATE INDEX IF NOT EXISTS idx_tls_linking_token ON telegram_link_sessions(linking_token);
CREATE INDEX IF NOT EXISTS idx_tls_status        ON telegram_link_sessions(status);
CREATE INDEX IF NOT EXISTS idx_tls_telegram_id   ON telegram_link_sessions(telegram_id);
CREATE INDEX IF NOT EXISTS idx_tls_expires_at    ON telegram_link_sessions(expires_at);

CREATE TRIGGER update_telegram_link_sessions_updated_at
  BEFORE UPDATE ON telegram_link_sessions
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- ─── Clean up expired sessions (run periodically) ──────────────────────────
CREATE OR REPLACE FUNCTION expire_old_telegram_sessions()
RETURNS void AS $$
BEGIN
  UPDATE telegram_link_sessions
  SET status = 'expired', updated_at = NOW()
  WHERE status = 'pending' AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql;
