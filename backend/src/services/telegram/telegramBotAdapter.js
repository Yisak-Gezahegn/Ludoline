/**
 * telegramBotAdapter.js
 * HTTP adapter for communicating with the @LudolineVerifyBot service.
 *
 * The bot is a separate deployed service. All calls are server-to-server.
 * Never expose TELEGRAM_BOT_SERVICE_SECRET or TELEGRAM_BOT_TOKEN to the browser.
 *
 * Bot Service Contract (implement in @LudolineVerifyBot):
 * ─────────────────────────────────────────────────────
 * POST /bot/otp/send
 *   Header: x-service-secret: <TELEGRAM_BOT_SERVICE_SECRET>
 *   Body:   { sessionId, otp, language, telegramId }
 *   200:    { delivered: true, messageId: "..." }
 *   4xx:    { delivered: false, reason: "..." }
 *
 * GET /bot/session/:sessionId/status
 *   Header: x-service-secret: <TELEGRAM_BOT_SERVICE_SECRET>
 *   200:    { status: "pending"|"linked"|"expired", telegramId, telegramUsername }
 *
 * The bot calls back to Ludoline at:
 * POST /api/auth/telegram/bot-callback
 *   Header: x-bot-secret: <TELEGRAM_BOT_SERVICE_SECRET>
 *   Body:   { token, telegramId, telegramUsername }
 */
'use strict';
const axios = require('axios');
const logger = require('../../utils/logger');

const BOT_SERVICE_URL    = process.env.TELEGRAM_BOT_SERVICE_URL || 'http://localhost:4000';
const BOT_SERVICE_SECRET = process.env.TELEGRAM_BOT_SERVICE_SECRET || '';
const TIMEOUT_MS         = 8000;

const botClient = axios.create({
  baseURL: BOT_SERVICE_URL,
  timeout: TIMEOUT_MS,
  headers: {
    'Content-Type': 'application/json',
    'x-service-secret': BOT_SERVICE_SECRET
  }
});

botClient.interceptors.response.use(
  (r) => r,
  (err) => {
    logger.error('Telegram bot service error', {
      url: err.config?.url,
      status: err.response?.status,
      data: err.response?.data,
      message: err.message
    });
    return Promise.reject(err);
  }
);

/**
 * Request OTP delivery to a Telegram user.
 * @param {object} opts
 * @param {string} opts.sessionId
 * @param {string} opts.otp         - 6-digit OTP
 * @param {string} opts.language    - 'en' | 'am' | 'or'
 * @param {number} opts.telegramId  - Telegram user ID
 * @returns {Promise<{delivered: boolean, messageId?: string}>}
 */
async function sendOtpViaTelegram({ sessionId, otp, language, telegramId }) {
  if (!BOT_SERVICE_SECRET) {
    // Dev mode: log OTP instead of calling bot
    logger.info(`[DEV TELEGRAM OTP] sessionId=${sessionId} telegramId=${telegramId} otp=${otp}`);
    return { delivered: true, messageId: 'dev-mock' };
  }

  try {
    const res = await botClient.post('/bot/otp/send', {
      sessionId,
      otp,
      language,
      telegramId
    });
    return res.data;
  } catch (err) {
    const reason = err.response?.data?.reason || 'DELIVERY_FAILED';
    throw new Error(`TELEGRAM_DELIVERY_FAILED:${reason}`);
  }
}

/**
 * Get the current linking status of a session from the bot service.
 * Used as a fallback if the bot callback hasn't arrived yet.
 * @param {string} sessionId
 * @returns {Promise<{status: string, telegramId?: number, telegramUsername?: string}>}
 */
async function getSessionStatusFromBot(sessionId) {
  if (!BOT_SERVICE_SECRET) {
    // Dev mode: return mock
    return { status: 'pending' };
  }

  try {
    const res = await botClient.get(`/bot/session/${sessionId}/status`);
    return res.data;
  } catch (err) {
    if (err.response?.status === 404) return { status: 'not_found' };
    throw new Error('BOT_STATUS_UNAVAILABLE');
  }
}

module.exports = { sendOtpViaTelegram, getSessionStatusFromBot };
