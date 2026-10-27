/**
 * telegramAuth.js  —  Fastify routes for Telegram OTP verification
 *
 * Routes:
 *  POST /api/auth/telegram/start-session    — create linking session
 *  GET  /api/auth/telegram/session-status   — poll session status
 *  POST /api/auth/telegram/verify-otp       — submit 6-digit OTP
 *  POST /api/auth/telegram/resend-otp       — resend OTP
 *  POST /api/auth/telegram/cancel           — cancel session
 *  POST /api/auth/telegram/bot-callback     — called by @LudolineVerifyBot only
 */
'use strict';
const {
  createLinkingSession,
  handleBotCallback,
  getSessionStatus,
  verifyOtp,
  resendOtp,
  cancelSession
} = require('../services/telegram/telegramAuthService');
const User = require('../models/User');
const { t } = require('../i18n');
const logger = require('../utils/logger');
const Joi = require('joi');

const ETHIOPIAN_PHONE = /^(\+251|0)(9|7)\d{8}$/;
const BOT_SECRET = process.env.TELEGRAM_BOT_SERVICE_SECRET || '';

// ─── Joi schemas ─────────────────────────────────────────────────────────────

const startSessionSchema = Joi.object({
  phone:    Joi.string().pattern(ETHIOPIAN_PHONE).required(),
  language: Joi.string().valid('en', 'am', 'or').default('en')
});

const sessionStatusSchema = Joi.object({
  sessionId: Joi.string().uuid().required(),
  phone:     Joi.string().pattern(ETHIOPIAN_PHONE).required()
});

const verifyOtpSchema = Joi.object({
  sessionId: Joi.string().uuid().required(),
  otp:       Joi.string().length(6).pattern(/^\d+$/).required(),
  phone:     Joi.string().pattern(ETHIOPIAN_PHONE).required(),
  language:  Joi.string().valid('en', 'am', 'or').default('en')
});

const resendSchema = Joi.object({
  sessionId: Joi.string().uuid().required(),
  phone:     Joi.string().pattern(ETHIOPIAN_PHONE).required()
});

const cancelSchema = Joi.object({
  sessionId: Joi.string().uuid().required(),
  phone:     Joi.string().pattern(ETHIOPIAN_PHONE).required()
});

const botCallbackSchema = Joi.object({
  token:            Joi.string().required(),
  telegramId:       Joi.number().integer().positive().required(),
  telegramUsername: Joi.string().allow('', null).optional()
});

// ─── Helper ──────────────────────────────────────────────────────────────────

async function validateBody(schema, body) {
  return schema.validateAsync(body, { abortEarly: false });
}

// ─── Route plugin ────────────────────────────────────────────────────────────

module.exports = async function telegramAuthRoutes(fastify) {

  // Rate limit this prefix more aggressively (Telegram-specific)
  // Fastify rate-limit is registered globally; specific limits added per route via config

  // ─── POST /api/auth/telegram/start-session ─────────────────────────────
  fastify.post('/start-session', {
    config: { rateLimit: { max: 5, timeWindow: '1 minute' } }
  }, async (req, reply) => {
    let body;
    try { body = await validateBody(startSessionSchema, req.body); }
    catch (err) {
      return reply.status(422).send({ success: false, error: 'VALIDATION_ERROR', details: err.details?.map(d => d.message) });
    }

    const lang = body.language;
    try {
      const result = await createLinkingSession({
        phone:     body.phone,
        language:  lang,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      return reply.send({
        success: true,
        sessionId:        result.sessionId,
        deepLink:         result.deepLink,
        botName:          result.botName,
        expiresAt:        result.expiresAt,
        expiresInSeconds: result.expiresInSeconds
      });
    } catch (err) {
      if (err.message === 'TG_SESSION_RATE_LIMITED') {
        return reply.status(429).send({ success: false, error: 'RATE_LIMITED',
          message: t(lang, 'otp_max_attempts') });
      }
      logger.error('start-session error', { error: err.message });
      return reply.status(500).send({ success: false, error: 'INTERNAL_ERROR',
        message: t(lang, 'error_generic') });
    }
  });

  // ─── GET /api/auth/telegram/session-status ─────────────────────────────
  fastify.get('/session-status', {
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } }
  }, async (req, reply) => {
    let params;
    try {
      params = await validateBody(sessionStatusSchema, {
        sessionId: req.query.sessionId,
        phone:     req.query.phone
      });
    } catch (err) {
      return reply.status(422).send({ success: false, error: 'VALIDATION_ERROR' });
    }

    try {
      const status = await getSessionStatus(params.sessionId, params.phone);
      return reply.send({ success: true, ...status });
    } catch (err) {
      const codeMap = {
        TG_SESSION_NOT_FOUND: [404, 'NOT_FOUND'],
        TG_SESSION_FORBIDDEN: [403, 'FORBIDDEN']
      };
      const [httpStatus, code] = codeMap[err.message] || [500, 'INTERNAL_ERROR'];
      return reply.status(httpStatus).send({ success: false, error: code });
    }
  });

  // ─── POST /api/auth/telegram/verify-otp ───────────────────────────────
  fastify.post('/verify-otp', {
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } }
  }, async (req, reply) => {
    let body;
    try { body = await validateBody(verifyOtpSchema, req.body); }
    catch (err) {
      return reply.status(422).send({ success: false, error: 'VALIDATION_ERROR', details: err.details?.map(d => d.message) });
    }

    const lang = body.language;
    try {
      const { user, isNew } = await verifyOtp({
        sessionId: body.sessionId,
        otp:       body.otp,
        phone:     body.phone,
        language:  lang
      });

      const jwtToken = fastify.jwt.sign(
        { id: user.id, phone: user.phone, role: user.role },
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
      );

      return reply.send({
        success: true,
        token: jwtToken,
        user: {
          id:              user.id,
          phone:           user.phone,
          username:        user.username,
          profileComplete: user.profile_complete,
          language:        user.language,
          role:            user.role,
          telegramLinked:  !!user.telegram_id
        },
        isNew,
        message: isNew ? t(lang, 'register_success') : t(lang, 'login_success')
      });
    } catch (err) {
      const errMap = {
        TG_OTP_INVALID:       [400, 'OTP_INVALID',        t(lang, 'otp_invalid')],
        TG_OTP_EXPIRED:       [400, 'OTP_EXPIRED',        'Verification code has expired. Request a new one.'],
        TG_OTP_MAX_ATTEMPTS:  [429, 'MAX_ATTEMPTS',       'Too many attempts. Please restart verification.'],
        TG_NOT_LINKED_YET:    [400, 'NOT_LINKED',         'Please open @LudolineVerifyBot in Telegram first.'],
        TG_SESSION_EXPIRED:   [400, 'SESSION_EXPIRED',    'Session expired. Please start again.'],
        TG_SESSION_NOT_FOUND: [404, 'NOT_FOUND',          'Verification session not found.'],
        TG_ALREADY_VERIFIED:  [400, 'ALREADY_VERIFIED',   'Already verified.']
      };
      const [status, code, message] = errMap[err.message] || [500, 'INTERNAL_ERROR', t(lang, 'error_generic')];
      logger.warn('verify-otp error', { error: err.message, sessionId: body.sessionId });
      return reply.status(status).send({ success: false, error: code, message });
    }
  });

  // ─── POST /api/auth/telegram/resend-otp ───────────────────────────────
  fastify.post('/resend-otp', {
    config: { rateLimit: { max: 3, timeWindow: '1 minute' } }
  }, async (req, reply) => {
    let body;
    try { body = await validateBody(resendSchema, req.body); }
    catch (err) {
      return reply.status(422).send({ success: false, error: 'VALIDATION_ERROR' });
    }

    try {
      const result = await resendOtp({ sessionId: body.sessionId, phone: body.phone });
      return reply.send({ success: true, expiresInSeconds: result.expiresInSeconds });
    } catch (err) {
      const errMap = {
        TG_RESEND_COOLDOWN:   [429, 'RESEND_COOLDOWN', 'Please wait before requesting another code.'],
        TG_NOT_LINKED_YET:    [400, 'NOT_LINKED',      'Open @LudolineVerifyBot first.'],
        TG_SESSION_EXPIRED:   [400, 'SESSION_EXPIRED', 'Session expired. Start again.'],
        TG_SESSION_NOT_FOUND: [404, 'NOT_FOUND',       'Session not found.']
      };
      const [status, code, message] = errMap[err.message] || [500, 'INTERNAL_ERROR', 'Something went wrong.'];
      return reply.status(status).send({ success: false, error: code, message });
    }
  });

  // ─── POST /api/auth/telegram/cancel ───────────────────────────────────
  fastify.post('/cancel', async (req, reply) => {
    let body;
    try { body = await validateBody(cancelSchema, req.body); }
    catch { return reply.status(422).send({ success: false, error: 'VALIDATION_ERROR' }); }

    await cancelSession({ sessionId: body.sessionId, phone: body.phone }).catch(() => {});
    return reply.send({ success: true });
  });

  // ─── POST /api/auth/telegram/bot-callback ─────────────────────────────
  // Called ONLY by @LudolineVerifyBot service. Protected by shared secret.
  fastify.post('/bot-callback', {
    config: { rateLimit: { max: 60, timeWindow: '1 minute' } }
  }, async (req, reply) => {
    // Verify shared secret
    const incomingSecret = req.headers['x-bot-secret'];
    if (!BOT_SECRET || !incomingSecret || incomingSecret !== BOT_SECRET) {
      logger.warn('Bot callback: invalid secret', { ip: req.ip });
      return reply.status(401).send({ success: false, error: 'UNAUTHORIZED' });
    }

    let body;
    try { body = await validateBody(botCallbackSchema, req.body); }
    catch (err) {
      return reply.status(422).send({ success: false, error: 'VALIDATION_ERROR' });
    }

    try {
      const result = await handleBotCallback({
        token:            body.token,
        telegramId:       body.telegramId,
        telegramUsername: body.telegramUsername
      });
      return reply.send(result);
    } catch (err) {
      const errMap = {
        TG_INVALID_TOKEN:      [400, 'INVALID_TOKEN'],
        TG_TOKEN_ALREADY_USED: [409, 'TOKEN_USED'],
        TG_SESSION_NOT_FOUND:  [404, 'NOT_FOUND'],
        TG_SESSION_EXPIRED:    [400, 'EXPIRED'],
        TG_ALREADY_LINKED:     [409, 'ALREADY_LINKED']
      };
      const [status, code] = errMap[err.message] || [500, 'INTERNAL_ERROR'];
      logger.warn('bot-callback error', { error: err.message });
      return reply.status(status).send({ success: false, error: code });
    }
  });
};
