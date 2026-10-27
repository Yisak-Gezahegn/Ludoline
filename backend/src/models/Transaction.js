const { query } = require('../config/database');

class Transaction {
  static async create({ userId, type, amount, balanceBefore, balanceAfter, status = 'pending', reference, roomId, metadata }) {
    const res = await query(
      `INSERT INTO transactions
         (user_id, type, amount, balance_before, balance_after, status, reference, room_id, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [userId, type, amount, balanceBefore, balanceAfter, status, reference, roomId || null, JSON.stringify(metadata || {})]
    );
    return res.rows[0];
  }

  static async updateStatus(id, status, metadata) {
    const res = await query(
      `UPDATE transactions SET status = $1, metadata = metadata || $2, updated_at = NOW()
       WHERE id = $3 RETURNING *`,
      [status, JSON.stringify(metadata || {}), id]
    );
    return res.rows[0];
  }

  static async findByReference(reference) {
    const res = await query('SELECT * FROM transactions WHERE reference = $1', [reference]);
    return res.rows[0] || null;
  }

  static async getUserTransactions(userId, limit = 50, offset = 0) {
    const res = await query(
      `SELECT * FROM transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );
    return res.rows;
  }

  static async getPendingDeposits() {
    const res = await query(
      `SELECT * FROM transactions WHERE type = 'deposit' AND status = 'pending'
       AND created_at < NOW() - INTERVAL '30 minutes'`
    );
    return res.rows;
  }
}

module.exports = Transaction;
