import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  const links = [
    { to: '/lobby', icon: '🏠', label: t('lobby') },
    { to: '/wallet', icon: '💰', label: t('wallet') },
    { to: '/leaderboard', icon: '🏆', label: t('leaderboard') },
    { to: '/profile', icon: '👤', label: t('profile') }
  ];

  return (
    <nav style={{
      position: 'sticky', top: 0, zIndex: 50,
      background: 'white', boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
      padding: '0 24px',
      display: 'flex', alignItems: 'center', height: 60
    }}>
      <div onClick={() => navigate('/lobby')} style={{ fontWeight: 900, fontSize: 22, color: '#3182ce', cursor: 'pointer', marginRight: 32 }}>
        🎲 Ludoline
      </div>

      <div style={{ display: 'flex', gap: 4, flex: 1 }}>
        {links.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            style={({ isActive }) => ({
              padding: '6px 16px', borderRadius: 8,
              background: isActive ? '#ebf8ff' : 'transparent',
              color: isActive ? '#3182ce' : '#718096',
              fontWeight: isActive ? 700 : 500,
              textDecoration: 'none', fontSize: 14,
              display: 'flex', alignItems: 'center', gap: 6
            })}
          >
            {l.icon} {l.label}
          </NavLink>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* Language switcher */}
        <select
          value={i18n.language}
          onChange={(e) => {
            i18n.changeLanguage(e.target.value);
            localStorage.setItem('ludoline_lang', e.target.value);
          }}
          style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '4px 8px', fontSize: 13, cursor: 'pointer', outline: 'none' }}
        >
          <option value="en">🇬🇧 EN</option>
          <option value="am">🇪🇹 አማ</option>
          <option value="or">🇪🇹 ORM</option>
        </select>

        <div style={{ fontWeight: 600, color: '#2d3748', fontSize: 14 }}>{user?.username}</div>
        <button onClick={() => { logout(); navigate('/login'); }} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #e2e8f0', background: 'white', color: '#e53e3e', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
          {t('logout')}
        </button>
      </div>
    </nav>
  );
}
