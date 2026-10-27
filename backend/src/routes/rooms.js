const { createRoom, joinRoom } = require('../services/gameService');
const Room = require('../models/Room');
const { authenticate, requireProfile } = require('../middleware/auth');
const { validate } = require('../utils/validators');
const { t } = require('../i18n');

module.exports = async function roomRoutes(fastify) {
  // GET /api/rooms  - list public waiting rooms
  fastify.get('/', { preHandler: [authenticate, requireProfile] }, async (req, reply) => {
    const rooms = await Room.getPublicRooms();
    return reply.send({ success: true, rooms });
  });

  // POST /api/rooms  - create room
  fastify.post('/',
    { preHandler: [authenticate, requireProfile, validate('createRoom')] },
    async (req, reply) => {
      const lang = req.currentUser.language || 'en';
      try {
        const { betAmount, maxPlayers, isPrivate, name } = req.body;

        // Check balance
        if (parseFloat(req.currentUser.balance) < betAmount) {
          return reply.status(400).send({ success: false, message: t(lang, 'insufficient_balance') });
        }

        const { room } = await createRoom(req.currentUser.id, { betAmount, maxPlayers, isPrivate, name });
        return reply.status(201).send({
          success: true,
          message: t(lang, 'room_created'),
          room: { id: room.id, code: room.code, betAmount: room.bet_amount, maxPlayers: room.max_players, isPrivate: room.is_private }
        });
      } catch (err) {
        return reply.status(400).send({ success: false, message: err.message });
      }
    }
  );

  // GET /api/rooms/:code  - get room by code
  fastify.get('/:code', { preHandler: authenticate }, async (req, reply) => {
    const room = await Room.findByCode(req.params.code);
    if (!room) return reply.status(404).send({ success: false, message: t('en', 'room_not_found') });
    const players = await Room.getPlayers(room.id);
    return reply.send({ success: true, room, players });
  });

  // POST /api/rooms/:id/join  - join room
  fastify.post('/:id/join', { preHandler: [authenticate, requireProfile] }, async (req, reply) => {
    const lang = req.currentUser.language || 'en';
    const room = await Room.findById(req.params.id);
    if (!room) return reply.status(404).send({ success: false, message: t(lang, 'room_not_found') });
    if (room.status !== 'waiting') return reply.status(400).send({ success: false, message: t(lang, 'room_started') });
    if (parseFloat(req.currentUser.balance) < parseFloat(room.bet_amount)) {
      return reply.status(400).send({ success: false, message: t(lang, 'insufficient_balance') });
    }

    try {
      const result = await joinRoom(req.currentUser.id, room.id);
      return reply.send({ success: true, message: t(lang, 'joined_room'), ...result });
    } catch (err) {
      const msgMap = {
        ROOM_FULL: 'room_full',
        ROOM_STARTED: 'room_started',
        INSUFFICIENT_BALANCE: 'insufficient_balance',
        ALREADY_IN_ROOM: 'joined_room'
      };
      const msgKey = msgMap[err.message] || 'error_generic';
      return reply.status(400).send({ success: false, message: t(lang, msgKey) });
    }
  });

  // GET /api/rooms/:id/players
  fastify.get('/:id/players', { preHandler: authenticate }, async (req, reply) => {
    const players = await Room.getPlayers(req.params.id);
    return reply.send({ success: true, players });
  });
};
