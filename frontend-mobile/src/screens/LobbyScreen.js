import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Modal, TextInput, Alert, ActivityIndicator, RefreshControl, Switch
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { roomsAPI, walletAPI } from '../api/client';

export default function LobbyScreen({ navigation }) {
  const [rooms, setRooms] = useState([]);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [form, setForm] = useState({ betAmount: '10', maxPlayers: 4, isPrivate: false, name: '' });
  const { t } = useTranslation();

  const loadData = useCallback(async () => {
    try {
      const [roomsRes, balRes] = await Promise.all([roomsAPI.getPublic(), walletAPI.getBalance()]);
      setRooms(roomsRes.data.rooms || []);
      setBalance(balRes.data.balance || 0);
    } catch {}
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleCreate = async () => {
    const betAmount = parseFloat(form.betAmount);
    if (!betAmount || betAmount < 2 || betAmount > 10000) return Alert.alert('Error', 'Bet must be 2–10,000 ETB');
    if (balance < betAmount) return Alert.alert('Error', t('insufficientBalance'));
    setLoading(true);
    try {
      const res = await roomsAPI.create({ ...form, betAmount });
      setShowCreate(false);
      navigation.navigate('Game', { roomId: res.data.room.id });
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to create room');
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async (roomId) => {
    setLoading(true);
    try {
      await roomsAPI.join(roomId);
      navigation.navigate('Game', { roomId });
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to join');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinByCode = async () => {
    if (!joinCode.trim()) return;
    try {
      const res = await roomsAPI.getByCode(joinCode.trim().toUpperCase());
      if (res.data.room) handleJoin(res.data.room.id);
    } catch {
      Alert.alert('Error', 'Room not found');
    }
  };

  const renderRoom = ({ item }) => (
    <View style={styles.roomCard}>
      <View style={styles.roomHeader}>
        <Text style={styles.roomName}>{item.name}</Text>
        <View style={styles.codeBadge}><Text style={styles.codeText}>{item.code}</Text></View>
      </View>
      <View style={styles.roomMeta}>
        <Text style={styles.metaText}>👥 {item.player_count}/{item.max_players}</Text>
        <Text style={styles.betText}>{parseFloat(item.bet_amount).toFixed(2)} ETB</Text>
      </View>
      <TouchableOpacity
        onPress={() => handleJoin(item.id)}
        disabled={loading || balance < item.bet_amount}
        style={[styles.joinBtn, balance < item.bet_amount && styles.joinBtnDisabled]}
      >
        <Text style={styles.joinBtnText}>
          {balance < item.bet_amount ? t('insufficientBalance') : `Join — ${parseFloat(item.bet_amount).toFixed(2)} ETB`}
        </Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Balance card */}
      <LinearGradient colors={['#2b6cb0', '#3182ce']} style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>{t('balance')}</Text>
        <Text style={styles.balanceAmount}>{balance.toFixed(2)} ETB</Text>
        <View style={styles.balanceBtns}>
          <TouchableOpacity onPress={() => navigation.navigate('Wallet')} style={styles.balanceBtn}>
            <Text style={styles.balanceBtnText}>💰 Deposit</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowCreate(true)} style={[styles.balanceBtn, { backgroundColor: '#38a169' }]}>
            <Text style={styles.balanceBtnText}>+ Create Room</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Join by code */}
      <View style={styles.codeRow}>
        <TextInput
          value={joinCode}
          onChangeText={(v) => setJoinCode(v.toUpperCase())}
          placeholder="Room code (e.g. ABC123)"
          style={styles.codeInput}
          maxLength={8}
          autoCapitalize="characters"
        />
        <TouchableOpacity onPress={handleJoinByCode} style={styles.codeJoinBtn}>
          <Text style={{ color: 'white', fontWeight: '700' }}>Join</Text>
        </TouchableOpacity>
      </View>

      {/* Rooms list */}
      <Text style={styles.sectionTitle}>{t('publicRooms')}</Text>
      <FlatList
        data={rooms}
        keyExtractor={(item) => item.id}
        renderItem={renderRoom}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={<Text style={styles.emptyText}>No open rooms. Create one!</Text>}
        contentContainerStyle={{ paddingBottom: 100 }}
      />

      {/* Create Room Modal */}
      <Modal visible={showCreate} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>{t('createRoom')}</Text>
            <TextInput value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} placeholder="Room name (optional)" style={styles.input} maxLength={40} />
            <Text style={styles.inputLabel}>{t('betAmount')}</Text>
            <TextInput value={form.betAmount} onChangeText={(v) => setForm({ ...form, betAmount: v })} keyboardType="numeric" placeholder="10" style={styles.input} />
            <Text style={styles.inputLabel}>Players</Text>
            <View style={styles.playersRow}>
              {[2, 3, 4].map((n) => (
                <TouchableOpacity key={n} onPress={() => setForm({ ...form, maxPlayers: n })} style={[styles.playerBtn, form.maxPlayers === n && styles.playerBtnActive]}>
                  <Text style={[styles.playerBtnText, form.maxPlayers === n && styles.playerBtnTextActive]}>{n}P</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.switchRow}>
              <Text style={styles.inputLabel}>Private Room</Text>
              <Switch value={form.isPrivate} onValueChange={(v) => setForm({ ...form, isPrivate: v })} trackColor={{ true: '#3182ce' }} />
            </View>
            <View style={styles.modalBtns}>
              <TouchableOpacity onPress={() => setShowCreate(false)} style={[styles.modalBtn, styles.cancelBtn]}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleCreate} disabled={loading} style={[styles.modalBtn, styles.createBtn]}>
                {loading ? <ActivityIndicator color="white" /> : <Text style={styles.createBtnText}>Create — {form.betAmount} ETB</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7fafc' },
  balanceCard: { padding: 20, margin: 16, borderRadius: 16 },
  balanceLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 13 },
  balanceAmount: { color: 'white', fontSize: 36, fontWeight: '900', marginBottom: 12 },
  balanceBtns: { flexDirection: 'row', gap: 10 },
  balanceBtn: { flex: 1, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 10, padding: 10, alignItems: 'center' },
  balanceBtnText: { color: 'white', fontWeight: '700' },
  codeRow: { flexDirection: 'row', gap: 10, marginHorizontal: 16, marginBottom: 16 },
  codeInput: { flex: 1, borderWidth: 2, borderColor: '#e2e8f0', borderRadius: 10, padding: 12, fontSize: 16, letterSpacing: 4, fontWeight: '700', backgroundColor: 'white' },
  codeJoinBtn: { backgroundColor: '#805ad5', borderRadius: 10, paddingHorizontal: 20, justifyContent: 'center' },
  sectionTitle: { fontWeight: '800', fontSize: 18, color: '#2d3748', marginHorizontal: 16, marginBottom: 8 },
  roomCard: { backgroundColor: 'white', borderRadius: 12, padding: 16, marginHorizontal: 16, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  roomHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  roomName: { fontWeight: '700', fontSize: 16, color: '#2d3748' },
  codeBadge: { backgroundColor: '#ebf8ff', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 2 },
  codeText: { color: '#3182ce', fontWeight: '700', fontSize: 12 },
  roomMeta: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  metaText: { color: '#718096' },
  betText: { fontWeight: '700', color: '#38a169', fontSize: 16 },
  joinBtn: { backgroundColor: '#3182ce', borderRadius: 10, padding: 12, alignItems: 'center' },
  joinBtnDisabled: { backgroundColor: '#e2e8f0' },
  joinBtnText: { color: 'white', fontWeight: '700' },
  emptyText: { textAlign: 'center', color: '#a0aec0', marginTop: 60, fontSize: 16 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modal: { backgroundColor: 'white', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 28 },
  modalTitle: { fontSize: 22, fontWeight: '800', color: '#2d3748', marginBottom: 16 },
  input: { borderWidth: 2, borderColor: '#e2e8f0', borderRadius: 10, padding: 12, fontSize: 16, marginBottom: 12, backgroundColor: '#f7fafc' },
  inputLabel: { fontSize: 14, fontWeight: '600', color: '#4a5568', marginBottom: 6 },
  playersRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  playerBtn: { flex: 1, borderWidth: 2, borderColor: '#e2e8f0', borderRadius: 10, padding: 10, alignItems: 'center' },
  playerBtnActive: { borderColor: '#3182ce', backgroundColor: '#ebf8ff' },
  playerBtnText: { fontWeight: '700', color: '#718096' },
  playerBtnTextActive: { color: '#3182ce' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalBtns: { flexDirection: 'row', gap: 10 },
  modalBtn: { flex: 1, borderRadius: 12, padding: 14, alignItems: 'center' },
  cancelBtn: { backgroundColor: '#f7fafc', borderWidth: 2, borderColor: '#e2e8f0' },
  cancelBtnText: { color: '#718096', fontWeight: '700' },
  createBtn: { backgroundColor: '#38a169' },
  createBtnText: { color: 'white', fontWeight: '700' }
});
