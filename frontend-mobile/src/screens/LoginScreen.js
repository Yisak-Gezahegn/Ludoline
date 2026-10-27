import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, Alert, ScrollView
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as SecureStore from 'expo-secure-store';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { authAPI } from '../api/client';

const LANGS = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'am', label: 'አማርኛ', flag: '🇪🇹' },
  { code: 'or', label: 'Afaan Oromo', flag: '🇪🇹' }
];

export default function LoginScreen({ navigation }) {
  const [step, setStep] = useState('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [language, setLanguage] = useState('en');
  const [loading, setLoading] = useState(false);
  const [tempToken, setTempToken] = useState(null);
  const { t, i18n } = useTranslation();

  const handleSendOtp = async () => {
    if (!phone.match(/^(\+251|0)(9|7)\d{8}$/)) {
      return Alert.alert('Error', 'Please enter a valid Ethiopian phone number');
    }
    setLoading(true);
    try {
      await authAPI.requestOtp(phone, language);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setStep('otp');
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    setLoading(true);
    try {
      const res = await authAPI.verifyOtp(phone, otp);
      const { token, user, isNew } = res.data;
      if (isNew || !user.profileComplete) {
        setTempToken(token);
        setStep('profile');
      } else {
        await SecureStore.setItemAsync('ludoline_token', token);
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        navigation.replace('Main');
      }
    } catch {
      Alert.alert('Error', 'Invalid or expired OTP');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteProfile = async () => {
    setLoading(true);
    try {
      const { api } = require('../api/client');
      api.defaults.headers.common['Authorization'] = `Bearer ${tempToken}`;
      await authAPI.completeProfile({ username, fullName, language });
      await SecureStore.setItemAsync('ludoline_token', tempToken);
      navigation.replace('Main');
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Profile setup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={['#1a365d', '#2b6cb0', '#3182ce']} style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {/* Logo */}
          <View style={styles.logoArea}>
            <Text style={styles.diceEmoji}>🎲</Text>
            <Text style={styles.appName}>Ludoline</Text>
            <Text style={styles.tagline}>Play Ludo. Win Real Money.</Text>
          </View>

          <View style={styles.card}>
            {/* Language Selector */}
            <View style={styles.langRow}>
              {LANGS.map((l) => (
                <TouchableOpacity
                  key={l.code}
                  onPress={() => { setLanguage(l.code); i18n.changeLanguage(l.code); }}
                  style={[styles.langBtn, language === l.code && styles.langBtnActive]}
                >
                  <Text style={[styles.langText, language === l.code && styles.langTextActive]}>
                    {l.flag} {l.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Phone Step */}
            {step === 'phone' && (
              <View style={styles.form}>
                <Text style={styles.label}>{t('enterPhone')}</Text>
                <TextInput
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="+251 9XX XXX XXX"
                  keyboardType="phone-pad"
                  style={styles.input}
                  placeholderTextColor="#a0aec0"
                />
                <TouchableOpacity
                  onPress={handleSendOtp}
                  disabled={loading}
                  style={[styles.btn, styles.btnBlue]}
                >
                  {loading ? <ActivityIndicator color="white" /> : <Text style={styles.btnText}>{t('sendOtp')}</Text>}
                </TouchableOpacity>
              </View>
            )}

            {/* OTP Step */}
            {step === 'otp' && (
              <View style={styles.form}>
                <Text style={styles.label}>{t('enterOtp')}</Text>
                <Text style={styles.hint}>{t('otpSent', { phone })}</Text>
                <TextInput
                  value={otp}
                  onChangeText={(v) => setOtp(v.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  keyboardType="numeric"
                  maxLength={6}
                  style={[styles.input, styles.inputOtp]}
                  placeholderTextColor="#a0aec0"
                />
                <TouchableOpacity onPress={handleVerifyOtp} disabled={loading || otp.length < 6} style={[styles.btn, styles.btnBlue, otp.length < 6 && styles.btnDisabled]}>
                  {loading ? <ActivityIndicator color="white" /> : <Text style={styles.btnText}>{t('verifyOtp')}</Text>}
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setStep('phone')} style={styles.linkBtn}>
                  <Text style={styles.linkText}>← Change number</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Profile Step */}
            {step === 'profile' && (
              <View style={styles.form}>
                <Text style={styles.label}>Create Your Profile</Text>
                <TextInput value={username} onChangeText={(v) => setUsername(v.replace(/\s/g, '').toLowerCase())} placeholder={t('username')} style={styles.input} placeholderTextColor="#a0aec0" autoCapitalize="none" maxLength={20} />
                <TextInput value={fullName} onChangeText={setFullName} placeholder={t('fullName')} style={styles.input} placeholderTextColor="#a0aec0" maxLength={60} />
                <TouchableOpacity onPress={handleCompleteProfile} disabled={loading} style={[styles.btn, styles.btnGreen]}>
                  {loading ? <ActivityIndicator color="white" /> : <Text style={styles.btnText}>Create Account →</Text>}
                </TouchableOpacity>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  logoArea: { alignItems: 'center', marginBottom: 32 },
  diceEmoji: { fontSize: 64, marginBottom: 8 },
  appName: { fontSize: 40, fontWeight: '900', color: 'white' },
  tagline: { color: 'rgba(255,255,255,0.8)', fontSize: 15, marginTop: 4 },
  card: { backgroundColor: 'white', borderRadius: 24, padding: 28, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 20, elevation: 10 },
  langRow: { flexDirection: 'row', gap: 8, marginBottom: 24, flexWrap: 'wrap' },
  langBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 2, borderColor: '#e2e8f0' },
  langBtnActive: { borderColor: '#3182ce', backgroundColor: '#ebf8ff' },
  langText: { fontSize: 12, fontWeight: '600', color: '#718096' },
  langTextActive: { color: '#3182ce' },
  form: { gap: 14 },
  label: { fontSize: 16, fontWeight: '700', color: '#2d3748' },
  hint: { fontSize: 13, color: '#718096' },
  input: { borderWidth: 2, borderColor: '#e2e8f0', borderRadius: 12, padding: 14, fontSize: 17, color: '#2d3748', backgroundColor: '#f7fafc' },
  inputOtp: { letterSpacing: 12, textAlign: 'center', fontSize: 28, fontWeight: '800' },
  btn: { borderRadius: 12, padding: 16, alignItems: 'center', justifyContent: 'center' },
  btnBlue: { backgroundColor: '#3182ce' },
  btnGreen: { backgroundColor: '#38a169' },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: 'white', fontSize: 17, fontWeight: '700' },
  linkBtn: { alignItems: 'center', paddingVertical: 8 },
  linkText: { color: '#3182ce', fontSize: 14, fontWeight: '600' }
});
