import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { walletAPI } from '../api/client';

const TX_TYPE_LABELS = {
  deposit: { label: 'Deposit', color: '#38a169', sign: '+' },
  withdrawal: { label: 'Withdraw', color: '#e53e3e', sign: '-' },
  bet_deduct: { label: 'Bet', color: '#e53e3e', sign: '-' },
  prize_credit: { label: 'Prize', color: '#38a169', sign: '+' },
  platform_fee: { label: 'Fee', color: '#718096', sign: '-' },
  refund: { label: 'Refund', color: '#38a169', sign: '+' }
};

export default function WalletPage() {
  const [balance, setBalance] = useState(0);
  const [totalWon, setTotalWon] = useState(0);
  const [totalLost, setTotalLost] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState('deposit');
  const { t } = useTranslation();

  useEffect(() => {
    loadWallet();
  }, []);

  const loadWallet = async () => {
    try {
      const [balRes, txRes] = await Promise.all([
        walletAPI.getBalance(),
        walletAPI.getTransactions()
      ]);
      setBalance(balRes.data.balance || 0);
      setTotalWon(balRes.data.totalWon || 0);
      setTotalLost(balRes.data.totalLost || 0);
      setTransactions(txRes.data.transactions || []);
    } catch {}
  };

  const handleDeposit = async (e) => {
    e.preventDefault();
    const amount = parseFloat(depositAmount);
    if (!amount || amount < 2 || amount > 10000) return toast.error(t('minBet', { min: 2 }));
    setLoading(true);
    try {
      const res = await walletAPI.deposit(amount);
      toast.success(res.data.message || t('deposit_initiated'));
      setDepositAmount('');
      setTimeout(loadWallet, 2000);
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async (e) => {
    e.preventDefault();
    const amount = parseFloat(withdrawAmount);
    if (!amount || amount < 2) return toast.error(t('minBet', { min: 2 }));
    if (amount > balance) return toast.error(t('insufficientBalance'));
    setLoading(true);
    try {
      const res = await walletAPI.withdraw(amount);
      toast.success(res.data.message);
      setWithdrawAmount('');
      await loadWallet();
    } finally {
      setLoading(false);
    }
  };

  const quickAmounts = [10, 50, 100, 500, 1000, 5000];

  return (
    <div style={{ padding: 24, maxWidth: 700, margin: '0 auto' }}>
      {/* Balance card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ background: 'linear-gradient(135deg, #2b6cb0 0%, #3182ce 100%)', borderRadius: 20, padding: 32, marginBottom: 24, color: 'white' }}
      >
        <p style={{ margin: 0, opacity: 0.8, fontSize: 14 }}>{t('balance')}</p>
        <div style={{ fontSize: 48, fontWeight: 900, margin: '8px 0' }}>{balance.toFixed(2)} <span style={{ fontSize: 20 }}>ETB</span></div>
        <div style={{ display: 'flex', gap: 24 }}>
          <div><p style={{ margin: 0, opacity: 0.7, fontSize: 12 }}>Total Won</p><p style={{ margin: 0, fontWeight: 700 }}>{totalWon.toFixed(2)} ETB</p></div>
          <div><p style={{ margin: 0, opacity: 0.7, fontSize: 12 }}>Total Played</p><p style={{ margin: 0, fontWeight: 700 }}>{totalLost.toFixed(2)} ETB</p></div>
        </div>
      </motion.div>

      {/* Deposit / Withdraw tabs */}
      <div style={{ background: 'white', borderRadius: 16, padding: 24, marginBottom: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
        <div style={{ display: 'flex', gap: 0, marginBottom: 20, background: '#f7fafc', borderRadius: 10, padding: 4 }}>
          {['deposit', 'withdraw'].map((t2) => (
            <button key={t2} onClick={() => setTab(t2)} style={{ flex: 1, padding: '10px', borderRadius: 8, border: 'none', background: tab === t2 ? 'white' : 'transparent', fontWeight: 700, cursor: 'pointer', color: tab === t2 ? '#2d3748' : '#a0aec0', boxShadow: tab === t2 ? '0 2px 4px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.2s' }}>
              {t2 === 'deposit' ? '💰 Deposit' : '🏧 Withdraw'}
            </button>
          ))}
        </div>

        {tab === 'deposit' ? (
          <form onSubmit={handleDeposit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <p style={{ margin: 0, color: '#718096', fontSize: 14 }}>{t('depositVia')}</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {quickAmounts.map((a) => (
                <button key={a} type="button" onClick={() => setDepositAmount(a.toString())} style={{ padding: '8px 16px', borderRadius: 8, border: `2px solid ${depositAmount == a ? '#3182ce' : '#e2e8f0'}`, background: depositAmount == a ? '#ebf8ff' : 'white', cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>
                  {a} ETB
                </button>
              ))}
            </div>
            <input type="number" min={2} max={10000} value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} placeholder="Or enter custom amount" style={{ padding: '14px', borderRadius: 10, border: '2px solid #e2e8f0', fontSize: 18, outline: 'none', fontWeight: 700 }} />
            <motion.button whileTap={{ scale: 0.97 }} type="submit" disabled={loading} style={{ padding: '14px', borderRadius: 10, background: '#38a169', color: 'white', border: 'none', fontSize: 16, fontWeight: 700, cursor: 'pointer' }}>
              {loading ? '...' : `Deposit via Telebirr`}
            </motion.button>
          </form>
        ) : (
          <form onSubmit={handleWithdraw} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <p style={{ margin: 0, color: '#718096', fontSize: 14 }}>Withdraw to your registered Telebirr number</p>
            <input type="number" min={2} max={balance} value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} placeholder="Enter amount" style={{ padding: '14px', borderRadius: 10, border: '2px solid #e2e8f0', fontSize: 18, outline: 'none', fontWeight: 700 }} />
            <div style={{ display: 'flex', gap: 8 }}>
              {[25, 50, 75, 100].map((pct) => (
                <button key={pct} type="button" onClick={() => setWithdrawAmount((balance * pct / 100).toFixed(2))} style={{ flex: 1, padding: '8px', borderRadius: 8, border: '2px solid #e2e8f0', background: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                  {pct}%
                </button>
              ))}
            </div>
            <motion.button whileTap={{ scale: 0.97 }} type="submit" disabled={loading || balance < 2} style={{ padding: '14px', borderRadius: 10, background: '#e53e3e', color: 'white', border: 'none', fontSize: 16, fontWeight: 700, cursor: 'pointer', opacity: balance < 2 ? 0.5 : 1 }}>
              {loading ? '...' : 'Withdraw to Telebirr'}
            </motion.button>
          </form>
        )}
      </div>

      {/* Transaction history */}
      <div style={{ background: 'white', borderRadius: 16, padding: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
        <h3 style={{ margin: '0 0 16px', color: '#2d3748' }}>{t('transactions')}</h3>
        {transactions.length === 0 ? (
          <p style={{ color: '#a0aec0', textAlign: 'center', padding: 20 }}>No transactions yet</p>
        ) : (
          transactions.map((tx) => {
            const meta = TX_TYPE_LABELS[tx.type] || { label: tx.type, color: '#718096', sign: '' };
            return (
              <div key={tx.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #f0f0f0' }}>
                <div>
                  <div style={{ fontWeight: 600, color: '#2d3748' }}>{meta.label}</div>
                  <div style={{ fontSize: 12, color: '#a0aec0' }}>{new Date(tx.created_at).toLocaleDateString()} · {tx.status}</div>
                </div>
                <div style={{ fontWeight: 700, color: meta.color, fontSize: 18 }}>
                  {meta.sign}{parseFloat(tx.amount).toFixed(2)} ETB
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
