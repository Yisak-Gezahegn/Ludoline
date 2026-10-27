require('dotenv').config();
const Fastify = require('fastify');
const { createServer } = require('http');
const logger = require('./utils/logger');
const { setupSocket } = require('./socket/gameSocket');
const { getRedisClient } = require('./config/redis');
const { pool } = require('./config/database');

// ─── Fastify instance ───────────────────────────────────────────────────────
const fastify = Fastify({
  logger: process.env.NODE_ENV !== 'production',
  trustProxy: true
});

// ─── Plugins ────────────────────────────────────────────────────────────────
fastify.register(require('@fastify/helmet'), {
  contentSecurityPolicy: false
});

fastify.register(require('@fastify/cors'), {
  origin: [process.env.WEB_APP_URL || 'http://localhost:3000', /ludoline/],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
});

fastify.register(require('@fastify/rate-limit'), {
  max: 200,
  timeWindow: '1 minute',
  skipOnError: true
});

fastify.register(require('@fastify/jwt'), {
  secret: process.env.JWT_SECRET || 'dev_secret_change_in_prod'
});

// ─── Routes ─────────────────────────────────────────────────────────────────
fastify.register(require('./routes/auth'), { prefix: '/api/auth' });
fastify.register(require('./routes/telegramAuth'), { prefix: '/api/auth/telegram' });
fastify.register(require('./routes/wallet'), { prefix: '/api/wallet' });
fastify.register(require('./routes/rooms'), { prefix: '/api/rooms' });
fastify.register(require('./routes/users'), { prefix: '/api/users' });

// ─── Health check ────────────────────────────────────────────────────────────
fastify.get('/health', async () => ({
  status: 'ok',
  service: 'ludoline-backend',
  timestamp: new Date().toISOString()
}));

// ─── 404 handler ─────────────────────────────────────────────────────────────
fastify.setNotFoundHandler((request, reply) => {
  reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Route not found' });
});

// ─── Error handler ───────────────────────────────────────────────────────────
fastify.setErrorHandler((error, request, reply) => {
  logger.error('Unhandled error', { error: error.message, stack: error.stack, url: request.url });
  const statusCode = error.statusCode || 500;
  reply.status(statusCode).send({
    statusCode,
    error: error.name || 'Internal Server Error',
    message: process.env.NODE_ENV === 'production' ? 'An error occurred' : error.message
  });
});

// ─── Start server ────────────────────────────────────────────────────────────
async function start() {
  try {
    // Connect Redis
    await getRedisClient();
    logger.info('Redis connected');

    // Test DB
    await pool.query('SELECT 1');
    logger.info('PostgreSQL connected');

    // Build HTTP server + attach Socket.IO
    const server = createServer(fastify.server);
    const io = setupSocket(server);
    fastify.io = io;

    await fastify.listen({
      port: parseInt(process.env.PORT) || 3001,
      host: process.env.HOST || '0.0.0.0'
    });

    logger.info(`Ludoline backend running on port ${process.env.PORT || 3001}`);
  } catch (err) {
    logger.error('Server startup failed', { error: err.message });
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received. Shutting down...');
  await fastify.close();
  await pool.end();
  process.exit(0);
});

process.on('SIGINT', async () => {
  await fastify.close();
  process.exit(0);
});

start();
