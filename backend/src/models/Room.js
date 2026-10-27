const { query, getClient } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

// Generate a short unique room code
function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

const COLORS = ['red', 'green', 'yellow', 'blue'];

class Room {
  static async create({ betAmount, maxPlayers, isPrivate, name, createdBy }) {
    let code;
    let attempts = 0;
    // Ensure unique code
    while (attempts < 10) {
      code = generateCode();
      const existing = await query('SELECT id FROM rooms WHERE code = $1', [code]);
      if (existing.rows.length === 0) break;
      attempts++;
    }

    const res = await query(
      `INSERT INTO rooms (code, name, created_by, is_private, max_players, bet_amount)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [code, name || `Room ${code}`, createdBy, isPrivate, maxPlayers, betAmount]
    );
    return res.rows[0];
  }

  static async findById(id) {
    const res = await query('SELECT * FROM rooms WHERE id = $1', [id]);
    return res.rows[0] || null;
  }

  static async findByCode(code) {
    const res = await query('SELECT * FROM rooms WHERE code = $1', [code.toUpperCase()]);
    return res.rows[0] || null;
  }

  static async getPublicRooms() {
    const res = await query(
      `SELECT r.*, 
              COUNT(rp.id) AS player_count,
              ARRAY_AGG(json_build_object('username', u.username, 'avatar_url', u.avatar_url)) AS players
       FROM rooms r
       LEFT JOIN room_players rp ON rp.room_id = r.id
       LEFT JOIN users u ON u.id = rp.user_id
       WHERE r.is_private = FALSE AND r.status = 'waiting'
       GROUP BY r.id
       ORDER BY r.created_at DESC
       LIMIT 50`
    );
    return res.rows;
  }

  static async getPlayers(roomId) {
    const res = await query(
      `SELECT rp.*, u.username, u.full_name, u.avatar_url, u.score
       FROM room_players rp
       JOIN users u ON u.id = rp.user_id
       WHERE rp.room_id = $1
       ORDER BY rp.seat_index ASC`,
      [roomId]
    );
    return res.rows;
  }

  static async addPlayer(roomId, userId, client) {
    const db = client || { query: (text, params) => query(text, params) };

    // Get room info
    const roomRes = await db.query('SELECT * FROM rooms WHERE id = $1 FOR UPDATE', [roomId]);
    const room = roomRes.rows[0];
    if (!room) throw new Error('ROOM_NOT_FOUND');
    if (room.status !== 'waiting') throw new Error('ROOM_STARTED');

    // Check capacity
    const playersRes = await db.query('SELECT * FROM room_players WHERE room_id = $1', [roomId]);
    const existing = playersRes.rows;
    if (existing.length >= room.max_players) throw new Error('ROOM_FULL');

    // Check already joined
    if (existing.find((p) => p.user_id === userId)) throw new Error('ALREADY_IN_ROOM');

    // Assign color
    const usedColors = existing.map((p) => p.color);
    const availableColor = COLORS.find((c) => !usedColors.includes(c));

    const seatIndex = existing.length;

    const res = await db.query(
      `INSERT INTO room_players (room_id, user_id, color, seat_index)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [roomId, userId, availableColor, seatIndex]
    );

    // Update room player count
    await db.query(
      `UPDATE rooms SET current_players = $1 WHERE id = $2`,
      [existing.length + 1, roomId]
    );

    return { player: res.rows[0], room, playerCount: existing.length + 1 };
  }

  static async removePlayer(roomId, userId) {
    await query('DELETE FROM room_players WHERE room_id = $1 AND user_id = $2', [roomId, userId]);
    const countRes = await query('SELECT COUNT(*) FROM room_players WHERE room_id = $1', [roomId]);
    const count = parseInt(countRes.rows[0].count);
    await query('UPDATE rooms SET current_players = $1 WHERE id = $2', [count, roomId]);
    return count;
  }

  static async updateStatus(id, status) {
    const res = await query(
      `UPDATE rooms SET status = $1,
        started_at = CASE WHEN $1 = 'playing' THEN NOW() ELSE started_at END,
        finished_at = CASE WHEN $1 = 'finished' OR $1 = 'abandoned' THEN NOW() ELSE finished_at END
       WHERE id = $2 RETURNING *`,
      [status, id]
    );
    return res.rows[0];
  }

  static async saveGameState(id, gameState) {
    await query('UPDATE rooms SET game_state = $1 WHERE id = $2', [JSON.stringify(gameState), id]);
  }

  static async setFinishOrder(roomId, userId, finishOrder, prizeAmount) {
    await query(
      `UPDATE room_players SET finish_order = $1, prize_amount = $2
       WHERE room_id = $3 AND user_id = $4`,
      [finishOrder, prizeAmount, roomId, userId]
    );
  }

  static async updatePot(roomId, amount) {
    await query(
      'UPDATE rooms SET total_pot = total_pot + $1 WHERE id = $2',
      [amount, roomId]
    );
  }
}

module.exports = Room;
