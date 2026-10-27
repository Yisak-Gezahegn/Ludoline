import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { authAPI } from '../api/client';
import { useAuth } from '../context/AuthContext';
import TelegramVerificationPanel from '../components/auth/TelegramVerificationPanel';

const LANGS = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'am', label: 'አማርኛ',   flag: '🇪🇹' },
  { code: 'or', label: 'Afaan Oromo', flag: '🇪🇹' }
];

// Verification channel tabs
const CHANNELS = [
  { id: 'telegram', icon: '✈️', label: 'Telegram' },
  { id: 'sms',      icon: '📱', label: 'SMS' }
];

export default function LoginPage() {
  // ─── Registration/login flow step
  // 'phone'   → both channels: enter phone
  // 'otp'     → SMS OTP entry
  // 'profile' → new user: enter username + full name
  const [step,     setStep]     = useState('phone');
  const [channel,  setChannel]  = useState('telegram'); // 'telegram' | 'sms'
  const [phone,    setPhone]    = useState('');
  const [otp,      setOtp]      = useState('');
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [language, setLanguage] = useState('en');
  const [loading,  setLoading]  = useState(false);
  const [tempToken, setTempToken] = useState(null);
  const [tempUser,  setTempUser]  = useState(null);

  const { login } = useAuth();
  const { t, i18n } = useTranslation();
  const navigate    = useNavigate();

  // ─── Phone validation ──────────────────────────────────────────────────
  const PHONE_REGEX = /^(\+251|0)(9|7)\d{8}$/;
  const phoneValid  = PHONE_REGEX.test(phone);

  // ─── Called after successful Telegram OTP verification ─────────────────
  const handleTelegramSuccess = ({ token, user, isNew }) => {
    if (isNew || !user.profileComplete) {
      setTempToken(token);
      setTempUser(user);
      setStep('profile');
    } else {
      login(token, user);
      navigate('/lobby');
    }
  };

  // ─── SMS handlers (unchanged from original) ────────────────────────────
  const handleSendSmsOtp = async (e) => {
    e.preventDefault();
    if (!phoneValid) return toast.error('Invalid Ethiopian phone number');
    setLoading(true);
    try {
      await authAPI.requestOtp(phone, language);
      toast.success(t('otpSent', { phone }));
      setStep('otp');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifySmsOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await authAPI.verifyOtp(phone, otp);
      const { token: tok, user, isNew } = res.data;
      if (isNew || !user.profileComplete) {
        setTempToken(tok);
        setTempUser(user);
        setStep('profile');
      } else {
        login(tok, user);
        navigate('/lobby');
      }
    } catch {
      toast.error(t('otp_invalid'));
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteProfile = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { api } = await import('../api/client');
      api.defaults.headers.common['Authorization'] = `Bearer ${tempToken}`;
      await authAPI.completeProfile({ username, fullName, language });
      login(tempToken, { ...tempUser, username, profileComplete: true, language });
      navigate('/lobby');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Profile setup failed');
    } finally {
      setLoading(false);
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #1a365d 0%, #2b6cb0 50%, #3182ce 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
    }}>
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          background: 'white', borderRadius: 24, padding: 40,
          width: '100%', maxWidth: 440,
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
        }}
      >
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 48 }}>🎲</div>
          <h1 style={{ fontSize: 30, fontWeight: 900, color: '#2d3748', margin: '8px 0 4px' }}>
            Ludoline
          </h1>
          <p style={{ color: '#718096', margin: 0, fontSize: 13 }}>Play Ludo. Win Real Money.</p>
        </div>

        {/* Language selector */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 20, justifyContent: 'center', flexWrap: 'wrap' }}>
          {LANGS.map((l) => (
            <button
              key={l.code}
              onClick={() => { setLanguage(l.code); i18n.changeLanguage(l.code); }}
              style={{
                padding: '5px 12px', borderRadius: 20,
                border: `2px solid ${language === l.code ? '#3182ce' : '#e2e8f0'}`,
                background: language === l.code ? '#ebf8ff' : 'white',
                cursor: 'pointer', fontWeight: 600, fontSize: 12,
                color: language === l.code ? '#3182ce' : '#718096'
              }}
            >
              {l.flag} {l.label}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">

          {/* ─── Step: Phone + channel selection ──────────────────────── */}
          {step === 'phone' && (
            <motion.div
              key="phone"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
            >
              {/* Channel tabs */}
              <div style={{ display: 'flex', background: '#f7fafc', borderRadius: 12, padding: 4, gap: 4 }} role="tablist" aria-label="Verification method">
                {CHANNELS.map((ch) => (
                  <button
                    key={ch.id}
                    role="tab"
                    aria-selected={channel === ch.id}
                    onClick={() => setChannel(ch.id)}
                    style={{
                      flex: 1, padding: '9px 8px', borderRadius: 10, border: 'none',
                      background: channel === ch.id ? 'white' : 'transparent',
                      fontWeight: 700, fontSize: 13, cursor: 'pointer',
                      color: channel === ch.id ? '#2d3748' : '#718096',
                      boxShadow: channel === ch.id ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
                      transition: 'all 0.2s'
                    }}
                  >
                    {ch.icon} {ch.label}
                  </button>
                ))}
              </div>

              {/* Phone input (shared between both channels) */}
              <div>
                <label htmlFor="phone-input" style={{ fontWeight: 600, color: '#2d3748', display: 'block', marginBottom: 6, fontSize: 14 }}>
                  {t('enterPhone')}
                </label>
                <input
                  id="phone-input"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+251 9XX XXX XXX"
                  autoComplete="tel"
                  aria-describedby="phone-hint"
                  style={{
                    padding: '13px 16px', borderRadius: 10,
                    border: `2px solid ${phone && !phoneValid ? '#e53e3e' : '#e2e8f0'}`,
                    fontSize: 18, outline: 'none', letterSpacing: 2, width: '100%', boxSizing: 'border-box'
                  }}
                />
                <span id="phone-hint" style={{ fontSize: 11, color: '#a0aec0' }}>
                  Ethiopian numbers only (+251 or 09/07...)
                </span>
              </div>

              {/* Telegram channel panel */}
              {channel === 'telegram' && (
                <AnimatePresence mode="wait">
                  <motion.div key="tg-panel" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    {phoneValid ? (
                      <TelegramVerificationPanel
                        phone={phone}
                        language={language}
                        onSuccess={handleTelegramSuccess}
                        onSwitchToSms={() => setChannel('sms')}
                      />
                    ) : (
                      <div style={{
                        background: '#ebf8ff', borderRadius: 10, padding: '14px 16px',
                        fontSize: 13, color: '#2b6cb0', lineHeight: 1.6
                      }}>
                        <div style={{ fontWeight: 700, marginBottom: 4 }}>✈️ {t('tgVerifyTitle')}</div>
                        <div>{t('tgVerifySubtitle')}</div>
                        <div style={{ marginTop: 8, opacity: 0.7 }}>Enter your phone number above to continue.</div>
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              )}

              {/* SMS channel */}
              {channel === 'sms' && (
                <form onSubmit={handleSendSmsOtp} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    type="submit"
                    disabled={loading || !phoneValid}
                    style={{
                      padding: '13px', borderRadius: 10,
                      background: phoneValid ? '#3182ce' : '#e2e8f0',
                      color: phoneValid ? 'white' : '#a0aec0',
                      border: 'none', fontSize: 15, fontWeight: 700,
                      cursor: loading || !phoneValid ? 'not-allowed' : 'pointer',
                      opacity: loading ? 0.7 : 1
                    }}
                  >
                    {loading ? '...' : `📱 ${t('sendOtp')}`}
                  </motion.button>
                  <button
                    type="button"
                    onClick={() => setChannel('telegram')}
                    style={{ background: 'none', border: 'none', color: '#0088cc', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
                  >
                    ✈️ {t('tgVerifyWithTelegram')}
                  </button>
                </form>
              )}
            </motion.div>
          )}

          {/* ─── Step: SMS OTP ────────────────────────────────────────── */}
          {step === 'otp' && (
            <motion.div
              key="otp"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
            >
              <form onSubmit={handleVerifySmsOtp} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <label htmlFor="sms-otp" style={{ fontWeight: 600, color: '#2d3748' }}>{t('enterOtp')}</label>
                <p style={{ color: '#718096', fontSize: 13, margin: 0 }}>{t('otpSent', { phone })}</p>
                <input
                  id="sms-otp"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  maxLength={6}
                  required
                  aria-label="6-digit SMS code"
                  style={{ padding: '14px 16px', borderRadius: 10, border: '2px solid #e2e8f0', fontSize: 28, outline: 'none', letterSpacing: 8, textAlign: 'center' }}
                />
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  type="submit"
                  disabled={loading || otp.length < 6}
                  style={{ padding: '13px', borderRadius: 10, background: '#3182ce', color: 'white', border: 'none', fontSize: 15, fontWeight: 700, cursor: 'pointer', opacity: loading || otp.length < 6 ? 0.7 : 1 }}
                >
                  {loading ? '...' : t('verifyOtp')}
                </motion.button>
                <button
                  type="button"
                  onClick={() => { setStep('phone'); setOtp(''); }}
                  style={{ background: 'none', border: 'none', color: '#3182ce', cursor: 'pointer', fontSize: 13 }}
                >
                  ← Change number
                </button>
              </form>
            </motion.div>
          )}

          {/* ─── Step: Profile completion ─────────────────────────────── */}
          {step === 'profile' && (
            <motion.div
              key="profile"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
            >
              <form onSubmit={handleCompleteProfile} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <h3 style={{ margin: 0, color: '#2d3748' }}>{t('createProfile')}</h3>
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value.replace(/\s/g, '').toLowerCase())}
                  placeholder={t('username')}
                  minLength={3} maxLength={20} required
                  autoComplete="username"
                  aria-label="Username"
                  style={{ padding: '12px 16px', borderRadius: 10, border: '2px solid #e2e8f0', fontSize: 16, outline: 'none' }}
                />
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder={t('fullName')}
                  minLength={2} maxLength={60} required
                  autoComplete="name"
                  aria-label="Full name"
                  style={{ padding: '12px 16px', borderRadius: 10, border: '2px solid #e2e8f0', fontSize: 16, outline: 'none' }}
                />
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  type="submit"
                  disabled={loading}
                  style={{ padding: '13px', borderRadius: 10, background: '#38a169', color: 'white', border: 'none', fontSize: 15, fontWeight: 700, cursor: 'pointer', opacity: loading ? 0.7 : 1 }}
                >
                  {loading ? '...' : 'Create Account →'}
                </motion.button>
              </form>
            </motion.div>
          )}

        </AnimatePresence>
      </motion.div>
    </div>
  );
}
