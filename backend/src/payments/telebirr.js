/**
 * Telebirr Payment Integration
 * Uses Telebirr's USSDPush / OpenAPI for deposit and withdrawal.
 * Docs: https://developer.ethiotelecom.et/
 */
const axios = require('axios');
const crypto = require('crypto');
const logger = require('../utils/logger');

const BASE_URL = process.env.TELEBIRR_BASE_URL;
const APP_ID = process.env.TELEBIRR_APP_ID;
const APP_KEY = process.env.TELEBIRR_APP_KEY;
const SHORT_CODE = process.env.TELEBIRR_SHORT_CODE;
const NOTIFY_URL = process.env.TELEBIRR_NOTIFY_URL;

/**
 * Build USSD push signature per Telebirr spec.
 * The signature is SHA-256 hash of sorted query parameters + appKey.
 */
function buildSignature(params) {
  const sortedKeys = Object.keys(params).sort();
  const queryString = sortedKeys
    .filter((k) => params[k] !== '' && params[k] !== null && params[k] !== undefined)
    .map((k) => `${k}=${params[k]}`)
    .join('&');
  const toSign = `${queryString}&key=${APP_KEY}`;
  return crypto.createHash('sha256').update(toSign).digest('hex').toUpperCase();
}

/**
 * Encrypt payload using RSA public key (Telebirr requirement).
 */
function encryptPayload(payload) {
  const publicKey = process.env.TELEBIRR_PUBLIC_KEY;
  if (!publicKey) throw new Error('Telebirr public key not configured');
  const encrypted = crypto.publicEncrypt(
    {
      key: publicKey,
      padding: crypto.constants.RSA_PKCS1_PADDING
    },
    Buffer.from(JSON.stringify(payload))
  );
  return encrypted.toString('base64');
}

/**
 * Initiate a USSD Push deposit (STK push to user's phone).
 * @param {object} opts
 * @param {string} opts.phone - Ethiopian phone (09xxxxxxxx format)
 * @param {number} opts.amount - ETB amount
 * @param {string} opts.outTradeNo - unique transaction reference (UUID)
 * @param {string} opts.subject - description shown to user
 * @returns {object} Telebirr API response
 */
async function initiateDeposit({ phone, amount, outTradeNo, subject }) {
  try {
    const timestamp = Math.floor(Date.now() / 1000).toString();

    // Normalize phone to 09xxxxxxxx format
    const normalizedPhone = phone.startsWith('+251')
      ? '0' + phone.slice(4)
      : phone;

    const payload = {
      appId: APP_ID,
      appName: 'Ludoline',
      nonce: crypto.randomBytes(8).toString('hex'),
      notifyUrl: NOTIFY_URL,
      outTradeNo,
      receiverIdentifier: normalizedPhone,
      shortCode: SHORT_CODE,
      subject,
      timeoutExpress: '30',
      timestamp,
      totalAmount: amount.toFixed(2)
    };

    const sign = buildSignature(payload);
    const ussd = encryptPayload(payload);

    const response = await axios.post(
      BASE_URL,
      { appid: APP_ID, sign, ussd },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000,
        httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false })
      }
    );

    logger.info('Telebirr deposit initiated', { outTradeNo, phone: normalizedPhone, amount });
    return response.data;
  } catch (err) {
    logger.error('Telebirr deposit error', { error: err.message, phone, amount });
    throw new Error('TELEBIRR_INITIATE_FAILED');
  }
}

/**
 * Process Telebirr callback (webhook).
 * Verifies the callback is legitimate.
 * @param {object} body - callback body from Telebirr
 * @returns {boolean} valid or not
 */
function verifyCallback(body) {
  try {
    // Telebirr sends a signed notification
    const { sign, ...rest } = body;
    const expectedSign = buildSignature(rest);
    return expectedSign === sign?.toUpperCase();
  } catch {
    return false;
  }
}

/**
 * Withdraw to user's Telebirr account.
 * Note: Withdrawal to individual Telebirr accounts typically uses Telebirr's
 * B2C (Business-to-Customer) API. Implementation depends on your agreement.
 * This is a placeholder that should be replaced with actual B2C calls.
 */
async function initiateWithdrawal({ phone, amount, reference }) {
  try {
    // TODO: Replace with actual Telebirr B2C API call
    // For now, log and return mock for development
    logger.info('Withdrawal request', { phone, amount, reference });

    if (process.env.NODE_ENV === 'development') {
      return { success: true, transactionId: `DEV_${reference}`, message: 'Dev mode withdrawal' };
    }

    // Production: call Telebirr B2C endpoint
    throw new Error('B2C_NOT_CONFIGURED');
  } catch (err) {
    logger.error('Telebirr withdrawal error', { error: err.message });
    throw err;
  }
}

module.exports = { initiateDeposit, verifyCallback, initiateWithdrawal };
