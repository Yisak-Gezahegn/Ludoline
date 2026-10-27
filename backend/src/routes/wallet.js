const { startDeposit, handleDepositCallback, requestWithdrawal } = require('../services/walletService');
const Transaction = require('../models/Transaction');
const { authenticate, requireProfile } = require('../middleware/auth');
const { validate } = require('../utils/validators');
const { t } = require('../i18n');
const logger = require('../utils/logger');

module.exports = async function walletRoutes(fastify) {
  // GET /api/wallet/balance
  fastify.get('/balance', { preHandler: authenticate }, async (req, reply) => {
    const { balance, total_won, total_lost } = req.currentUser;
    return reply.send({ success: true, balance: parseFloat(balance), totalWon: parseFloat(total_won), totalLost: parseFloat(total_lost) });
  });

  // POST /api/wallet/deposit
  fastify.post('/deposit',
    { preHandler: [authenticate, requireProfile, validate('deposit')] },
    async (req, reply) => {
      const { amount } = req.body;
      const lang = req.currentUser.language || 'en';
      try {
        const result = await startDeposit(req.currentUser.id, amount);
        return reply.send({
          success: true,
          message: t(lang, 'deposit_initiated'),
          transactionId: result.transactionId,
          reference: result.reference
        });
      } catch (err) {
        logger.error('Deposit error', { userId: req.currentUser.id, error: err.message });
        return reply.status(400).send({ success: false, message: t(lang, 'deposit_failed') });
      }
    }
  );

  // POST /api/wallet/telebirr/callback  (Telebirr notifies us here)
  fastify.post('/telebirr/callback', async (req, reply) => {
    try {
      const result = await handleDepositCallback(req.body);
      // Must respond with specific format Telebirr expects
      return reply.send({ code: '200', message: 'success' });
    } catch (err) {
      logger.error('Telebirr callback error', { error: err.message });
      return reply.send({ code: '200', message: 'success' }); // always 200 to Telebirr
    }
  });

  // POST /api/wallet/withdraw
  fastify.post('/withdraw',
    { preHandler: [authenticate, requireProfile, validate('withdraw')] },
    async (req, reply) => {
      const { amount } = req.body;
      const lang = req.currentUser.language || 'en';
      try {
        const result = await requestWithdrawal(req.currentUser.id, amount);
        return reply.send({
          success: true,
          message: t(lang, 'withdraw_success'),
          newBalance: result.newBalance
        });
      } catch (err) {
        if (err.message === 'INSUFFICIENT_BALANCE') {
          return reply.status(400).send({ success: false, message: t(lang, 'insufficient_balance') });
        }
        return reply.status(500).send({ success: false, message: t(lang, 'error_generic') });
      }
    }
  );

  // GET /api/wallet/transactions
  fastify.get('/transactions', { preHandler: authenticate }, async (req, reply) => {
    const { limit = 20, offset = 0 } = req.query;
    const txs = await Transaction.getUserTransactions(req.currentUser.id, parseInt(limit), parseInt(offset));
    return reply.send({ success: true, transactions: txs });
  });
};
