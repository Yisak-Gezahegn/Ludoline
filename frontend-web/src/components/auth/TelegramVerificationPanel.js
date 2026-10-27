/**
 * TelegramVerificationPanel.js
 * Full Telegram OTP verification UI.
 * Uses existing design system: same colors, border-radius, shadow, spacing as LoginPage.
 * Fully accessible: ARIA labels, keyboard navigation, focus management, screen-reader text.
 */
import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import useTelegramVerification, { TG_STEP } from '../../hooks/useTelegramVerification';

// ─── Design tokens (match LoginPage) ────────────────────────────────────────
const clr = {
  blue:      '#3182ce',
  blueLight: '#ebf8ff',
  green:     '#38a169',
  red:       '#e53e3e',
  redLight:  '#fff5f5',
  gray:      '#718096',
  grayLight: '#e2e8f0',
  dark:      '#2d3748',
  tg:        '#0088cc',   // Telegram brand
  tgDark:    '#006da3'
};

const btn = (bg, color, disabled) => ({
  padding: '13px 20px',
  borderRadius: 10,
  background: disabled ? clr.grayLight : bg,
  color: disabled ? clr.gray : color,
  border: 'none',
  fontSize: 15,
  fontWeight: 700,
  cursor: disabled ? 'not-allowed' : 'pointer',
  width: '100%',
  transition: 'opacity 0.15s, background 0.15s',
  opacity: disabled ? 0.65 : 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8
});

// ─── Sub-components ──────────────────────────────────────────────────────────

function StepIndicator({ step }) {
  const steps = [
    { key: 'open',  icon: '📱', label: 'Open bot' },
    { key: 'link',  icon: '🔗', label: 'Press Start' },
    { key: 'code',  icon: '🔑', label: 'Enter code' }
  ];
  const active = step === TG_STEP.AWAITING_LINK ? 0
               : step === TG_STEP.AWAITING_OTP  ? 2
               : step === TG_STEP.VERIFYING      ? 2
               : -1;

  return (
    <div style={{ display: 'flex', justifyContent: 'center', gap: 0, marginBottom: 20 }} aria-label="Verification steps">
      {steps.map((s, i) => (
        <React.Fragment key={s.key}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%',
              background: i <= active ? clr.tg : clr.grayLight,
              color: i <= active ? 'white' : clr.gray,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, transition: 'background 0.3s'
            }}>
              {i < active ? '✓' : s.icon}
            </div>
            <span style={{ fontSize: 10, color: i <= active ? clr.tg : clr.gray }}>{s.label}</span>
          </div>
          {i < steps.length - 1 && (
            <div style={{
              width: 40, height: 2, background: i < active ? clr.tg : clr.grayLight,
              marginTop: 17, transition: 'background 0.3s'
            }} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

function ErrorBanner({ errorCode, errorMessage, t }) {
  if (!errorCode || errorCode === 'OTP_INVALID') return null;
  const msg = {
    SESSION_EXPIRED:   t('tgSessionExpired'),
    RESEND_COOLDOWN:   t('tgResendCode'),
    MAX_ATTEMPTS:      t('tgMaxAttempts'),
    ALREADY_LINKED:    t('tgAlreadyLinked'),
    DELIVERY_FAILED:   t('tgDeliveryFailed'),
    RATE_LIMITED:      t('tgMaxAttempts'),
    NOT_LINKED:        t('tgNotLinked'),
    NETWORK_ERROR:     t('tgNetworkError'),
  }[errorCode] || errorMessage;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      role="alert"
      aria-live="assertive"
      style={{
        background: clr.redLight, border: `1px solid ${clr.red}`,
        borderRadius: 8, padding: '10px 14px',
        color: clr.red, fontSize: 13, fontWeight: 600
      }}
    >
      ⚠️ {msg}
    </motion.div>
  );
}

function OtpInput({ value, onChange, onSubmit, disabled, attemptsLeft, secondsLeft, t }) {
  const inputRef = useRef(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && value.length === 6 && !disabled) onSubmit(value);
  };
  const handlePaste = (e) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted) onChange(pasted);
    e.preventDefault();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <label htmlFor="tg-otp-input" style={{ fontWeight: 700, color: clr.dark, fontSize: 14 }}>
        {t('tgEnterCode')}
      </label>

      {secondsLeft > 0 && (
        <p style={{ margin: 0, color: secondsLeft < 30 ? clr.red : clr.gray, fontSize: 12 }}
           aria-live="polite">
          {t('tgCodeValidFor', { seconds: secondsLeft })}
        </p>
      )}

      <input
        id="tg-otp-input"
        ref={inputRef}
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        placeholder="000000"
        maxLength={6}
        disabled={disabled}
        aria-label="Six digit verification code from Telegram"
        aria-describedby="tg-otp-attempts"
        style={{
          padding: '14px 16px',
          borderRadius: 10,
          border: `2px solid ${clr.grayLight}`,
          fontSize: 30,
          letterSpacing: 10,
          textAlign: 'center',
          outline: 'none',
          fontWeight: 800,
          color: clr.dark,
          opacity: disabled ? 0.6 : 1,
          width: '100%',
          boxSizing: 'border-box'
        }}
      />
      <span id="tg-otp-attempts" style={{ fontSize: 12, color: attemptsLeft <= 2 ? clr.red : clr.gray }}>
        {attemptsLeft} attempt{attemptsLeft !== 1 ? 's' : ''} remaining
      </span>
    </div>
  );
}

// ─── Main panel ──────────────────────────────────────────────────────────────

export default function TelegramVerificationPanel({ phone, language, onSuccess, onSwitchToSms }) {
  const { t } = useTranslation();
  const tg = useTelegramVerification({ phone, language, onSuccess });

  // Build the Telegram deep link for different platforms
  const buildTelegramLink = (deepLink) => {
    // Mobile: tg:// scheme; Desktop/Web fallback: https://t.me/
    // We use the https URL which works on all platforms (Telegram handles routing)
    return deepLink;
  };

  // ─── Idle (before session created) ─────────────────────────────────────
  if (tg.step === TG_STEP.IDLE || tg.step === TG_STEP.ERROR && !tg.sessionId) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ textAlign: 'center', padding: '8px 0' }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>✈️</div>
          <h3 style={{ margin: '0 0 6px', color: clr.dark, fontSize: 17 }}>{t('tgVerifyTitle')}</h3>
          <p style={{ margin: 0, color: clr.gray, fontSize: 13 }}>{t('tgVerifySubtitle')}</p>
        </div>

        {tg.errorCode && (
          <ErrorBanner errorCode={tg.errorCode} errorMessage={tg.errorMessage} t={t} />
        )}

        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={tg.startSession}
          disabled={!phone || tg.isLoading}
          style={btn(clr.tg, 'white', !phone || tg.isLoading)}
          aria-label="Start Telegram verification"
        >
          {tg.isLoading ? (
            <><Spinner /> {t('tgSessionCreating')}</>
          ) : (
            <>✈️ {t('tgVerifyWithTelegram')}</>
          )}
        </motion.button>

        {onSwitchToSms && (
          <button
            onClick={onSwitchToSms}
            style={{ background: 'none', border: 'none', color: clr.blue, cursor: 'pointer', fontSize: 14, fontWeight: 600, padding: '4px 0' }}
          >
            {t('tgOrUseSms')}
          </button>
        )}
      </div>
    );
  }

  // ─── Creating ───────────────────────────────────────────────────────────
  if (tg.step === TG_STEP.CREATING) {
    return (
      <div style={{ textAlign: 'center', padding: '24px 0', color: clr.gray }}>
        <Spinner large />
        <p style={{ marginTop: 12, fontWeight: 600 }}>{t('tgSessionCreating')}</p>
      </div>
    );
  }

  // ─── Awaiting link (user needs to open bot) ─────────────────────────────
  if (tg.step === TG_STEP.AWAITING_LINK) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <StepIndicator step={tg.step} />

        <div style={{
          background: clr.blueLight, borderRadius: 10, padding: '14px 16px',
          fontSize: 13, color: clr.dark, lineHeight: 1.7
        }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>📋 {t('tgOpenBotHint')}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span>👆 {t('tgStep1')}</span>
            <span>▶️ {t('tgStep2')}</span>
            <span>🔢 {t('tgStep3')}</span>
          </div>
        </div>

        <a
          href={buildTelegramLink(tg.deepLink)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Open @${tg.botName} in Telegram`}
          style={{
            ...btn(clr.tg, 'white', false),
            textDecoration: 'none',
            display: 'flex'
          }}
        >
          ✈️ {t('tgOpenBot')} @{tg.botName}
        </a>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: clr.gray, fontSize: 13 }}>
          <Spinner />
          <span aria-live="polite">{t('tgWaiting')}</span>
        </div>

        <button
          onClick={tg.cancel}
          style={{ background: 'none', border: 'none', color: clr.gray, cursor: 'pointer', fontSize: 13, marginTop: 4 }}
        >
          {t('tgCancel')}
        </button>
      </div>
    );
  }

  // ─── Awaiting OTP ───────────────────────────────────────────────────────
  if (tg.step === TG_STEP.AWAITING_OTP || tg.step === TG_STEP.VERIFYING) {
    const isVerifying = tg.step === TG_STEP.VERIFYING;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <StepIndicator step={tg.step} />

        <div style={{
          background: '#f0fff4', border: '1px solid #c6f6d5', borderRadius: 8,
          padding: '10px 14px', fontSize: 13, color: '#276749', fontWeight: 600
        }} role="status">
          ✅ {t('tgLinked')}
        </div>

        <AnimatePresence>
          {tg.errorCode === 'OTP_INVALID' && (
            <motion.div
              key="otp-err"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              role="alert"
              aria-live="assertive"
              style={{ background: clr.redLight, border: `1px solid ${clr.red}`, borderRadius: 8, padding: '10px 14px', color: clr.red, fontSize: 13, fontWeight: 600 }}
            >
              ❌ {t('tgOtpInvalid')}
            </motion.div>
          )}
        </AnimatePresence>

        <OtpInput
          value={tg.otp}
          onChange={tg.setOtp}
          onSubmit={tg.submitOtp}
          disabled={isVerifying || tg.otpAttemptsLeft === 0}
          attemptsLeft={tg.otpAttemptsLeft}
          secondsLeft={tg.otpSecondsLeft}
          t={t}
        />

        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => tg.submitOtp(tg.otp)}
          disabled={tg.otp.length < 6 || isVerifying || tg.otpAttemptsLeft === 0}
          style={btn(clr.blue, 'white', tg.otp.length < 6 || isVerifying || tg.otpAttemptsLeft === 0)}
          aria-label="Submit verification code"
        >
          {isVerifying ? <><Spinner /> {t('verifyOtp')}…</> : `🔓 ${t('tgVerifyCode')}`}
        </motion.button>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button
            onClick={tg.resendOtp}
            disabled={tg.resendCooldown > 0}
            style={{
              background: 'none', border: 'none', cursor: tg.resendCooldown > 0 ? 'default' : 'pointer',
              color: tg.resendCooldown > 0 ? clr.gray : clr.blue, fontSize: 13, fontWeight: 600,
              padding: '4px 0'
            }}
            aria-label={tg.resendCooldown > 0 ? `Resend available in ${tg.resendCooldown} seconds` : 'Resend verification code'}
          >
            {tg.resendCooldown > 0 ? t('tgResendIn', { seconds: tg.resendCooldown }) : t('tgResendCode')}
          </button>

          <button
            onClick={tg.cancel}
            style={{ background: 'none', border: 'none', color: clr.gray, cursor: 'pointer', fontSize: 12, padding: '4px 0' }}
          >
            {t('tgCancel')}
          </button>
        </div>
      </div>
    );
  }

  // ─── Success ────────────────────────────────────────────────────────────
  if (tg.step === TG_STEP.SUCCESS) {
    return (
      <div style={{ textAlign: 'center', padding: '24px 0' }} role="status" aria-live="polite">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          style={{ fontSize: 56, marginBottom: 12 }}
        >
          ✅
        </motion.div>
        <p style={{ fontWeight: 700, color: clr.green, fontSize: 18, margin: 0 }}>
          {t('tgVerifySuccess')}
        </p>
      </div>
    );
  }

  // ─── Generic error with restart ─────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, textAlign: 'center' }}>
      <div style={{ fontSize: 40 }}>😕</div>
      <ErrorBanner errorCode={tg.errorCode} errorMessage={tg.errorMessage} t={t} />
      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={tg.startSession}
        disabled={tg.isLoading}
        style={btn(clr.tg, 'white', tg.isLoading)}
      >
        {tg.isLoading ? <Spinner /> : '🔄 Restart Verification'}
      </motion.button>
      {onSwitchToSms && (
        <button onClick={onSwitchToSms} style={{ background: 'none', border: 'none', color: clr.blue, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
          {t('tgOrUseSms')}
        </button>
      )}
    </div>
  );
}

// ─── Spinner ─────────────────────────────────────────────────────────────────
function Spinner({ large }) {
  const size = large ? 32 : 16;
  return (
    <span
      role="status"
      aria-label="Loading"
      style={{
        display: 'inline-block', width: size, height: size,
        borderRadius: '50%',
        border: `${large ? 3 : 2}px solid rgba(0,0,0,0.1)`,
        borderTopColor: large ? clr.tg : 'currentColor',
        animation: 'spin 0.7s linear infinite'
      }}
    >
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </span>
  );
}
