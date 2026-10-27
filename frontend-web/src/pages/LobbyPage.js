import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { roomsAPI, walletAPI } from '../api/client';
import { useAuth } from '../context/AuthContext';

const COLOR_DOTS = { red: '#e53e3e', green: '#38a169', yellow: '#d69e2e', blue: '#3182ce' };

export default function LobbyPage() {
  const [rooms, setRooms] = useState([]);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [form, setForm] = useState({ betAmount: 10, maxPlayers: 4, isPrivate: false, name: '' });
  const { user } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const loadData = useCallback(async () => {
    try {
      const [roomsRes, balRes] = await Promise.all([
        roomsAPI.getPublic(),
        walletAPI.getBalance()
      ]);
      setRooms(roomsRes.data.rooms || []);
      setBalance(balRes.data.balance || 0);
    } catch (err) {
      // toast handled by interceptor
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000); // refresh every 10s
    return () => clearInterval(interval);
  }, [loadData]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (balance < form.betAmount) return toast.error(t('insufficientBalance'));
    setLoading(true);
    try {
      const res = await roomsAPI.create(form);
      const { room } = res.data;
      toast.success(t('createRoom'));
      navigate(`/game/${room.id}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create room');
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async (roomId) => {
    setLoading(true);
    try {
      await roomsAPI.join(roomId);
      navigate(`/game/${roomId}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to join');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinByCode = async () => {
    if (!joinCode.trim()) return;
    try {
      const res = await roomsAPI.getByCode(joinCode.trim().toUpperCase());
      const room = res.data.room;
      if (room) handleJoin(room.id);
    } catch {
      toast.error('Room not found');
    }
  };

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
      {/* Balance bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, background: 'white', padding: '16px 24px', borderRadius: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
        <div>
          <span style={{ color: '#718096', fontSize: 14 }}>{t('balance')}</span>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#38a169' }}>{balance.toFixed(2)} ETB</div>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={() => navigate('/wallet')} style={{ padding: '10px 20px', borderRadius: 10, background: '#3182ce', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
            💰 {t('deposit')}
          </button>
          <button onClick={() => setShowCreate(true)} style={{ padding: '10px 20px', borderRadius: 10, background: '#38a169', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
            + {t('createRoom')}
          </button>
        </div>
      </div>

      {/* Join by code */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
        <input
          value={joinCode}
          onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
          placeholder={`${t('enterCode')} (e.g. ABC123)`}
          maxLength={8}
          style={{ flex: 1, padding: '12px 16px', borderRadius: 10, border: '2px solid #e2e8f0', fontSize: 16, outline: 'none', letterSpacing: 3, fontWeight: 700 }}
        />
        <button onClick={handleJoinByCode} style={{ padding: '12px 24px', borderRadius: 10, background: '#805ad5', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
          {t('joinRoom')}
        </button>
      </div>

      {/* Public rooms */}
      <h2 style={{ color: '#2d3748', marginBottom: 16 }}>{t('publicRooms')}</h2>
      {rooms.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#a0aec0', padding: 40 }}>No open rooms. Create one!</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {rooms.map((room) => (
            <motion.div
              key={room.id}
              whileHover={{ y: -4 }}
              style={{ background: 'white', borderRadius: 16, padding: 20, boxShadow: '0 2px 12px rgba(0,0,0,0.08)', cursor: 'pointer' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ fontWeight: 700, color: '#2d3748' }}>{room.name}</span>
                <span style={{ background: '#ebf8ff', color: '#3182ce', padding: '2px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>{room.code}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, color: '#718096', fontSize: 14 }}>
                <span>👥 {room.player_count}/{room.max_players}</span>
                <span style={{ fontWeight: 700, color: '#38a169' }}>{parseFloat(room.bet_amount).toFixed(2)} ETB</span>
              </div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
                {(room.players || []).slice(0, 4).map((p, i) => (
                  <div key={i} style={{ width: 32, height: 32, borderRadius: '50%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>
                    {p.username?.[0]?.toUpperCase() || '?'}
                  </div>
                ))}
              </div>
              <button
                onClick={() => handleJoin(room.id)}
                disabled={loading || balance < room.bet_amount}
                style={{ width: '100%', padding: '10px', borderRadius: 10, background: balance < room.bet_amount ? '#e2e8f0' : '#3182ce', color: balance < room.bet_amount ? '#a0aec0' : 'white', border: 'none', cursor: balance < room.bet_amount ? 'not-allowed' : 'pointer', fontWeight: 700 }}
              >
                {balance < room.bet_amount ? t('insufficientBalance') : `Join — ${parseFloat(room.bet_amount).toFixed(2)} ETB`}
              </button>
            </motion.div>
          ))}
        </div>
      )}

      {/* Create Room Modal */}
      <AnimatePresence>
        {showCreate && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
            onClick={() => setShowCreate(false)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              onClick={(e) => e.stopPropagation()}
              style={{ background: 'white', borderRadius: 20, padding: 32, width: '100%', maxWidth: 420 }}
            >
              <h2 style={{ margin: '0 0 24px', color: '#2d3748' }}>{t('createRoom')}</h2>
              <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={{ fontWeight: 600, color: '#4a5568', display: 'block', marginBottom: 6 }}>Room Name</label>
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="My Lucky Room" maxLength={40} style={{ width: '100%', padding: '12px', borderRadius: 10, border: '2px solid #e2e8f0', fontSize: 15, outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ fontWeight: 600, color: '#4a5568', display: 'block', marginBottom: 6 }}>{t('betAmount')}</label>
                  <input type="number" min={2} max={10000} step={1} value={form.betAmount} onChange={(e) => setForm({ ...form, betAmount: parseFloat(e.target.value) })} required style={{ width: '100%', padding: '12px', borderRadius: 10, border: '2px solid #e2e8f0', fontSize: 15, outline: 'none', boxSizing: 'border-box' }} />
                  <p style={{ fontSize: 12, color: '#a0aec0', margin: '4px 0 0' }}>Min: 2 ETB / Max: 10,000 ETB</p>
                </div>
                <div>
                  <label style={{ fontWeight: 600, color: '#4a5568', display: 'block', marginBottom: 6 }}>{t('players')}</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {[2, 3, 4].map((n) => (
                      <button key={n} type="button" onClick={() => setForm({ ...form, maxPlayers: n })} style={{ flex: 1, padding: '10px', borderRadius: 8, border: `2px solid ${form.maxPlayers === n ? '#3182ce' : '#e2e8f0'}`, background: form.maxPlayers === n ? '#ebf8ff' : 'white', fontWeight: 700, cursor: 'pointer', color: form.maxPlayers === n ? '#3182ce' : '#718096' }}>
                        {n}P
                      </button>
                    ))}
                  </div>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, color: '#4a5568', cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.isPrivate} onChange={(e) => setForm({ ...form, isPrivate: e.target.checked })} />
                  Private Room (invite only)
                </label>
                <div style={{ display: 'flex', gap: 12 }}>
                  <button type="button" onClick={() => setShowCreate(false)} style={{ flex: 1, padding: '12px', borderRadius: 10, background: '#f7fafc', color: '#718096', border: '2px solid #e2e8f0', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
                  <motion.button whileTap={{ scale: 0.97 }} type="submit" disabled={loading} style={{ flex: 2, padding: '12px', borderRadius: 10, background: '#38a169', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 15 }}>
                    {loading ? '...' : `Create — ${form.betAmount} ETB`}
                  </motion.button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
