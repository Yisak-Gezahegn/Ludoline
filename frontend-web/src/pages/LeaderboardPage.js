import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usersAPI } from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function LeaderboardPage() {
  const [leaders, setLeaders] = useState([]);
  const { user } = useAuth();
  const { t } = useTranslation();

  useEffect(() => {
    usersAPI.getLeaderboard().then((res) => setLeaders(res.data.leaderboard || []));
  }, []);

  const medals = ['🥇', '🥈', '🥉'];

  return (
    <div style={{ padding: 24, maxWidth: 700, margin: '0 auto' }}>
      <h1 style={{ color: '#2d3748', marginBottom: 24 }}>🏆 {t('leaderboard')}</h1>

      {leaders.map((p, i) => (
        <div key={p.id} style={{
          display: 'flex', alignItems: 'center', gap: 16,
          padding: '16px 20px', marginBottom: 8,
          background: p.id === user?.id ? '#ebf8ff' : 'white',
          borderRadius: 12,
          border: p.id === user?.id ? '2px solid #3182ce' : '2px solid transparent',
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
        }}>
          <span style={{ fontSize: 24, width: 36, textAlign: 'center' }}>
            {i < 3 ? medals[i] : <span style={{ color: '#a0aec0', fontWeight: 700 }}>#{i + 1}</span>}
          </span>
          <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 18 }}>
            {p.username?.[0]?.toUpperCase()}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, color: '#2d3748' }}>{p.username}</div>
            <div style={{ fontSize: 13, color: '#718096' }}>{p.games_played} games · {p.games_won} wins</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontWeight: 800, color: '#38a169', fontSize: 18 }}>{p.total_won?.toFixed(2)} ETB</div>
            <div style={{ fontSize: 12, color: '#a0aec0' }}>{p.score} pts</div>
          </div>
        </div>
      ))}
    </div>
  );
}
