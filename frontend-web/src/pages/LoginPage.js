import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { authAPI } from '../api/client';
import { useAuth } from '../context/AuthContext';

const LANGS = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'am', label: 'አማርኛ', flag: '🇪🇹' },
  { code: 'or', label: 'Afaan Oromo', flag: '🇪🇹' }
];

export default function LoginPage() {
  const [step, setStep] = useState('phone'); // 'phone' | 'otp' | 'profile'
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [language, setLanguage] = useState('en');
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState(null);
  const [userData, setUserData] = useState(null);
  const { login } = useAuth();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  const handleSendOtp = async (e) => {
    e.preventDefault();
    if (!phone.match(/^(\+251|0)(9|7)\d{8}$/)) {
      return toast.error('Invalid Ethiopian phone number');
    }
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

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await authAPI.verifyOtp(phone, otp);
      const { token: tok, user, isNew } = res.data;
      if (isNew || !user.profileComplete) {
        setToken(tok);
        setUserData(user);
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
      // Set token temporarily
      const { api } = await import('../api/client');
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;

      const res = await authAPI.completeProfile({ username, fullName, language });
      login(token, { ...userData, username, profileComplete: true, language });
      navigate('/lobby');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Profile setup failed');
    } finally {
      setLoading(false);
    }
  };

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
          width: '100%', maxWidth: 420, boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
        }}
      >
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 48 }}>🎲</div>
          <h1 style={{ fontSize: 32, fontWeight: 900, color: '#2d3748', margin: '8px 0 4px' }}>Ludoline</h1>
          <p style={{ color: '#718096', margin: 0, fontSize: 14 }}>Play Ludo. Win Real Money.</p>
        </div>

        {/* Language selector */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24, justifyContent: 'center' }}>
          {LANGS.map((l) => (
            <button
              key={l.code}
              onClick={() => { setLanguage(l.code); i18n.changeLanguage(l.code); }}
              style={{
                padding: '6px 14px', borderRadius: 20,
                border: `2px solid ${language === l.code ? '#3182ce' : '#e2e8f0'}`,
                background: language === l.code ? '#ebf8ff' : 'white',
                cursor: 'pointer', fontWeight: 600, fontSize: 13,
                color: language === l.code ? '#3182ce' : '#718096'
              }}
            >
              {l.flag} {l.label}
            </button>
          ))}
        </div>

        {/* Step: Phone */}
        {step === 'phone' && (
          <form onSubmit={handleSendOtp} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <label style={{ fontWeight: 600, color: '#2d3748' }}>{t('enterPhone')}</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+251 9XX XXX XXX"
              required
              style={{ padding: '14px 16px', borderRadius: 10, border: '2px solid #e2e8f0', fontSize: 18, outline: 'none', letterSpacing: 2 }}
            />
            <motion.button
              whileTap={{ scale: 0.97 }}
              type="submit"
              disabled={loading}
              style={{ padding: '14px', borderRadius: 10, background: '#3182ce', color: 'white', border: 'none', fontSize: 16, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}
            >
              {loading ? '...' : t('sendOtp')}
            </motion.button>
          </form>
        )}

        {/* Step: OTP */}
        {step === 'otp' && (
          <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <label style={{ fontWeight: 600, color: '#2d3748' }}>{t('enterOtp')}</label>
            <p style={{ color: '#718096', fontSize: 14, margin: 0 }}>{t('otpSent', { phone })}</p>
            <input
              type="text"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              maxLength={6}
              required
              style={{ padding: '14px 16px', borderRadius: 10, border: '2px solid #e2e8f0', fontSize: 28, outline: 'none', letterSpacing: 8, textAlign: 'center' }}
            />
            <motion.button whileTap={{ scale: 0.97 }} type="submit" disabled={loading || otp.length < 6} style={{ padding: '14px', borderRadius: 10, background: '#3182ce', color: 'white', border: 'none', fontSize: 16, fontWeight: 700, cursor: 'pointer' }}>
              {loading ? '...' : t('verifyOtp')}
            </motion.button>
            <button type="button" onClick={() => setStep('phone')} style={{ background: 'none', border: 'none', color: '#3182ce', cursor: 'pointer', fontSize: 14 }}>
              ← Change number
            </button>
          </form>
        )}

        {/* Step: Profile */}
        {step === 'profile' && (
          <form onSubmit={handleCompleteProfile} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h3 style={{ margin: 0, color: '#2d3748' }}>{t('createProfile')}</h3>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value.replace(/\s/g, '').toLowerCase())}
              placeholder={t('username')}
              minLength={3} maxLength={20} required
              style={{ padding: '12px 16px', borderRadius: 10, border: '2px solid #e2e8f0', fontSize: 16, outline: 'none' }}
            />
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder={t('fullName')}
              minLength={2} maxLength={60} required
              style={{ padding: '12px 16px', borderRadius: 10, border: '2px solid #e2e8f0', fontSize: 16, outline: 'none' }}
            />
            <motion.button whileTap={{ scale: 0.97 }} type="submit" disabled={loading} style={{ padding: '14px', borderRadius: 10, background: '#38a169', color: 'white', border: 'none', fontSize: 16, fontWeight: 700, cursor: 'pointer' }}>
              {loading ? '...' : 'Create Account →'}
            </motion.button>
          </form>
        )}
      </motion.div>
    </div>
  );
}
