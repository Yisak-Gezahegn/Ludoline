const { setOtp, getOtp, deleteOtp, incrementOtpAttempts } = require('../config/redis');
const User = require('../models/User');
const { t } = require('../i18n');
const logger = require('../utils/logger');
const axios = require('axios');

const OTP_EXPIRES = parseInt(process.env.OTP_EXPIRES_MINUTES) || 5;
const MAX_OTP_ATTEMPTS = 5;

/**
 * Generate a 6-digit OTP.
 */
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Send OTP via SMS gateway.
 */
async function sendOTPSms(phone, otp, language) {
  const messages = {
    en: `Your Ludoline OTP is: ${otp}. Valid for ${OTP_EXPIRES} minutes. Do not share it.`,
    am: `የ Ludoline ኮድዎ: ${otp}. ለ${OTP_EXPIRES} ደቂቃ ይሰራል። አያጋሩ።`,
    or: `Koodii Ludoline keessan: ${otp}. Daqiiqaa ${OTP_EXPIRES} keessatti fayyadami.`
  };
  const message = messages[language] || messages.en;

  if (process.env.NODE_ENV === 'development') {
    logger.info(`[DEV OTP] Phone: ${phone} | OTP: ${otp}`);
    return true;
  }

  try {
    await axios.post(
      process.env.SMS_API_URL,
      { to: phone, message, sender: process.env.SMS_SENDER_ID },
      { headers: { Authorization: `Bearer ${process.env.SMS_API_KEY}` }, timeout: 8000 }
    );
    return true;
  } catch (err) {
    logger.error('SMS send failed', { phone, error: err.message });
    throw new Error('SMS_SEND_FAILED');
  }
}

/**
 * Request OTP for a phone number.
 */
async function requestOTP(phone, language) {
  const attempts = await incrementOtpAttempts(phone);
  if (attempts > MAX_OTP_ATTEMPTS) {
    throw new Error('OTP_MAX_ATTEMPTS');
  }

  const otp = generateOTP();
  await setOtp(phone, otp, OTP_EXPIRES * 60);
  await sendOTPSms(phone, otp, language);

  logger.info('OTP sent', { phone });
  return true;
}

/**
 * Verify OTP and return/create user.
 */
async function verifyOTP(phone, otp, language) {
  const storedOtp = await getOtp(phone);
  if (!storedOtp || storedOtp !== otp) {
    throw new Error('OTP_INVALID');
  }

  await deleteOtp(phone);

  // Get or create user
  let user = await User.findByPhone(phone);
  const isNew = !user;

  if (!user) {
    user = await User.create(phone, language);
  } else {
    await User.updateLastLogin(user.id);
  }

  return { user, isNew };
}

module.exports = { requestOTP, verifyOTP, generateOTP };
