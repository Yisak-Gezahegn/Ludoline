import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { LinearGradient } from 'expo-linear-gradient';
import { authAPI, usersAPI } from '../api/client';
import { useTranslation } from 'react-i18next';

export default function ProfileScreen({ navigation }) {
  const [user, setUser] = useState(null);
  const { t, i18n } = useTranslation();

  useEffect(() => {
    authAPI.me().then((res) => setUser(res.data.user)).catch(() => {});
  }, []);

  const handleLogout = async () => {
    Alert.alert('Logout', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout', style: 'destructive', onPress: async () => {
          await SecureStore.deleteItemAsync('ludoline_token');
          navigation.replace('Login');
        }
      }
    ]);
  };

  const changeLang = async (lang) => {
    i18n.changeLanguage(lang);
    try { await usersAPI.changeLanguage(lang); } catch {}
  };

  if (!user) return <View style={styles.container}><Text>Loading...</Text></View>;

  const stats = [
    { label: 'Score', value: user.score || 0 },
    { label: 'Games', value: user.games_played || 0 },
    { label: 'Wins', value: user.games_won || 0 },
    { label: 'Balance', value: `${parseFloat(user.balance || 0).toFixed(2)} ETB` }
  ];

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#2b6cb0', '#3182ce']} style={styles.header}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{user.username?.[0]?.toUpperCase()}</Text></View>
        <Text style={styles.username}>{user.username}</Text>
        <Text style={styles.phone}>{user.phone}</Text>
      </LinearGradient>

      <View style={styles.statsGrid}>
        {stats.map(({ label, value }) => (
          <View key={label} style={styles.statCard}>
            <Text style={styles.statValue}>{value}</Text>
            <Text style={styles.statLabel}>{label}</Text>
          </View>
        ))}
      </View>

      {/* Language */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Language</Text>
        <View style={styles.langRow}>
          {[{ code: 'en', label: '🇬🇧 English' }, { code: 'am', label: '🇪🇹 አማርኛ' }, { code: 'or', label: '🇪🇹 Afaan Oromo' }].map((l) => (
            <TouchableOpacity key={l.code} onPress={() => changeLang(l.code)} style={[styles.langBtn, i18n.language === l.code && styles.langBtnActive]}>
              <Text style={[styles.langText, i18n.language === l.code && styles.langTextActive]}>{l.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7fafc' },
  header: { padding: 32, alignItems: 'center' },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.3)', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  avatarText: { fontSize: 36, color: 'white', fontWeight: '900' },
  username: { fontSize: 24, fontWeight: '900', color: 'white' },
  phone: { color: 'rgba(255,255,255,0.8)', marginTop: 4 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', padding: 16, gap: 12 },
  statCard: { width: '47%', backgroundColor: 'white', borderRadius: 12, padding: 16 },
  statValue: { fontSize: 24, fontWeight: '800', color: '#2d3748' },
  statLabel: { fontSize: 13, color: '#a0aec0', marginTop: 4 },
  section: { backgroundColor: 'white', margin: 16, borderRadius: 12, padding: 16 },
  sectionTitle: { fontWeight: '700', color: '#4a5568', marginBottom: 12 },
  langRow: { gap: 8 },
  langBtn: { padding: 12, borderRadius: 10, borderWidth: 2, borderColor: '#e2e8f0' },
  langBtnActive: { borderColor: '#3182ce', backgroundColor: '#ebf8ff' },
  langText: { fontWeight: '600', color: '#718096' },
  langTextActive: { color: '#3182ce' },
  logoutBtn: { margin: 16, backgroundColor: '#fff5f5', borderRadius: 12, padding: 16, alignItems: 'center', borderWidth: 2, borderColor: '#fed7d7' },
  logoutText: { color: '#e53e3e', fontWeight: '700', fontSize: 16 }
});
