const { getClient } = require('../config/database');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const { initiateDeposit, initiateWithdrawal, verifyCallback } = require('../payments/telebirr');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

/**
 * Initiate a Telebirr deposit.
 */
async function startDeposit(userId, amount) {
  const user = await User.findById(userId);
  if (!user) throw new Error('USER_NOT_FOUND');

  const reference = uuidv4();
  const balanceBefore = parseFloat(user.balance);

  // Create pending transaction
  const tx = await Transaction.create({
    userId,
    type: 'deposit',
    amount,
    balanceBefore,
    balanceAfter: balanceBefore, // will update on success
    status: 'pending',
    reference,
    metadata: { phone: user.phone }
  });

  // Call Telebirr
  const telebirrRes = await initiateDeposit({
    phone: user.phone,
    amount,
    outTradeNo: reference,
    subject: `Ludoline deposit ${amount} ETB`
  });

  return { transactionId: tx.id, reference, telebirrResponse: telebirrRes };
}

/**
 * Handle Telebirr deposit callback.
 * This is called when Telebirr posts to our NOTIFY_URL.
 */
async function handleDepositCallback(body) {
  const valid = verifyCallback(body);
  if (!valid) {
    logger.warn('Invalid Telebirr callback signature', { body });
    throw new Error('INVALID_CALLBACK');
  }

  const { outTradeNo, tradeStatus, totalAmount, msisdn } = body;

  const tx = await Transaction.findByReference(outTradeNo);
  if (!tx) throw new Error('TRANSACTION_NOT_FOUND');
  if (tx.status !== 'pending') return tx; // already processed

  if (tradeStatus === '1' || tradeStatus === 'SUCCESS') {
    // Payment successful — credit user balance
    const client = await getClient();
    try {
      await client.query('BEGIN');

      const newBalance = await User.updateBalance(tx.user_id, parseFloat(totalAmount), client);

      await Transaction.updateStatus(tx.id, 'completed', {
        telebirrRef: body.tradeNo,
        completedAt: new Date().toISOString()
      });

      // Update balance_after
      await client.query(
        'UPDATE transactions SET balance_after = $1 WHERE id = $2',
        [newBalance, tx.id]
      );

      await client.query('COMMIT');
      logger.info('Deposit completed', { userId: tx.user_id, amount: totalAmount });
      return { success: true, userId: tx.user_id, amount: parseFloat(totalAmount) };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } else {
    await Transaction.updateStatus(tx.id, 'failed', { telebirrStatus: tradeStatus });
    return { success: false };
  }
}

/**
 * Request a withdrawal.
 */
async function requestWithdrawal(userId, amount) {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const user = await User.findById(userId);
    if (!user) throw new Error('USER_NOT_FOUND');
    if (parseFloat(user.balance) < amount) throw new Error('INSUFFICIENT_BALANCE');

    const reference = uuidv4();
    const balanceBefore = parseFloat(user.balance);

    // Deduct balance first
    const newBalance = await User.updateBalance(userId, -amount, client);

    await Transaction.create({
      userId,
      type: 'withdrawal',
      amount,
      balanceBefore,
      balanceAfter: newBalance,
      status: 'pending',
      reference,
      metadata: { phone: user.phone }
    });

    // Send to Telebirr
    const result = await initiateWithdrawal({ phone: user.phone, amount, reference });

    await client.query(
      `UPDATE transactions SET status = 'completed', metadata = metadata || $1
       WHERE reference = $2`,
      [JSON.stringify({ telebirrResult: result }), reference]
    );

    await client.query('COMMIT');
    logger.info('Withdrawal completed', { userId, amount });
    return { success: true, reference, newBalance };
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('Withdrawal failed', { userId, amount, error: err.message });
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Deduct bet amount from player balance when joining a room.
 */
async function deductBet(userId, betAmount, roomId, client) {
  const db = client;
  const userRes = await db.query('SELECT balance FROM users WHERE id = $1 FOR UPDATE', [userId]);
  const user = userRes.rows[0];
  if (!user) throw new Error('USER_NOT_FOUND');
  if (parseFloat(user.balance) < betAmount) throw new Error('INSUFFICIENT_BALANCE');

  const newBalance = parseFloat(user.balance) - betAmount;

  await db.query(
    'UPDATE users SET balance = $1 WHERE id = $2',
    [newBalance, userId]
  );

  await db.query(
    `INSERT INTO transactions
       (user_id, type, amount, balance_before, balance_after, status, reference, room_id)
     VALUES ($1, 'bet_deduct', $2, $3, $4, 'completed', $5, $6)`,
    [userId, betAmount, user.balance, newBalance, `BET_${roomId}_${userId}`, roomId]
  );

  return newBalance;
}

/**
 * Credit prize to a player after game ends.
 */
async function creditPrize(userId, prizeAmount, roomId, client) {
  const db = client;
  const userRes = await db.query('SELECT balance FROM users WHERE id = $1', [userId]);
  const user = userRes.rows[0];
  const balanceBefore = parseFloat(user.balance);
  const newBalance = balanceBefore + prizeAmount;

  await db.query(
    'UPDATE users SET balance = $1 WHERE id = $2',
    [newBalance, userId]
  );

  await db.query(
    `INSERT INTO transactions
       (user_id, type, amount, balance_before, balance_after, status, reference, room_id)
     VALUES ($1, 'prize_credit', $2, $3, $4, 'completed', $5, $6)`,
    [userId, prizeAmount, balanceBefore, newBalance, `PRIZE_${roomId}_${userId}`, roomId]
  );

  return newBalance;
}

module.exports = { startDeposit, handleDepositCallback, requestWithdrawal, deductBet, creditPrize };
