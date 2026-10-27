const { getClient } = require('../config/database');
const Room = require('../models/Room');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const { deductBet, creditPrize } = require('./walletService');
const { calculatePrizes } = require('../utils/prizeCalculator');
const { setGameState, getGameState, deleteGameState } = require('../config/redis');
const LudoEngine = require('../game/LudoEngine');
const { COLORS } = require('../game/constants');
const logger = require('../utils/logger');

/**
 * Create a room and deduct bet from creator.
 */
async function createRoom(userId, { betAmount, maxPlayers, isPrivate, name }) {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const room = await Room.create({ betAmount, maxPlayers, isPrivate, name, createdBy: userId });
    const { player } = await Room.addPlayer(room.id, userId, client);

    // Deduct bet
    await deductBet(userId, betAmount, room.id, client);
    await client.query('UPDATE rooms SET total_pot = $1 WHERE id = $2', [betAmount, room.id]);

    await client.query('COMMIT');
    logger.info('Room created', { roomId: room.id, userId });
    return { room, player };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Join a room (deducts bet, adds player).
 */
async function joinRoom(userId, roomId) {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const { player, room, playerCount } = await Room.addPlayer(roomId, userId, client);
    await deductBet(userId, room.bet_amount, room.id, client);
    await client.query(
      'UPDATE rooms SET total_pot = total_pot + $1 WHERE id = $2',
      [room.bet_amount, room.id]
    );

    await client.query('COMMIT');
    logger.info('Player joined room', { roomId, userId });
    return { player, room, playerCount };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Start the game when room is full.
 */
async function startGame(roomId) {
  const players = await Room.getPlayers(roomId);
  const room = await Room.findById(roomId);

  if (!room) throw new Error('ROOM_NOT_FOUND');
  if (players.length < 2) throw new Error('NOT_ENOUGH_PLAYERS');
  if (room.status !== 'waiting') throw new Error('ROOM_NOT_WAITING');

  const playerIds = players.map((p) => p.user_id);
  const playerColors = players.map((p) => p.color);

  const gameState = LudoEngine.createInitialState(playerIds, playerColors);
  gameState.roomId = roomId;
  gameState.betAmount = parseFloat(room.bet_amount);
  gameState.totalPot = parseFloat(room.total_pot);

  // Persist in Redis for real-time access
  await setGameState(roomId, gameState);

  // Update room status
  await Room.updateStatus(roomId, 'playing');
  await Room.saveGameState(roomId, gameState);

  logger.info('Game started', { roomId, players: playerIds.length });
  return gameState;
}

/**
 * Settle prizes after game ends.
 */
async function settleGame(roomId, finishOrder) {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const room = await Room.findById(roomId);
    const totalPot = parseFloat(room.total_pot);
    const playerCount = finishOrder.length;

    const { prizes, platformFee } = calculatePrizes(totalPot, playerCount);

    // Credit prizes
    for (let i = 0; i < finishOrder.length; i++) {
      const { playerId, position } = finishOrder[i];
      const prize = prizes[i] || 0;

      if (prize > 0) {
        await creditPrize(playerId, prize, roomId, client);
      }

      await client.query(
        'UPDATE room_players SET finish_order = $1, prize_amount = $2 WHERE room_id = $3 AND user_id = $4',
        [position, prize, roomId, playerId]
      );

      // Update user stats
      const won = position === 1;
      await client.query(
        `UPDATE users SET
          games_played = games_played + 1,
          games_won = games_won + CASE WHEN $1 THEN 1 ELSE 0 END,
          total_won = total_won + $2,
          score = score + $3
         WHERE id = $4`,
        [won, prize, prizes[i] ? 10 * (4 - i) : 0, playerId]
      );
    }

    // Log platform fee
    await client.query(
      `INSERT INTO transactions (type, amount, status, reference, room_id, metadata)
       VALUES ('platform_fee', $1, 'completed', $2, $3, $4)`,
      [platformFee, `FEE_${roomId}`, roomId, JSON.stringify({ totalPot })]
    );

    await Room.updateStatus(roomId, 'finished');
    await client.query('COMMIT');

    // Clean up Redis
    await deleteGameState(roomId);

    logger.info('Game settled', { roomId, totalPot, platformFee, prizes });
    return { prizes, platformFee };
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('Game settlement failed', { roomId, error: err.message });
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Abandon game and refund all players.
 */
async function abandonGame(roomId, reason = 'inactivity') {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const players = await Room.getPlayers(roomId);
    const room = await Room.findById(roomId);
    const betAmount = parseFloat(room.bet_amount);

    for (const player of players) {
      await creditPrize(player.user_id, betAmount, roomId, client);
    }

    await Room.updateStatus(roomId, 'abandoned');
    await client.query('COMMIT');
    await deleteGameState(roomId);

    logger.info('Game abandoned and refunded', { roomId, reason });
    return true;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { createRoom, joinRoom, startGame, settleGame, abandonGame };
