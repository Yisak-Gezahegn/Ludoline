/**
 * Ludoline Socket.IO Game Handler
 * Manages real-time game events: joining rooms, rolling dice, moving pieces, chat.
 */

const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { getGameState, setGameState } = require('../config/redis');
const LudoEngine = require('../game/LudoEngine');
const { GAME_STATE, TURN_TIMEOUT_SECONDS } = require('../game/constants');
const Room = require('../models/Room');
const User = require('../models/User');
const { startGame, settleGame, abandonGame } = require('../services/gameService');
const { query } = require('../config/database');
const logger = require('../utils/logger');

// Turn timers per room
const turnTimers = {};

function setupSocket(server) {
  const io = new Server(server, {
    cors: {
      origin: [process.env.WEB_APP_URL || 'http://localhost:3000', '*'],
      methods: ['GET', 'POST'],
      credentials: true
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 30000,
    pingInterval: 10000
  });

  // ─── Auth middleware ─────────────────────────────────────────────────────
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
      if (!token) return next(new Error('AUTH_REQUIRED'));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id);
      if (!user || !user.is_active) return next(new Error('AUTH_INVALID'));

      socket.user = { id: user.id, username: user.username, language: user.language };
      next();
    } catch {
      next(new Error('AUTH_INVALID'));
    }
  });

  io.on('connection', (socket) => {
    logger.info('Socket connected', { userId: socket.user.id, socketId: socket.id });

    // ─── JOIN ROOM ─────────────────────────────────────────────────────────
    socket.on('room:join', async ({ roomId }) => {
      try {
        const room = await Room.findById(roomId);
        if (!room) return socket.emit('error', { code: 'ROOM_NOT_FOUND' });

        socket.join(`room:${roomId}`);
        socket.roomId = roomId;

        const players = await Room.getPlayers(roomId);
        io.to(`room:${roomId}`).emit('room:players_updated', { players });

        // Auto-start if room is full
        if (players.length === room.max_players && room.status === 'waiting') {
          const gameState = await startGame(roomId);
          io.to(`room:${roomId}`).emit('game:started', { gameState });
          startTurnTimer(io, roomId, gameState.currentPlayerId);
        } else if (room.status === 'playing') {
          const gameState = await getGameState(roomId);
          if (gameState) socket.emit('game:state', { gameState });
        }

        logger.info('Player joined socket room', { userId: socket.user.id, roomId });
      } catch (err) {
        logger.error('room:join error', { error: err.message });
        socket.emit('error', { code: err.message });
      }
    });

    // ─── LEAVE ROOM ────────────────────────────────────────────────────────
    socket.on('room:leave', async ({ roomId }) => {
      socket.leave(`room:${roomId}`);
      const remaining = await Room.removePlayer(roomId, socket.user.id);
      io.to(`room:${roomId}`).emit('room:player_left', { userId: socket.user.id, remaining });

      const room = await Room.findById(roomId);
      if (room?.status === 'playing') {
        // Handle mid-game leave
        let state = await getGameState(roomId);
        if (state) {
          const result = LudoEngine.skipTurn(state, socket.user.id);
          state = result.newState;
          await setGameState(roomId, state);
        }
      } else if (remaining === 0) {
        await Room.updateStatus(roomId, 'abandoned');
      }
    });

    // ─── ROLL DICE ─────────────────────────────────────────────────────────
    socket.on('game:roll_dice', async ({ roomId }) => {
      try {
        let state = await getGameState(roomId);
        if (!state) return socket.emit('error', { code: 'GAME_NOT_FOUND' });

        if (!LudoEngine.canRoll(state, socket.user.id)) {
          return socket.emit('error', { code: 'NOT_YOUR_TURN' });
        }

        const diceValue = LudoEngine.rollDice();
        state.diceValue = diceValue;
        state.diceRolled = true;
        state.players[socket.user.id].skipCount = 0; // reset skip on action

        // Get movable pieces
        const movablePieces = LudoEngine.getMovablePieces(state, socket.user.id, diceValue);

        await setGameState(roomId, state);

        io.to(`room:${roomId}`).emit('game:dice_rolled', {
          playerId: socket.user.id,
          diceValue,
          movablePieces
        });

        // If no movable pieces, auto-skip
        if (movablePieces.length === 0) {
          setTimeout(async () => {
            const latestState = await getGameState(roomId);
            if (!latestState || latestState.diceRolled === false) return;

            const { newState, events } = LudoEngine.skipTurn(latestState, socket.user.id);
            await setGameState(roomId, newState);
            io.to(`room:${roomId}`).emit('game:turn_skipped', { playerId: socket.user.id, events });
            io.to(`room:${roomId}`).emit('game:next_turn', { playerId: newState.currentPlayerId });
            startTurnTimer(io, roomId, newState.currentPlayerId);
          }, 2000);
        } else {
          // Restart turn timer for move
          resetTurnTimer(io, roomId, socket.user.id, state);
        }
      } catch (err) {
        logger.error('game:roll_dice error', { error: err.message });
      }
    });

    // ─── MOVE PIECE ────────────────────────────────────────────────────────
    socket.on('game:move_piece', async ({ roomId, pieceId }) => {
      try {
        let state = await getGameState(roomId);
        if (!state) return socket.emit('error', { code: 'GAME_NOT_FOUND' });

        if (!LudoEngine.canMove(state, socket.user.id, pieceId, state.diceValue)) {
          return socket.emit('error', { code: 'INVALID_MOVE' });
        }

        clearTurnTimer(roomId);

        const { newState, events } = LudoEngine.applyMove(state, socket.user.id, pieceId, state.diceValue);
        await setGameState(roomId, newState);
        await Room.saveGameState(roomId, newState);

        io.to(`room:${roomId}`).emit('game:move_applied', { events, gameState: newState });

        // Handle game over
        if (newState.gameState === GAME_STATE.FINISHED) {
          const finishOrder = events.find((e) => e.type === 'GAME_OVER')?.finishOrder || [];
          io.to(`room:${roomId}`).emit('game:over', { finishOrder });
          await settleGame(roomId, finishOrder);
          return;
        }

        if (newState.gameState === GAME_STATE.ABANDONED) {
          io.to(`room:${roomId}`).emit('game:abandoned', { reason: 'inactivity' });
          await abandonGame(roomId, 'inactivity');
          return;
        }

        // Next turn
        io.to(`room:${roomId}`).emit('game:next_turn', { playerId: newState.currentPlayerId });
        startTurnTimer(io, roomId, newState.currentPlayerId);
      } catch (err) {
        logger.error('game:move_piece error', { error: err.message });
      }
    });

    // ─── CHAT ──────────────────────────────────────────────────────────────
    socket.on('chat:send', async ({ roomId, message }) => {
      if (!message || message.trim().length === 0 || message.length > 200) return;

      // Save to DB
      await query(
        'INSERT INTO chat_messages (room_id, user_id, message) VALUES ($1, $2, $3)',
        [roomId, socket.user.id, message.trim()]
      );

      io.to(`room:${roomId}`).emit('chat:message', {
        userId: socket.user.id,
        username: socket.user.username,
        message: message.trim(),
        timestamp: new Date().toISOString()
      });
    });

    // ─── DISCONNECT ────────────────────────────────────────────────────────
    socket.on('disconnect', async () => {
      logger.info('Socket disconnected', { userId: socket.user.id, socketId: socket.id });
      if (socket.roomId) {
        io.to(`room:${socket.roomId}`).emit('room:player_disconnected', { userId: socket.user.id });
      }
    });
  });

  return io;
}

// ─── Turn Timer helpers ──────────────────────────────────────────────────────

function startTurnTimer(io, roomId, playerId) {
  clearTurnTimer(roomId);
  turnTimers[roomId] = setTimeout(async () => {
    try {
      const state = await getGameState(roomId);
      if (!state || state.currentPlayerId !== playerId) return;

      const { newState, events } = LudoEngine.skipTurn(state, playerId);
      await setGameState(roomId, newState);

      if (newState.gameState === GAME_STATE.ABANDONED) {
        io.to(`room:${roomId}`).emit('game:abandoned', { reason: 'inactivity' });
        await abandonGame(roomId, 'inactivity');
        return;
      }

      io.to(`room:${roomId}`).emit('game:turn_timeout', { playerId, events });
      io.to(`room:${roomId}`).emit('game:next_turn', { playerId: newState.currentPlayerId });
      startTurnTimer(io, roomId, newState.currentPlayerId);
    } catch (err) {
      logger.error('Turn timer error', { roomId, error: err.message });
    }
  }, TURN_TIMEOUT_SECONDS * 1000);
}

function resetTurnTimer(io, roomId, playerId, state) {
  clearTurnTimer(roomId);
  startTurnTimer(io, roomId, playerId);
}

function clearTurnTimer(roomId) {
  if (turnTimers[roomId]) {
    clearTimeout(turnTimers[roomId]);
    delete turnTimers[roomId];
  }
}

module.exports = { setupSocket };
