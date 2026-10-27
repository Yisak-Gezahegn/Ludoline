const User = require('../models/User');
const { authenticate, requireProfile } = require('../middleware/auth');
const { query } = require('../config/database');

module.exports = async function userRoutes(fastify) {
  // GET /api/users/leaderboard
  fastify.get('/leaderboard', { preHandler: authenticate }, async (req, reply) => {
    const rows = await User.getLeaderboard(100);
    return reply.send({ success: true, leaderboard: rows });
  });

  // GET /api/users/:username/profile  - public profile
  fastify.get('/:username/profile', async (req, reply) => {
    const user = await User.findByUsername(req.params.username);
    if (!user || !user.is_active) return reply.status(404).send({ success: false, message: 'User not found' });
    return reply.send({
      success: true,
      profile: {
        id: user.id,
        username: user.username,
        avatarUrl: user.avatar_url,
        score: user.score,
        gamesPlayed: user.games_played,
        gamesWon: user.games_won,
        createdAt: user.created_at
      }
    });
  });

  // GET /api/users/me/history  - my match history
  fastify.get('/me/history', { preHandler: [authenticate, requireProfile] }, async (req, reply) => {
    const { limit = 20, offset = 0 } = req.query;
    const res = await query(
      `SELECT rp.finish_order, rp.prize_amount, rp.color, rp.score,
              r.id AS room_id, r.bet_amount, r.max_players, r.started_at, r.finished_at,
              r.status
       FROM room_players rp
       JOIN rooms r ON r.id = rp.room_id
       WHERE rp.user_id = $1
       ORDER BY r.created_at DESC
       LIMIT $2 OFFSET $3`,
      [req.currentUser.id, parseInt(limit), parseInt(offset)]
    );
    return reply.send({ success: true, history: res.rows });
  });

  // PATCH /api/users/me/language
  fastify.patch('/me/language', { preHandler: authenticate }, async (req, reply) => {
    const { language } = req.body;
    if (!['en', 'am', 'or'].includes(language)) {
      return reply.status(400).send({ success: false, message: 'Invalid language' });
    }
    await query('UPDATE users SET language = $1 WHERE id = $2', [language, req.currentUser.id]);
    return reply.send({ success: true, language });
  });
};
