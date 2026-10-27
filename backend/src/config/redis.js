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

module.exports = {
  getRedisClient,
  setGameState,
  getGameState,
  deleteGameState,
  setOtp,
  getOtp,
  deleteOtp,
  incrementOtpAttempts
};
