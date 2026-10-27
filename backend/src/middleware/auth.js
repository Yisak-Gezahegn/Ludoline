const User = require('../models/User');

/**
 * Fastify JWT auth middleware.
 * Attach to routes that require authentication.
 */
async function authenticate(request, reply) {
  try {
    await request.jwtVerify();
    const user = await User.findById(request.user.id);
    if (!user || !user.is_active) {
      return reply.status(401).send({ statusCode: 401, error: 'Unauthorized', message: 'Account not found or disabled' });
    }
    request.currentUser = user;
  } catch (err) {
    return reply.status(401).send({ statusCode: 401, error: 'Unauthorized', message: 'Invalid or expired token' });
  }
}

/**
 * Require a completed profile.
 */
async function requireProfile(request, reply) {
  if (!request.currentUser?.profile_complete) {
    return reply.status(403).send({
      statusCode: 403,
      error: 'Profile Incomplete',
      message: 'Please complete your profile first'
    });
  }
}

/**
 * Admin-only middleware.
 */
async function requireAdmin(request, reply) {
  if (request.currentUser?.role !== 'admin') {
    return reply.status(403).send({ statusCode: 403, error: 'Forbidden', message: 'Admin access required' });
  }
}

module.exports = { authenticate, requireProfile, requireAdmin };
