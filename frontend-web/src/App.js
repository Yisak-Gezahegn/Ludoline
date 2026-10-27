import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import Navbar from './components/layout/Navbar';
import LoginPage from './pages/LoginPage';
import LobbyPage from './pages/LobbyPage';
import WalletPage from './pages/WalletPage';
import LeaderboardPage from './pages/LeaderboardPage';
import GameRoom from './components/game/GameRoom';
import './i18n';

function ProtectedLayout() {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontSize: 48 }}>🎲</div>;
  if (!user) return <Navigate to="/login" replace />;
  return (
    <SocketProvider>
      <Navbar />
      <div style={{ minHeight: 'calc(100vh - 60px)', background: '#f7fafc' }}>
        <Outlet />
      </div>
    </SocketProvider>
  );
}

function ProfilePage() {
  const { user, logout } = useAuth();
  return (
    <div style={{ padding: 24, maxWidth: 600, margin: '0 auto' }}>
      <div style={{ background: 'white', borderRadius: 16, padding: 32, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
        <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#3182ce', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, color: 'white', fontWeight: 900, marginBottom: 16 }}>
          {user?.username?.[0]?.toUpperCase()}
        </div>
        <h2 style={{ margin: '0 0 4px' }}>{user?.username}</h2>
        <p style={{ color: '#718096', margin: '0 0 24px' }}>{user?.phone}</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {[
            { label: 'Score', value: user?.score || 0 },
            { label: 'Games Played', value: user?.games_played || 0 },
            { label: 'Games Won', value: user?.games_won || 0 },
            { label: 'Balance', value: `${parseFloat(user?.balance || 0).toFixed(2)} ETB` }
          ].map(({ label, value }) => (
            <div key={label} style={{ background: '#f7fafc', borderRadius: 10, padding: 16 }}>
              <p style={{ margin: 0, color: '#a0aec0', fontSize: 12 }}>{label}</p>
              <p style={{ margin: 0, fontWeight: 800, fontSize: 22, color: '#2d3748' }}>{value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-center" toastOptions={{ duration: 3000 }} />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedLayout />}>
            <Route path="/lobby" element={<LobbyPage />} />
            <Route path="/wallet" element={<WalletPage />} />
            <Route path="/leaderboard" element={<LeaderboardPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/game/:roomId" element={<GameRoom />} />
          </Route>
          <Route path="*" element={<Navigate to="/lobby" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
