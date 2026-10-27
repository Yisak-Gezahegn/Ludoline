/**
 * useTelegramVerification.js
 * Stateful hook managing the full Telegram OTP verification lifecycle.
 *
 * States: idle → creating → awaiting_link → awaiting_otp → verifying → done | error
 *
 * Security notes:
 * - Session ID stored in React state only (never persisted to localStorage)
 * - Phone ownership validated server-side on every request
 * - Polling is bounded and cleaned up on unmount
 * - OTP never treated as verified until backend confirms
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { telegramAuthAPI } from '../api/client';

const POLL_INTERVAL_MS  = 3000;   // poll every 3 seconds
const POLL_MAX_DURATION = 600000; // stop polling after 10 minutes
const RESEND_COOLDOWN_S = 60;

export const TG_STEP = {
  IDLE:           'idle',
  CREATING:       'creating',        // POSTing to start-session
  AWAITING_LINK:  'awaiting_link',   // session created, waiting for user to open bot
  AWAITING_OTP:   'awaiting_otp',    // bot linked, waiting for OTP entry
  VERIFYING:      'verifying',       // POSTing OTP to backend
  SUCCESS:        'success',
  ERROR:          'error'
};

export default function useTelegramVerification({ phone, language, onSuccess }) {
  const [step, setStep]             = useState(TG_STEP.IDLE);
  const [sessionId, setSessionId]   = useState(null);
  const [deepLink, setDeepLink]     = useState(null);
  const [botName, setBotName]       = useState('LudolineVerifyBot');
  const [expiresAt, setExpiresAt]   = useState(null);
  const [otp, setOtp]               = useState('');
  const [errorCode, setErrorCode]   = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [otpAttemptsLeft, setOtpAttemptsLeft] = useState(5);
  const [otpSecondsLeft, setOtpSecondsLeft]   = useState(0);

  const pollRef     = useRef(null);
  const pollStart   = useRef(null);
  const resendTimer = useRef(null);
  const otpTimer    = useRef(null);
  const mounted     = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      stopPolling();
      clearInterval(resendTimer.current);
      clearInterval(otpTimer.current);
    };
  }, []);

  // ─── Polling ────────────────────────────────────────────────────────────

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const startPolling = useCallback((sid) => {
    if (pollRef.current) return; // already polling
    pollStart.current = Date.now();

    pollRef.current = setInterval(async () => {
      if (!mounted.current) { stopPolling(); return; }
      if (Date.now() - pollStart.current > POLL_MAX_DURATION) {
        stopPolling();
        if (mounted.current) {
          setStep(TG_STEP.ERROR);
          setErrorCode('SESSION_EXPIRED');
        }
        return;
      }

      try {
        const res = await telegramAuthAPI.getSessionStatus(sid, phone);
        const data = res.data;

        if (!mounted.current) return;

        if (data.status === 'linked') {
          stopPolling();
          setStep(TG_STEP.AWAITING_OTP);
          if (data.otpAttemptsRemaining !== undefined) setOtpAttemptsLeft(data.otpAttemptsRemaining);
          startOtpCountdown(data.expiresAt);
        } else if (data.status === 'expired' || data.status === 'cancelled') {
          stopPolling();
          setStep(TG_STEP.ERROR);
          setErrorCode('SESSION_EXPIRED');
        }
        // 'pending' — keep polling
      } catch {
        // Network hiccup — keep polling (don't abort)
      }
    }, POLL_INTERVAL_MS);
  }, [phone, stopPolling]);

  // ─── OTP countdown ──────────────────────────────────────────────────────

  const startOtpCountdown = useCallback((expiresAtISO) => {
    clearInterval(otpTimer.current);
    const tick = () => {
      const secs = Math.max(0, Math.round((new Date(expiresAtISO) - Date.now()) / 1000));
      if (mounted.current) setOtpSecondsLeft(secs);
      if (secs === 0) clearInterval(otpTimer.current);
    };
    tick();
    otpTimer.current = setInterval(tick, 1000);
  }, []);

  // ─── Resend cooldown ────────────────────────────────────────────────────

  const startResendCooldown = useCallback(() => {
    clearInterval(resendTimer.current);
    setResendCooldown(RESEND_COOLDOWN_S);
    resendTimer.current = setInterval(() => {
      setResendCooldown((c) => {
        if (c <= 1) { clearInterval(resendTimer.current); return 0; }
        return c - 1;
      });
    }, 1000);
  }, []);

  // ─── Actions ────────────────────────────────────────────────────────────

  const startSession = useCallback(async () => {
    if (!phone) return;
    setStep(TG_STEP.CREATING);
    setErrorCode(null);
    setErrorMessage('');
    setOtp('');

    try {
      const res = await telegramAuthAPI.startSession(phone, language);
      const data = res.data;

      if (!mounted.current) return;

      setSessionId(data.sessionId);
      setDeepLink(data.deepLink);
      setBotName(data.botName || 'LudolineVerifyBot');
      setExpiresAt(data.expiresAt);
      setStep(TG_STEP.AWAITING_LINK);
      startPolling(data.sessionId);
    } catch (err) {
      if (!mounted.current) return;
      const code = err.response?.data?.error || 'UNKNOWN';
      setStep(TG_STEP.ERROR);
      setErrorCode(code);
      setErrorMessage(err.response?.data?.message || 'Failed to start verification. Please try again.');
    }
  }, [phone, language, startPolling]);

  const submitOtp = useCallback(async (otpValue) => {
    if (!sessionId || !phone) return;
    setStep(TG_STEP.VERIFYING);
    setErrorCode(null);

    try {
      const res = await telegramAuthAPI.verifyOtp(sessionId, otpValue, phone, language);
      if (!mounted.current) return;
      setStep(TG_STEP.SUCCESS);
      clearInterval(otpTimer.current);
      onSuccess?.(res.data);
    } catch (err) {
      if (!mounted.current) return;
      const code    = err.response?.data?.error || 'UNKNOWN';
      const message = err.response?.data?.message || 'Verification failed. Please try again.';
      setOtpAttemptsLeft((prev) => Math.max(0, prev - 1));
      setErrorCode(code);
      setErrorMessage(message);
      setStep(TG_STEP.AWAITING_OTP); // return to OTP entry
    }
  }, [sessionId, phone, language, onSuccess]);

  const resendOtp = useCallback(async () => {
    if (!sessionId || !phone || resendCooldown > 0) return;

    try {
      const res = await telegramAuthAPI.resendOtp(sessionId, phone);
      startResendCooldown();
      if (res.data.expiresInSeconds) {
        const newExpiry = new Date(Date.now() + res.data.expiresInSeconds * 1000).toISOString();
        startOtpCountdown(newExpiry);
      }
      setErrorCode(null);
      setOtpAttemptsLeft(5);
    } catch (err) {
      const code = err.response?.data?.error || 'UNKNOWN';
      setErrorCode(code);
      setErrorMessage(err.response?.data?.message || 'Could not resend. Please try again.');
      if (code === 'RESEND_COOLDOWN') startResendCooldown();
    }
  }, [sessionId, phone, resendCooldown, startResendCooldown, startOtpCountdown]);

  const cancel = useCallback(async () => {
    stopPolling();
    clearInterval(resendTimer.current);
    clearInterval(otpTimer.current);
    if (sessionId && phone) {
      telegramAuthAPI.cancel(sessionId, phone).catch(() => {});
    }
    setStep(TG_STEP.IDLE);
    setSessionId(null);
    setDeepLink(null);
    setOtp('');
    setErrorCode(null);
    setOtpAttemptsLeft(5);
  }, [sessionId, phone, stopPolling]);

  return {
    step, sessionId, deepLink, botName, expiresAt,
    otp, setOtp,
    errorCode, errorMessage,
    resendCooldown, otpAttemptsLeft, otpSecondsLeft,
    startSession, submitOtp, resendOtp, cancel,
    isLoading: step === TG_STEP.CREATING || step === TG_STEP.VERIFYING
  };
}
