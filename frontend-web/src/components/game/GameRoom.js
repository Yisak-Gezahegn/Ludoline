import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import Confetti from 'react-confetti';
import LudoBoard from './LudoBoard';
import Dice from './Dice';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';

export default function GameRoom() {
  const { roomId } = useParams();
  const { socket } = useSocket();
  const { user, updateUser } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [gameState, setGameState] = useState(null);
  const [players, setPlayers] = useState([]);
  const [diceValue, setDiceValue] = useState(null);
  const [diceRolling, setDiceRolling] = useState(false);
  const [movablePieces, setMovablePieces] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [gameOver, setGameOver] = useState(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [timeLeft, setTimeLeft] = useState(30);
  const timerRef = useRef(null);
  const chatEndRef = useRef(null);

  const isMyTurn = gameState?.currentPlayerId === user?.id;

  // ─── Socket events ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!socket || !roomId) return;

    socket.emit('room:join', { roomId });

    socket.on('game:state', ({ gameState: gs }) => setGameState(gs));
    socket.on('game:started', ({ gameState: gs }) => {
      setGameState(gs);
      toast.success('Game started!');
    });

    socket.on('room:players_updated', ({ players: p }) => setPlayers(p));

    socket.on('game:dice_rolled', ({ playerId, diceValue: dv, movablePieces: mp }) => {
      setDiceRolling(false);
      setDiceValue(dv);
      if (playerId === user.id) {
        setMovablePieces(mp);
        if (mp.length === 0) toast(`No moves available. Skipping...`);
      }
    });

    socket.on('game:move_applied', ({ events, gameState: gs }) => {
      setGameState(gs);
      setMovablePieces([]);
      setDiceValue(null);
      events.forEach((e) => {
        if (e.type === 'PIECE_KILLED' && e.killedPlayerId === user.id) toast.error('Your piece was sent back! 😱');
        if (e.type === 'PIECE_KILLED' && e.killedPlayerId !== user.id) toast.success('You killed a piece! ⚔️');
        if (e.type === 'EXTRA_TURN' && e.playerId === user.id) toast('Extra turn! 🎲');
        if (e.type === 'THREE_SIXES') toast.error('Three sixes! Turn forfeited.');
      });
    });

    socket.on('game:next_turn', ({ playerId }) => {
      setTimeLeft(30);
      if (playerId === user.id) toast('Your turn! 🎯', { icon: '🎲' });
    });

    socket.on('game:turn_timeout', ({ playerId }) => {
      if (playerId === user.id) toast.error('Turn timed out!');
    });

    socket.on('game:over', ({ finishOrder }) => {
      const myResult = finishOrder.find((p) => p.playerId === user.id);
      setGameOver(finishOrder);
      if (myResult?.position === 1) {
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 8000);
      }
    });

    socket.on('game:abandoned', ({ reason }) => {
      toast.error(`Game abandoned: ${reason}`);
      setTimeout(() => navigate('/lobby'), 3000);
    });

    socket.on('chat:message', (msg) => {
      setChatMessages((prev) => [...prev.slice(-100), msg]);
    });

    return () => {
      socket.off('game:state');
      socket.off('game:started');
      socket.off('room:players_updated');
      socket.off('game:dice_rolled');
      socket.off('game:move_applied');
      socket.off('game:next_turn');
      socket.off('game:turn_timeout');
      socket.off('game:over');
      socket.off('game:abandoned');
      socket.off('chat:message');
    };
  }, [socket, roomId, user?.id, navigate]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Turn countdown
  useEffect(() => {
    if (!isMyTurn || gameOver) return;
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => Math.max(0, t - 1));
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [isMyTurn, gameState?.currentPlayerId, gameOver]);

  const handleRoll = useCallback(() => {
    if (!isMyTurn || diceValue !== null) return;
    setDiceRolling(true);
    socket.emit('game:roll_dice', { roomId });
  }, [isMyTurn, diceValue, socket, roomId]);

  const handlePieceSelect = useCallback((pieceId) => {
    if (!isMyTurn || !diceValue) return;
    socket.emit('game:move_piece', { roomId, pieceId });
  }, [isMyTurn, diceValue, socket, roomId]);

  const sendChat = useCallback(() => {
    if (!chatInput.trim()) return;
    socket.emit('chat:send', { roomId, message: chatInput.trim() });
    setChatInput('');
  }, [chatInput, socket, roomId]);

  // ─── Waiting for players ────────────────────────────────────────────────
  if (!gameState) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '80vh', gap: 16 }}>
        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }} style={{ fontSize: 48 }}>🎲</motion.div>
        <h2>Waiting for players...</h2>
        <div style={{ display: 'flex', gap: 12 }}>
          {players.map((p) => (
            <div key={p.user_id} style={{ padding: '8px 16px', background: '#e2e8f0', borderRadius: 8 }}>
              {p.username} ({p.color})
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ─── Game Over ──────────────────────────────────────────────────────────
  if (gameOver) {
    const myResult = gameOver.find((p) => p.playerId === user.id);
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '80vh', gap: 24, padding: 24 }}>
        {showConfetti && <Confetti />}
        <h1 style={{ fontSize: 36 }}>{t('gameOver')}</h1>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', maxWidth: 400 }}>
          {gameOver.map((p, i) => {
            const medals = ['🥇', '🥈', '🥉', '4️⃣'];
            const labels = [t('firstPlace'), t('secondPlace'), t('thirdPlace'), 'Last'];
            return (
              <div key={p.playerId} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '12px 20px', background: p.playerId === user.id ? '#ebf8ff' : '#f7fafc',
                borderRadius: 12, border: `2px solid ${p.playerId === user.id ? '#3182ce' : '#e2e8f0'}`
              }}>
                <span style={{ fontSize: 24 }}>{medals[i]}</span>
                <span style={{ fontWeight: 700 }}>{players.find((pl) => pl.user_id === p.playerId)?.username || 'Player'}</span>
                <span style={{ color: '#38a169', fontWeight: 700 }}>+{p.prize || 0} ETB</span>
              </div>
            );
          })}
        </div>
        {myResult?.position === 1 && <div style={{ fontSize: 28, fontWeight: 700, color: '#d69e2e' }}>🎉 {t('youWon', { amount: myResult.prize || 0 })}</div>}
        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={() => navigate('/lobby')} style={{ padding: '12px 24px', borderRadius: 8, background: '#3182ce', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 16 }}>
            {t('backToLobby')}
          </button>
        </div>
      </div>
    );
  }

  const currentPlayerColor = gameState.players[gameState.currentPlayerId]?.color;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#f7fafc' }}>
      {/* Top bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', background: 'white', boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }}>
        <div style={{ fontWeight: 800, fontSize: 20, color: '#2d3748' }}>🎲 Ludoline</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {Object.values(gameState.players).map((p) => (
            <div key={p.id} style={{
              padding: '4px 12px', borderRadius: 20,
              background: p.id === gameState.currentPlayerId ? '#3182ce' : '#e2e8f0',
              color: p.id === gameState.currentPlayerId ? 'white' : '#2d3748',
              fontWeight: 600, fontSize: 13
            }}>
              {players.find((pl) => pl.user_id === p.id)?.username?.substring(0, 8) || p.color}: {p.score}
            </div>
          ))}
        </div>
        <div style={{ fontWeight: 700, color: '#38a169' }}>Pot: {gameState.totalPot} ETB</div>
      </div>

      {/* Turn indicator */}
      <AnimatePresence>
        {isMyTurn && (
          <motion.div
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -50, opacity: 0 }}
            style={{ background: '#3182ce', color: 'white', textAlign: 'center', padding: '8px', fontWeight: 700, fontSize: 16 }}
          >
            🎯 {t('yourTurn')} — {timeLeft}s
          </motion.div>
        )}
      </AnimatePresence>

      <div style={{ display: 'flex', flex: 1, gap: 16, padding: 16, maxWidth: 1200, margin: '0 auto', width: '100%' }}>
        {/* Board */}
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }}>
          <LudoBoard
            gameState={gameState}
            currentUserId={user.id}
            movablePieces={movablePieces}
            onPieceSelect={handlePieceSelect}
          />
        </div>

        {/* Side panel */}
        <div style={{ width: 280, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Dice */}
          <div style={{ background: 'white', borderRadius: 12, padding: 16, textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
            <Dice
              value={diceValue}
              rolling={diceRolling}
              canRoll={isMyTurn && !diceValue}
              onRoll={handleRoll}
            />
          </div>

          {/* Players list */}
          <div style={{ background: 'white', borderRadius: 12, padding: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
            {Object.values(gameState.players).map((p) => {
              const pUser = players.find((pl) => pl.user_id === p.id);
              return (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #f0f0f0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 12, height: 12, borderRadius: '50%', background: p.color }} />
                    <span style={{ fontWeight: p.id === user.id ? 700 : 400 }}>{pUser?.username || p.color}</span>
                    {p.id === gameState.currentPlayerId && <span>🎲</span>}
                  </div>
                  <span style={{ color: '#718096', fontSize: 13 }}>{p.score}pts</span>
                </div>
              );
            })}
          </div>

          {/* Chat */}
          <div style={{ background: 'white', borderRadius: 12, padding: 16, flex: 1, display: 'flex', flexDirection: 'column', gap: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
            <div style={{ fontWeight: 700, color: '#2d3748', marginBottom: 4 }}>{t('chat')}</div>
            <div style={{ flex: 1, overflowY: 'auto', maxHeight: 200, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {chatMessages.map((m, i) => (
                <div key={i} style={{ fontSize: 13 }}>
                  <b style={{ color: '#3182ce' }}>{m.username}: </b>{m.message}
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendChat()}
                placeholder={t('sendMessage')}
                style={{ flex: 1, padding: '6px 10px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 13, outline: 'none' }}
                maxLength={200}
              />
              <button onClick={sendChat} style={{ background: '#3182ce', color: 'white', border: 'none', borderRadius: 6, padding: '6px 12px', cursor: 'pointer' }}>➤</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
