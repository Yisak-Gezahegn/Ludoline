const { query } = require('../config/database');

class User {
  static async findByPhone(phone) {
    const res = await query('SELECT * FROM users WHERE phone = $1', [phone]);
    return res.rows[0] || null;
  }

  static async findById(id) {
    const res = await query('SELECT * FROM users WHERE id = $1', [id]);
    return res.rows[0] || null;
  }

  static async findByUsername(username) {
    const res = await query('SELECT * FROM users WHERE username = $1', [username]);
    return res.rows[0] || null;
  }

  static async create(phone, language = 'en') {
    const res = await query(
      `INSERT INTO users (phone, language) VALUES ($1, $2) RETURNING *`,
      [phone, language]
    );
    return res.rows[0];
  }

  static async completeProfile(id, { username, fullName, language }) {
    const res = await query(
      `UPDATE users SET
        username = $1,
        full_name = $2,
        language = $3,
        profile_complete = TRUE,
        is_verified = TRUE,
        updated_at = NOW()
       WHERE id = $4 RETURNING *`,
      [username, fullName, language, id]
    );
    return res.rows[0];
  }

  static async updateLastLogin(id) {
    await query('UPDATE users SET last_login = NOW() WHERE id = $1', [id]);
  }

  static async updateBalance(id, amount, client) {
    const db = client || { query: (text, params) => query(text, params) };
    const res = await db.query(
      `UPDATE users SET balance = balance + $1, updated_at = NOW()
       WHERE id = $2 AND balance + $1 >= 0
       RETURNING balance`,
      [amount, id]
    );
    if (res.rows.length === 0) {
      throw new Error('INSUFFICIENT_BALANCE');
    }
    return res.rows[0].balance;
  }

  static async getBalance(id) {
    const res = await query('SELECT balance FROM users WHERE id = $1', [id]);
    return res.rows[0]?.balance || 0;
  }

  static async updateStats(id, { won, prizeAmount, lostAmount }) {
    if (won) {
      await query(
        `UPDATE users SET
          games_played = games_played + 1,
          games_won = games_won + 1,
          total_won = total_won + $1,
          score = score + 10,
          updated_at = NOW()
         WHERE id = $2`,
        [prizeAmount, id]
      );
    } else {
      await query(
        `UPDATE users SET
          games_played = games_played + 1,
          total_lost = total_lost + $1,
          updated_at = NOW()
         WHERE id = $2`,
        [lostAmount, id]
      );
    }
  }

  static async getLeaderboard(limit = 100) {
    const res = await query(
      `SELECT * FROM leaderboard LIMIT $1`,
      [limit]
    );
    return res.rows;
  }

  static async getProfile(id) {
    const res = await query(
      `SELECT id, username, full_name, avatar_url, language, role,
              balance, total_won, total_lost, games_played, games_won, score,
              is_active, profile_complete, created_at, last_login
       FROM users WHERE id = $1`,
      [id]
    );
    return res.rows[0] || null;
  }
}

module.exports = User;
