-- Rollback Migration 002
DROP TABLE IF EXISTS telegram_link_sessions;
ALTER TABLE users
  DROP COLUMN IF EXISTS telegram_id,
  DROP COLUMN IF EXISTS telegram_username,
  DROP COLUMN IF EXISTS telegram_linked_at;
DROP FUNCTION IF EXISTS expire_old_telegram_sessions();
