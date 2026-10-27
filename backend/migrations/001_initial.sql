-- Ludoline Database Schema
-- Run: psql -U ludoline_user -d ludoline -f migrations/001_initial.sql

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── USERS ─────────────────────────────────────────────────────────────────

CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phone         VARCHAR(20)  UNIQUE NOT NULL,
  username      VARCHAR(30)  UNIQUE,
  full_name     VARCHAR(80),
  avatar_url    TEXT,
  language      VARCHAR(5)   DEFAULT 'en' CHECK (language IN ('en', 'am', 'or')),
  role          VARCHAR(20)  DEFAULT 'player' CHECK (role IN ('player', 'admin', 'support')),
  is_active     BOOLEAN      DEFAULT TRUE,
  is_verified   BOOLEAN      DEFAULT FALSE,
  profile_complete BOOLEAN   DEFAULT FALSE,
  balance       NUMERIC(12,2) DEFAULT 0.00 CHECK (balance >= 0),
  total_won     NUMERIC(12,2) DEFAULT 0.00,
  total_lost    NUMERIC(12,2) DEFAULT 0.00,
  games_played  INT          DEFAULT 0,
  games_won     INT          DEFAULT 0,
  score         INT          DEFAULT 0,
  created_at    TIMESTAMPTZ  DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  DEFAULT NOW(),
  last_login    TIMESTAMPTZ
);

CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_users_username ON users(username);

-- ─── ROOMS ─────────────────────────────────────────────────────────────────

CREATE TABLE rooms (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code          VARCHAR(8)   UNIQUE NOT NULL,  -- invite code for private rooms
  name          VARCHAR(60),
  created_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  is_private    BOOLEAN      DEFAULT FALSE,
  max_players   INT          DEFAULT 4 CHECK (max_players BETWEEN 2 AND 4),
  current_players INT        DEFAULT 0,
  bet_amount    NUMERIC(10,2) NOT NULL CHECK (bet_amount >= 2 AND bet_amount <= 10000),
  total_pot     NUMERIC(12,2) DEFAULT 0.00,
  status        VARCHAR(20)  DEFAULT 'waiting'
                CHECK (status IN ('waiting', 'starting', 'playing', 'finished', 'abandoned')),
  game_state    JSONB,       -- full LudoEngine state stored here
  created_at    TIMESTAMPTZ  DEFAULT NOW(),
  started_at    TIMESTAMPTZ,
  finished_at   TIMESTAMPTZ
);

CREATE INDEX idx_rooms_status ON rooms(status);
CREATE INDEX idx_rooms_code ON rooms(code);

-- ─── ROOM PLAYERS ──────────────────────────────────────────────────────────

CREATE TABLE room_players (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id       UUID REFERENCES rooms(id) ON DELETE CASCADE,
  user_id       UUID REFERENCES users(id) ON DELETE CASCADE,
  color         VARCHAR(10)  CHECK (color IN ('red', 'green', 'yellow', 'blue')),
  seat_index    INT,         -- 0–3
  finish_order  INT,         -- 1st, 2nd, 3rd, 4th
  prize_amount  NUMERIC(10,2) DEFAULT 0.00,
  score         INT          DEFAULT 0,
  joined_at     TIMESTAMPTZ  DEFAULT NOW(),
  UNIQUE (room_id, user_id),
  UNIQUE (room_id, color)
);

-- ─── TRANSACTIONS ──────────────────────────────────────────────────────────

CREATE TABLE transactions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
  type            VARCHAR(20)  NOT NULL
                  CHECK (type IN ('deposit', 'withdrawal', 'bet_deduct', 'prize_credit', 'platform_fee', 'refund')),
  amount          NUMERIC(12,2) NOT NULL,
  balance_before  NUMERIC(12,2),
  balance_after   NUMERIC(12,2),
  status          VARCHAR(20)  DEFAULT 'pending'
                  CHECK (status IN ('pending', 'completed', 'failed', 'reversed')),
  reference       VARCHAR(100) UNIQUE,  -- Telebirr transaction reference
  room_id         UUID REFERENCES rooms(id) ON DELETE SET NULL,
  metadata        JSONB,
  created_at      TIMESTAMPTZ  DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_reference ON transactions(reference);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_type ON transactions(type);

-- ─── CHAT MESSAGES ─────────────────────────────────────────────────────────

CREATE TABLE chat_messages (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id     UUID REFERENCES rooms(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  message     TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_chat_room_id ON chat_messages(room_id);

-- ─── NOTIFICATIONS ─────────────────────────────────────────────────────────

CREATE TABLE notifications (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  type        VARCHAR(40),
  title       JSONB,   -- { en: "...", am: "...", or: "..." }
  body        JSONB,
  is_read     BOOLEAN DEFAULT FALSE,
  metadata    JSONB,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);

-- ─── AUDIT LOG ─────────────────────────────────────────────────────────────

CREATE TABLE audit_logs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  action      VARCHAR(60) NOT NULL,
  entity      VARCHAR(40),
  entity_id   UUID,
  ip_address  INET,
  user_agent  TEXT,
  metadata    JSONB,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_action ON audit_logs(action);

-- ─── LEADERBOARD VIEW ──────────────────────────────────────────────────────

CREATE VIEW leaderboard AS
  SELECT
    u.id,
    u.username,
    u.avatar_url,
    u.score,
    u.games_played,
    u.games_won,
    u.total_won,
    RANK() OVER (ORDER BY u.score DESC) AS rank
  FROM users u
  WHERE u.is_active = TRUE AND u.profile_complete = TRUE
  ORDER BY u.score DESC;

-- ─── UPDATED_AT TRIGGER ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at
  BEFORE UPDATE ON transactions
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
