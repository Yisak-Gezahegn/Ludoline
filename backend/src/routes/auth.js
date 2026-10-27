const { requestOTP, verifyOTP } = require('../services/authService');
const User = require('../models/User');
const { validate } = require('../utils/validators');
const { authenticate } = require('../middleware/auth');
const { t } = require('../i18n');

module.exports = async function authRoutes(fastify) {
  // POST /api/auth/request-otp
  fastify.post('/request-otp', { preHandler: validate('registerOTP') }, async (req, reply) => {
    const { phone, language } = req.body;
    try {
      await requestOTP(phone, language);
      return reply.send({ success: true, message: t(language, 'otp_sent') });
    } catch (err) {
      const code = err.message;
      if (code === 'OTP_MAX_ATTEMPTS') {
        return reply.status(429).send({ success: false, message: t(language, 'otp_max_attempts') });
      }
      return reply.status(500).send({ success: false, message: t(language, 'error_generic') });
    }
  });

  // POST /api/auth/verify-otp
  fastify.post('/verify-otp', { preHandler: validate('verifyOTP') }, async (req, reply) => {
    const { phone, otp } = req.body;
    try {
      const { user, isNew } = await verifyOTP(phone, otp, 'en');
      const token = fastify.jwt.sign(
        { id: user.id, phone: user.phone, role: user.role },
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
      );
      return reply.send({
        success: true,
        token,
        user: {
          id: user.id,
          phone: user.phone,
          username: user.username,
          profileComplete: user.profile_complete,
          language: user.language,
          role: user.role
        },
        isNew,
        message: isNew ? t(user.language, 'register_success') : t(user.language, 'login_success')
      });
    } catch (err) {
      if (err.message === 'OTP_INVALID') {
        return reply.status(400).send({ success: false, message: t('en', 'otp_invalid') });
      }
      return reply.status(500).send({ success: false, message: t('en', 'error_generic') });
    }
  });

  // POST /api/auth/complete-profile
  fastify.post('/complete-profile',
    { preHandler: [authenticate, validate('completeProfile')] },
    async (req, reply) => {
      const { username, fullName, language } = req.body;
      try {
        // Check username uniqueness
        const existing = await User.findByUsername(username);
        if (existing && existing.id !== req.currentUser.id) {
          return reply.status(409).send({ success: false, message: 'Username already taken' });
        }

        const user = await User.completeProfile(req.currentUser.id, { username, fullName, language });
        return reply.send({ success: true, user });
      } catch (err) {
        return reply.status(500).send({ success: false, message: t(language, 'error_generic') });
      }
    }
  );

  // GET /api/auth/me
  fastify.get('/me', { preHandler: authenticate }, async (req, reply) => {
    const profile = await User.getProfile(req.currentUser.id);
    return reply.send({ success: true, user: profile });
  });
};
