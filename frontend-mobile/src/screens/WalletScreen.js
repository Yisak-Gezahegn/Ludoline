import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, FlatList, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { walletAPI } from '../api/client';
import { useTranslation } from 'react-i18next';

const TX_LABELS = {
  deposit: { label: 'Deposit', color: '#38a169', sign: '+' },
  withdrawal: { label: 'Withdraw', color: '#e53e3e', sign: '-' },
  bet_deduct: { label: 'Bet', color: '#e53e3e', sign: '-' },
  prize_credit: { label: 'Prize', color: '#38a169', sign: '+' },
  refund: { label: 'Refund', color: '#38a169', sign: '+' }
};

export default function WalletScreen() {
  const [balance, setBalance] = useState(0);
  const [totalWon, setTotalWon] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [amount, setAmount] = useState('');
  const [tab, setTab] = useState('deposit');
  const [loading, setLoading] = useState(false);
  const { t } = useTranslation();

  useEffect(() => { loadWallet(); }, []);

  const loadWallet = async () => {
    try {
      const [balRes, txRes] = await Promise.all([walletAPI.getBalance(), walletAPI.getTransactions()]);
      setBalance(balRes.data.balance || 0);
      setTotalWon(balRes.data.totalWon || 0);
      setTransactions(txRes.data.transactions || []);
    } catch {}
  };

  const handleDeposit = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt < 2 || amt > 10000) return Alert.alert('Error', 'Amount must be 2–10,000 ETB');
    setLoading(true);
    try {
      const res = await walletAPI.deposit(amt);
      Alert.alert('Success', res.data.message || 'Deposit initiated via Telebirr');
      setAmount('');
      setTimeout(loadWallet, 3000);
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Deposit failed');
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt < 2) return Alert.alert('Error', 'Minimum withdrawal is 2 ETB');
    if (amt > balance) return Alert.alert('Error', t('insufficientBalance'));
    setLoading(true);
    try {
      const res = await walletAPI.withdraw(amt);
      Alert.alert('Success', res.data.message || 'Withdrawal sent to Telebirr');
      setAmount('');
      await loadWallet();
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Withdrawal failed');
    } finally {
      setLoading(false);
    }
  };

  const quickAmounts = [10, 50, 100, 500, 1000];

  return (
    <ScrollView style={styles.container}>
      {/* Balance card */}
      <LinearGradient colors={['#2b6cb0', '#3182ce']} style={styles.card}>
        <Text style={styles.cardLabel}>Balance</Text>
        <Text style={styles.cardBalance}>{balance.toFixed(2)} ETB</Text>
        <Text style={styles.cardSub}>Total Won: {totalWon.toFixed(2)} ETB</Text>
      </LinearGradient>

      {/* Tabs */}
      <View style={styles.tabs}>
        {['deposit', 'withdraw'].map((t2) => (
          <TouchableOpacity key={t2} onPress={() => setTab(t2)} style={[styles.tabBtn, tab === t2 && styles.tabBtnActive]}>
            <Text style={[styles.tabText, tab === t2 && styles.tabTextActive]}>{t2 === 'deposit' ? '💰 Deposit' : '🏧 Withdraw'}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Quick amounts */}
      <View style={styles.quickRow}>
        {quickAmounts.map((a) => (
          <TouchableOpacity key={a} onPress={() => setAmount(a.toString())} style={[styles.quickBtn, amount == a && styles.quickBtnActive]}>
            <Text style={[styles.quickText, amount == a && styles.quickTextActive]}>{a}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TextInput
        value={amount}
        onChangeText={setAmount}
        keyboardType="numeric"
        placeholder="Enter amount (ETB)"
        style={styles.input}
      />

      <TouchableOpacity
        onPress={tab === 'deposit' ? handleDeposit : handleWithdraw}
        disabled={loading}
        style={[styles.actionBtn, tab === 'withdraw' && styles.actionBtnRed]}
      >
        {loading ? <ActivityIndicator color="white" /> : (
          <Text style={styles.actionBtnText}>
            {tab === 'deposit' ? 'Deposit via Telebirr' : 'Withdraw to Telebirr'}
          </Text>
        )}
      </TouchableOpacity>

      {/* Transactions */}
      <Text style={styles.sectionTitle}>Transaction History</Text>
      {transactions.map((tx) => {
        const meta = TX_LABELS[tx.type] || { label: tx.type, color: '#718096', sign: '' };
        return (
          <View key={tx.id} style={styles.txRow}>
            <View>
              <Text style={styles.txLabel}>{meta.label}</Text>
              <Text style={styles.txDate}>{new Date(tx.created_at).toLocaleDateString()}</Text>
            </View>
            <Text style={[styles.txAmount, { color: meta.color }]}>
              {meta.sign}{parseFloat(tx.amount).toFixed(2)} ETB
            </Text>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7fafc' },
  card: { margin: 16, borderRadius: 16, padding: 24 },
  cardLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 13 },
  cardBalance: { color: 'white', fontSize: 40, fontWeight: '900', marginVertical: 4 },
  cardSub: { color: 'rgba(255,255,255,0.7)', fontSize: 13 },
  tabs: { flexDirection: 'row', gap: 0, margin: 16, backgroundColor: '#f0f0f0', borderRadius: 10, padding: 4 },
  tabBtn: { flex: 1, padding: 12, borderRadius: 8, alignItems: 'center' },
  tabBtnActive: { backgroundColor: 'white', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  tabText: { fontWeight: '600', color: '#a0aec0' },
  tabTextActive: { color: '#2d3748' },
  quickRow: { flexDirection: 'row', gap: 8, marginHorizontal: 16, marginBottom: 12 },
  quickBtn: { flex: 1, borderWidth: 2, borderColor: '#e2e8f0', borderRadius: 8, padding: 8, alignItems: 'center', backgroundColor: 'white' },
  quickBtnActive: { borderColor: '#3182ce', backgroundColor: '#ebf8ff' },
  quickText: { fontWeight: '600', color: '#718096', fontSize: 13 },
  quickTextActive: { color: '#3182ce' },
  input: { borderWidth: 2, borderColor: '#e2e8f0', borderRadius: 12, padding: 14, fontSize: 20, fontWeight: '700', marginHorizontal: 16, marginBottom: 16, backgroundColor: 'white' },
  actionBtn: { backgroundColor: '#38a169', borderRadius: 12, padding: 16, alignItems: 'center', marginHorizontal: 16, marginBottom: 24 },
  actionBtnRed: { backgroundColor: '#e53e3e' },
  actionBtnText: { color: 'white', fontWeight: '700', fontSize: 17 },
  sectionTitle: { fontWeight: '800', fontSize: 16, color: '#2d3748', marginHorizontal: 16, marginBottom: 8 },
  txRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'white', padding: 16, marginHorizontal: 16, marginBottom: 6, borderRadius: 10 },
  txLabel: { fontWeight: '600', color: '#2d3748' },
  txDate: { fontSize: 12, color: '#a0aec0', marginTop: 2 },
  txAmount: { fontWeight: '800', fontSize: 18 }
});
