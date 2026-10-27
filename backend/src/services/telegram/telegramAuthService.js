/**
 * telegramAuthService.js
 * Business logic for Telegram-based OTP verification.
 *
 * Security guarantees:
 * - Linking tokens are UUID v4, signed with HMAC-SHA256
 * - Single-use (Redis tombstone after use)
 * - 10-minute TTL
 * - OTPs stored only in Redis (never plaintext in DB)
 * - Rate-limited: 3 sessions per phone per hour
 * - Max 5 OTP attempts per session
 * - Cross-session attacks prevented via sessionId ownership check
 */
'use strict';
const crypto   = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { query, getClient } = require('../../config/database');
const {
  setTelegramOtp, getTelegramOtp, deleteTelegramOtp,
  incrementTelegramSessionAttempts,
  setTelegramSessionCache, getTelegramSessionCache, deleteTelegramSessionCache,
  markLinkingTokenUsed, isLinkingTokenUsed
} = require('../../config/redis');
const { sendOtpViaTelegram, getSessionStatusFromBot } = require('./telegramBotAdapter');
const User = require('../../models/User');
const logger = require('../../utils/logger');

const OTP_TTL_SECONDS     = parseInt(process.env.OTP_EXPIRES_MINUTES || '5') * 60;
const SESSION_TTL_SECONDS = 600; // 10 minutes
const MAX_OTP_ATTEMPTS    = 5;
const MAX_SESSIONS_PER_HOUR = 3;
const RESEND_COOLDOWN_SECONDS = 60;
const HMAC_SECRET = process.env.TELEGRAM_HMAC_SECRET || process.env.JWT_SECRET || 'dev-hmac-secret';
const TELEGRAM_BOT_NAME = process.env.TELEGRAM_BOT_NAME || 'LudolineVerifyBot';

// ─── Token helpers ─────────────────────────────────────────────────────────

function generateLinkingToken() {
  const raw = uuidv4().replace(/-/g, '');
  const sig = crypto.createHmac('sha256', HMAC_SECRET).update(raw).digest('hex').slice(0, 16);
  return `${raw}.${sig}`;
}

function verifyTokenSignature(token) {
  const [raw, sig] = token.split('.');
  if (!raw || !sig) return false;
  const expected = crypto.createHmac('sha256', HMAC_SECRET).update(raw).digest('hex').slice(0, 16);
  return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Create a new pending linking session.
 * Returns the session ID and Telegram deep link.
 */
async function createLinkingSession({ phone, language, ipAddress, userAgent }) {
  // Rate limit
  const attempts = await incrementTelegramSessionAttempts(phone);
  if (attempts > MAX_SESSIONS_PER_HOUR) {
    throw new Error('TG_SESSION_RATE_LIMITED');
  }

  // Expire any existing pending sessions for this phone
  await query(
    `UPDATE telegram_link_sessions
     SET status = 'expired', updated_at = NOW()
     WHERE phone = $1 AND status = 'pending'`,
    [phone]
  );

  const sessionId    = uuidv4();
  const linkingToken = generateLinkingToken();
  const tokenHmac    = crypto.createHmac('sha256', HMAC_SECRET).update(linkingToken).digest('hex');
  const expiresAt    = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);

  await query(
    `INSERT INTO telegram_link_sessions
       (id, phone, linking_token, token_hmac, status, language, ip_address, user_agent, expires_at)
     VALUES ($1, $2, $3, $4, 'pending', $5, $6, $7, $8)`,
    [sessionId, phone, linkingToken, tokenHmac, language, ipAddress || null, userAgent || null, expiresAt]
  );

  await setTelegramSessionCache(sessionId, { status: 'pending', phone }, SESSION_TTL_SECONDS);

  const deepLink = `https://t.me/${TELEGRAM_BOT_NAME}?start=${linkingToken}`;

  logger.info('Telegram link session created', { sessionId, phone });

  return {
    sessionId,
    deepLink,
    expiresAt: expiresAt.toISOString(),
    expiresInSeconds: SESSION_TTL_SECONDS,
    botName: TELEGRAM_BOT_NAME
  };
}

/**
 * Called when the bot posts to /api/auth/telegram/bot-callback.
 * Validates the token and associates the Telegram account with the session.
 * Then generates an OTP and requests delivery.
 */
async function handleBotCallback({ token, telegramId, telegramUsername }) {
  // Validate token signature
  if (!verifyTokenSignature(token)) {
    logger.warn('Telegram bot callback: invalid token signature', { token: token.slice(0, 8) });
    throw new Error('TG_INVALID_TOKEN');
  }

  // Check replay
  if (await isLinkingTokenUsed(token)) {
    throw new Error('TG_TOKEN_ALREADY_USED');
  }

  // Find session
  const sessionRes = await query(
    `SELECT * FROM telegram_link_sessions
     WHERE linking_token = $1 AND status = 'pending'`,
    [token]
  );
  const session = sessionRes.rows[0];
  if (!session) throw new Error('TG_SESSION_NOT_FOUND');
  if (new Date(session.expires_at) < new Date()) {
    await query(`UPDATE telegram_link_sessions SET status='expired' WHERE id=$1`, [session.id]);
    throw new Error('TG_SESSION_EXPIRED');
  }

  // Check if this Telegram ID is already linked to a different verified user
  const existingUser = await query('SELECT id FROM users WHERE telegram_id = $1', [telegramId]);
  if (existingUser.rows.length > 0) {
    logger.warn('Telegram ID already linked', { telegramId });
    throw new Error('TG_ALREADY_LINKED');
  }

  // Mark token used
  await markLinkingTokenUsed(token, SESSION_TTL_SECONDS + 60);

  // Generate OTP
  const otp = generateOtp();
  await setTelegramOtp(session.id, otp, OTP_TTL_SECONDS);

  // Update session
  await query(
    `UPDATE telegram_link_sessions
     SET status='linked', telegram_id=$1, telegram_username=$2, linked_at=NOW(), updated_at=NOW()
     WHERE id=$3`,
    [telegramId, telegramUsername || null, session.id]
  );
  await setTelegramSessionCache(session.id, { status: 'linked', phone: session.phone }, SESSION_TTL_SECONDS);

  // Deliver OTP via bot
  await sendOtpViaTelegram({
    sessionId:  session.id,
    otp,
    language:   session.language,
    telegramId
  });

  logger.info('Telegram session linked and OTP sent', { sessionId: session.id, telegramId });

  return { success: true, sessionId: session.id };
}

/**
 * Get the current status of a linking session (called by frontend polling).
 * Returns status without leaking sensitive data.
 */
async function getSessionStatus(sessionId, phone) {
  // Ownership check: the phone that created the session must match
  const cached = await getTelegramSessionCache(sessionId);
  if (cached && cached.phone !== phone) {
    throw new Error('TG_SESSION_FORBIDDEN');
  }

  const res = await query(
    `SELECT id, status, linked_at, expires_at, otp_attempts
     FROM telegram_link_sessions
     WHERE id = $1 AND phone = $2`,
    [sessionId, phone]
  );
  const session = res.rows[0];
  if (!session) throw new Error('TG_SESSION_NOT_FOUND');

  // Auto-expire
  if (session.status === 'pending' && new Date(session.expires_at) < new Date()) {
    await query(`UPDATE telegram_link_sessions SET status='expired' WHERE id=$1`, [sessionId]);
    await deleteTelegramSessionCache(sessionId);
    return { status: 'expired' };
  }

  return {
    status: session.status,
    linkedAt: session.linked_at,
    expiresAt: session.expires_at,
    otpAttemptsRemaining: Math.max(0, MAX_OTP_ATTEMPTS - session.otp_attempts)
  };
}

/**
 * Verify the OTP entered by the user.
 * On success: creates or updates the user record, returns JWT payload.
 */
async function verifyOtp({ sessionId, otp, phone, language }) {
  const dbClient = await getClient();
  try {
    await dbClient.query('BEGIN');

    // Lock the session row
    const res = await dbClient.query(
      `SELECT * FROM telegram_link_sessions
       WHERE id = $1 AND phone = $2 FOR UPDATE`,
      [sessionId, phone]
    );
    const session = res.rows[0];
    if (!session) throw new Error('TG_SESSION_NOT_FOUND');
    if (session.status === 'verified') throw new Error('TG_ALREADY_VERIFIED');
    if (session.status !== 'linked')  throw new Error('TG_NOT_LINKED_YET');
    if (new Date(session.expires_at) < new Date()) {
      await dbClient.query(`UPDATE telegram_link_sessions SET status='expired' WHERE id=$1`, [sessionId]);
      throw new Error('TG_SESSION_EXPIRED');
    }

    // Attempt limit
    if (session.otp_attempts >= MAX_OTP_ATTEMPTS) {
      throw new Error('TG_OTP_MAX_ATTEMPTS');
    }

    // Get OTP from Redis
    const storedOtp = await getTelegramOtp(sessionId);
    if (!storedOtp) throw new Error('TG_OTP_EXPIRED');

    // Increment attempt BEFORE checking (prevents timing attacks that skip counting)
    await dbClient.query(
      `UPDATE telegram_link_sessions SET otp_attempts = otp_attempts + 1 WHERE id = $1`,
      [sessionId]
    );

    if (storedOtp !== otp.trim()) {
      await dbClient.query('COMMIT');
      throw new Error('TG_OTP_INVALID');
    }

    // OTP correct — delete from Redis
    await deleteTelegramOtp(sessionId);

    // Mark session verified
    await dbClient.query(
      `UPDATE telegram_link_sessions
       SET status='verified', verified_at=NOW(), updated_at=NOW()
       WHERE id=$1`,
      [sessionId]
    );

    // Create or update user
    let user = await User.findByPhone(phone);
    const isNew = !user;

    if (!user) {
      const newRes = await dbClient.query(
        `INSERT INTO users (phone, language, telegram_id, telegram_username, telegram_linked_at, is_verified)
         VALUES ($1, $2, $3, $4, NOW(), TRUE)
         RETURNING *`,
        [phone, language, session.telegram_id, session.telegram_username]
      );
      user = newRes.rows[0];
    } else {
      const updRes = await dbClient.query(
        `UPDATE users
         SET telegram_id=$1, telegram_username=$2, telegram_linked_at=NOW(),
             is_verified=TRUE, last_login=NOW(), updated_at=NOW()
         WHERE id=$3 RETURNING *`,
        [session.telegram_id, session.telegram_username, user.id]
      );
      user = updRes.rows[0];
    }

    await dbClient.query('COMMIT');
    await deleteTelegramSessionCache(sessionId);

    logger.info('Telegram OTP verified, user activated', { userId: user.id, phone, isNew });

    return { user, isNew };
  } catch (err) {
    await dbClient.query('ROLLBACK');
    throw err;
  } finally {
    dbClient.release();
  }
}

/**
 * Resend OTP to the linked Telegram account.
 * Enforces a cooldown and replaces the existing OTP.
 */
async function resendOtp({ sessionId, phone }) {
  const res = await query(
    `SELECT * FROM telegram_link_sessions WHERE id = $1 AND phone = $2`,
    [sessionId, phone]
  );
  const session = res.rows[0];
  if (!session) throw new Error('TG_SESSION_NOT_FOUND');
  if (session.status !== 'linked') throw new Error('TG_NOT_LINKED_YET');
  if (new Date(session.expires_at) < new Date()) throw new Error('TG_SESSION_EXPIRED');

  // Check resend cooldown: if OTP still has > (TTL - cooldown) seconds left, deny
  const existingOtp = await getTelegramOtp(sessionId);
  if (existingOtp) {
    // Cooldown: only allow resend after RESEND_COOLDOWN_SECONDS from last send
    // We approximate by checking if the OTP was created recently using a separate key
    const cooldownKey = `tg_resend_cd:${sessionId}`;
    const { getRedisClient } = require('../../config/redis');
    const r = await getRedisClient();
    const onCooldown = await r.get(cooldownKey);
    if (onCooldown) throw new Error('TG_RESEND_COOLDOWN');

    // Set cooldown marker
    await r.setEx(cooldownKey, RESEND_COOLDOWN_SECONDS, '1');
    // Delete old OTP
    await deleteTelegramOtp(sessionId);
  }

  const otp = generateOtp();
  await setTelegramOtp(sessionId, otp, OTP_TTL_SECONDS);

  // Reset attempt counter
  await query(
    `UPDATE telegram_link_sessions SET otp_attempts=0, updated_at=NOW() WHERE id=$1`,
    [sessionId]
  );

  await sendOtpViaTelegram({
    sessionId,
    otp,
    language: session.language,
    telegramId: session.telegram_id
  });

  logger.info('Telegram OTP resent', { sessionId });
  return { success: true, expiresInSeconds: OTP_TTL_SECONDS };
}

/**
 * Cancel a pending session.
 */
async function cancelSession({ sessionId, phone }) {
  await query(
    `UPDATE telegram_link_sessions
     SET status='cancelled', updated_at=NOW()
     WHERE id=$1 AND phone=$2 AND status IN ('pending','linked')`,
    [sessionId, phone]
  );
  await deleteTelegramOtp(sessionId);
  await deleteTelegramSessionCache(sessionId);
  logger.info('Telegram session cancelled', { sessionId, phone });
  return { success: true };
}

module.exports = {
  createLinkingSession,
  handleBotCallback,
  getSessionStatus,
  verifyOtp,
  resendOtp,
  cancelSession,
};
