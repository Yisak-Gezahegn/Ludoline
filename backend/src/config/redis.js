const { createClient } = require('redis');
const logger = require('../utils/logger');

let client;

const getRedisClient = async () => {
  if (client && client.isOpen) return client;

  client = createClient({
    socket: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT) || 6379,
      reconnectStrategy: (retries) => {
        if (retries > 10) {
          logger.error('Redis: max reconnect attempts reached');
          return new Error('Too many Redis reconnect attempts');
        }
        return Math.min(retries * 100, 3000);
      }
    },
    password: process.env.REDIS_PASSWORD || undefined
  });

  client.on('error', (err) => logger.error('Redis client error', { error: err.message }));
  client.on('connect', () => logger.info('Redis connected'));
  client.on('reconnecting', () => logger.warn('Redis reconnecting...'));

  await client.connect();
  return client;
};

// Game state helpers
const setGameState = async (roomId, state, ttlSeconds = 3600) => {
  const r = await getRedisClient();
  await r.setEx(`game:${roomId}`, ttlSeconds, JSON.stringify(state));
};

const getGameState = async (roomId) => {
  const r = await getRedisClient();
  const data = await r.get(`game:${roomId}`);
  return data ? JSON.parse(data) : null;
};

const deleteGameState = async (roomId) => {
  const r = await getRedisClient();
  await r.del(`game:${roomId}`);
};

// OTP helpers
const setOtp = async (phone, otp, ttlSeconds = 300) => {
  const r = await getRedisClient();
  await r.setEx(`otp:${phone}`, ttlSeconds, otp);
};

const getOtp = async (phone) => {
  const r = await getRedisClient();
  return r.get(`otp:${phone}`);
};

const deleteOtp = async (phone) => {
  const r = await getRedisClient();
  await r.del(`otp:${phone}`);
};

// Rate limiting for OTP send
const incrementOtpAttempts = async (phone) => {
  const r = await getRedisClient();
  const key = `otp_attempts:${phone}`;
  const count = await r.incr(key);
  if (count === 1) await r.expire(key, 3600); // reset after 1 hour
  return count;
};

// ─── Telegram verification session helpers ─────────────────────────────────

/**
 * Store a Telegram OTP in Redis (never the raw OTP in DB).
 * Key: tg_otp:<sessionId>
 */
const setTelegramOtp = async (sessionId, otp, ttlSeconds = 300) => {
  const r = await getRedisClient();
  await r.setEx(`tg_otp:${sessionId}`, ttlSeconds, otp);
};

const getTelegramOtp = async (sessionId) => {
  const r = await getRedisClient();
  return r.get(`tg_otp:${sessionId}`);
};

const deleteTelegramOtp = async (sessionId) => {
  const r = await getRedisClient();
  await r.del(`tg_otp:${sessionId}`);
};

/**
 * Rate-limit Telegram link session creation per phone.
 * Max 3 sessions per phone per hour.
 */
const incrementTelegramSessionAttempts = async (phone) => {
  const r = await getRedisClient();
  const key = `tg_session_attempts:${phone}`;
  const count = await r.incr(key);
  if (count === 1) await r.expire(key, 3600);
  return count;
};

/**
 * Cache session status for fast polling (avoids DB hits on every poll).
 * TTL: 5 minutes (sessions expire in 10 min)
 */
const setTelegramSessionCache = async (sessionId, data, ttlSeconds = 300) => {
  const r = await getRedisClient();
  await r.setEx(`tg_session:${sessionId}`, ttlSeconds, JSON.stringify(data));
};

const getTelegramSessionCache = async (sessionId) => {
  const r = await getRedisClient();
  const raw = await r.get(`tg_session:${sessionId}`);
  return raw ? JSON.parse(raw) : null;
};

const deleteTelegramSessionCache = async (sessionId) => {
  const r = await getRedisClient();
  await r.del(`tg_session:${sessionId}`);
};

/**
 * Mark a linking token as used (replay protection).
 * TTL slightly longer than session lifetime.
 */
const markLinkingTokenUsed = async (token, ttlSeconds = 700) => {
  const r = await getRedisClient();
  await r.setEx(`tg_token_used:${token}`, ttlSeconds, '1');
};

const isLinkingTokenUsed = async (token) => {
  const r = await getRedisClient();
  return !!(await r.get(`tg_token_used:${token}`));
};

module.exports = {
  getRedisClient,
  setGameState,
  getGameState,
  deleteGameState,
  setOtp,
  getOtp,
  deleteOtp,
  incrementOtpAttempts,
  // Telegram
  setTelegramOtp,
  getTelegramOtp,
  deleteTelegramOtp,
  incrementTelegramSessionAttempts,
  setTelegramSessionCache,
  getTelegramSessionCache,
  deleteTelegramSessionCache,
  markLinkingTokenUsed,
  isLinkingTokenUsed,
};
