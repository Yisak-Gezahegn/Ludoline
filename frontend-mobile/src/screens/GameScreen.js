import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  TextInput, Dimensions, Alert, Vibration, ScrollView
} from 'react-native';
import { io } from 'socket.io-client';
import * as SecureStore from 'expo-secure-store';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';

const { width: SCREEN_W } = Dimensions.get('window');
const BOARD_SIZE = SCREEN_W - 32;
const CELL_SIZE = BOARD_SIZE / 15;

const COLOR_HEX = { red: '#e53e3e', green: '#38a169', yellow: '#d69e2e', blue: '#3182ce' };
const SOCKET_URL = process.env.EXPO_PUBLIC_SOCKET_URL || 'http://localhost:3001';

export default function GameScreen({ route, navigation }) {
  const { roomId } = route.params;
  const [socket, setSocket] = useState(null);
  const [gameState, setGameState] = useState(null);
  const [players, setPlayers] = useState([]);
  const [diceValue, setDiceValue] = useState(null);
  const [movablePieces, setMovablePieces] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [currentUserId, setCurrentUserId] = useState(null);
  const [gameOver, setGameOver] = useState(null);
  const [timeLeft, setTimeLeft] = useState(30);
  const timerRef = useRef(null);
  const chatRef = useRef(null);
  const { t } = useTranslation();

  const isMyTurn = gameState?.currentPlayerId === currentUserId;

  useEffect(() => {
    const connect = async () => {
      const token = await SecureStore.getItemAsync('ludoline_token');
      if (!token) return navigation.replace('Login');

      // Get user id from token
      const payload = JSON.parse(atob(token.split('.')[1]));
      setCurrentUserId(payload.id);

      const s = io(SOCKET_URL, {
        auth: { token },
        transports: ['websocket'],
        reconnectionAttempts: 5
      });

      s.on('connect', () => {
        s.emit('room:join', { roomId });
      });

      s.on('room:players_updated', ({ players: p }) => setPlayers(p));
      s.on('game:started', ({ gameState: gs }) => {
        setGameState(gs);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      });
      s.on('game:state', ({ gameState: gs }) => setGameState(gs));
      s.on('game:dice_rolled', ({ playerId, diceValue: dv, movablePieces: mp }) => {
        setDiceValue(dv);
        if (playerId === payload.id) {
          setMovablePieces(mp);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }
      });
      s.on('game:move_applied', ({ events, gameState: gs }) => {
        setGameState(gs);
        setMovablePieces([]);
        setDiceValue(null);
        events.forEach((e) => {
          if (e.type === 'PIECE_KILLED' && e.killedPlayerId === payload.id) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Vibration.vibrate(400);
          }
        });
      });
      s.on('game:next_turn', ({ playerId }) => {
        setTimeLeft(30);
        if (playerId === payload.id) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      });
      s.on('game:over', ({ finishOrder }) => {
        setGameOver(finishOrder);
        const myPos = finishOrder.find((p) => p.playerId === payload.id)?.position;
        if (myPos === 1) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          Vibration.vibrate([0, 200, 100, 200]);
        }
      });
      s.on('game:abandoned', ({ reason }) => {
        Alert.alert('Game Abandoned', reason, [{ text: 'OK', onPress: () => navigation.goBack() }]);
      });
      s.on('chat:message', (msg) => {
        setChatMessages((prev) => [...prev.slice(-100), msg]);
      });

      setSocket(s);
      return () => s.disconnect();
    };

    const cleanup = connect();
    return () => { cleanup.then((fn) => fn && fn()); };
  }, [roomId]);

  useEffect(() => {
    if (!isMyTurn || gameOver) return;
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => Math.max(0, t - 1));
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [isMyTurn, gameState?.currentPlayerId, gameOver]);

  const handleRoll = useCallback(() => {
    if (!isMyTurn || diceValue !== null) return;
    socket?.emit('game:roll_dice', { roomId });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  }, [isMyTurn, diceValue, socket, roomId]);

  const handlePieceSelect = useCallback((pieceId) => {
    if (!isMyTurn || !diceValue) return;
    socket?.emit('game:move_piece', { roomId, pieceId });
  }, [isMyTurn, diceValue, socket, roomId]);

  const sendChat = useCallback(() => {
    if (!chatInput.trim()) return;
    socket?.emit('chat:send', { roomId, message: chatInput.trim() });
    setChatInput('');
  }, [chatInput, socket, roomId]);

  if (!gameState) {
    return (
      <View style={styles.waitingContainer}>
        <Text style={styles.diceAnim}>🎲</Text>
        <Text style={styles.waitingText}>Waiting for players...</Text>
        {players.map((p) => (
          <View key={p.user_id} style={[styles.playerChip, { borderColor: COLOR_HEX[p.color] }]}>
            <Text style={{ color: COLOR_HEX[p.color], fontWeight: '700' }}>{p.username} ({p.color})</Text>
          </View>
        ))}
      </View>
    );
  }

  if (gameOver) {
    const medals = ['🥇', '🥈', '🥉', '4️⃣'];
    return (
      <ScrollView contentContainerStyle={styles.gameOverContainer}>
        <Text style={styles.gameOverTitle}>🎉 Game Over!</Text>
        {gameOver.map((p, i) => {
          const pl = players.find((pl) => pl.user_id === p.playerId);
          return (
            <View key={p.playerId} style={[styles.resultRow, p.playerId === currentUserId && styles.resultRowMine]}>
              <Text style={styles.medal}>{medals[i]}</Text>
              <Text style={styles.resultName}>{pl?.username || 'Player'}</Text>
              <Text style={styles.resultPrize}>+{p.prize || 0} ETB</Text>
            </View>
          );
        })}
        <TouchableOpacity onPress={() => navigation.navigate('Lobby')} style={[styles.btn, styles.btnBlue, { marginTop: 24 }]}>
          <Text style={styles.btnText}>Back to Lobby</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // Dice face
  const renderDots = (value) => {
    const dotPos = {
      1: [[50, 50]],
      2: [[25, 25], [75, 75]],
      3: [[25, 25], [50, 50], [75, 75]],
      4: [[25, 25], [75, 25], [25, 75], [75, 75]],
      5: [[25, 25], [75, 25], [50, 50], [25, 75], [75, 75]],
      6: [[25, 25], [75, 25], [25, 50], [75, 50], [25, 75], [75, 75]]
    };
    return (dotPos[value] || []).map(([x, y], i) => (
      <View key={i} style={[styles.dot, { left: `${x}%`, top: `${y}%` }]} />
    ));
  };

  return (
    <View style={styles.container}>
      {/* Turn indicator */}
      {isMyTurn && (
        <LinearGradient colors={['#3182ce', '#2b6cb0']} style={styles.turnBanner}>
          <Text style={styles.turnText}>🎯 Your Turn! {timeLeft}s</Text>
        </LinearGradient>
      )}

      {/* Board placeholder — simplified for mobile */}
      <View style={styles.boardContainer}>
        <View style={[styles.board, { width: BOARD_SIZE, height: BOARD_SIZE }]}>
          <Text style={{ textAlign: 'center', color: '#718096', marginTop: BOARD_SIZE / 2 - 20 }}>
            🎲 Game in progress...{'\n'}Pieces: tap to move
          </Text>

          {/* Show movable pieces as buttons */}
          {movablePieces.length > 0 && (
            <View style={styles.movableContainer}>
              {movablePieces.map((pid) => (
                <TouchableOpacity key={pid} onPress={() => handlePieceSelect(pid)} style={styles.movableBtn}>
                  <Text style={styles.movableBtnText}>Move Piece {pid + 1}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </View>

      {/* Bottom panel */}
      <View style={styles.bottomPanel}>
        {/* Dice */}
        <TouchableOpacity
          onPress={handleRoll}
          disabled={!isMyTurn || diceValue !== null}
          style={[styles.diceBox, isMyTurn && !diceValue && styles.diceBoxActive]}
        >
          {diceValue ? renderDots(diceValue) : <Text style={styles.diceLabel}>{isMyTurn ? '🎲 TAP' : '—'}</Text>}
        </TouchableOpacity>

        {/* Players */}
        <View style={styles.playersList}>
          {Object.values(gameState.players).map((p) => {
            const pl = players.find((pl) => pl.user_id === p.id);
            return (
              <View key={p.id} style={[styles.playerRow, p.id === gameState.currentPlayerId && styles.playerRowActive]}>
                <View style={[styles.colorDot, { backgroundColor: COLOR_HEX[p.color] }]} />
                <Text style={styles.playerName}>{pl?.username?.substring(0, 10) || p.color}</Text>
                <Text style={styles.playerScore}>{p.score}pts</Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* Chat */}
      <View style={styles.chatContainer}>
        <FlatList
          data={chatMessages}
          keyExtractor={(_, i) => i.toString()}
          renderItem={({ item }) => (
            <Text style={styles.chatMsg}><Text style={{ color: '#3182ce', fontWeight: '700' }}>{item.username}: </Text>{item.message}</Text>
          )}
          style={{ maxHeight: 80 }}
          ref={chatRef}
          onContentSizeChange={() => chatRef.current?.scrollToEnd()}
        />
        <View style={styles.chatInputRow}>
          <TextInput value={chatInput} onChangeText={setChatInput} placeholder="Message..." style={styles.chatInput} onSubmitEditing={sendChat} maxLength={200} />
          <TouchableOpacity onPress={sendChat} style={styles.chatSendBtn}>
            <Text style={{ color: 'white', fontWeight: '700' }}>➤</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7fafc' },
  waitingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  diceAnim: { fontSize: 64 },
  waitingText: { fontSize: 20, fontWeight: '700', color: '#2d3748' },
  playerChip: { borderWidth: 2, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },
  turnBanner: { padding: 10, alignItems: 'center' },
  turnText: { color: 'white', fontWeight: '800', fontSize: 16 },
  boardContainer: { alignItems: 'center', padding: 16 },
  board: { backgroundColor: 'white', borderRadius: 12, borderWidth: 2, borderColor: '#2d3748', justifyContent: 'center', alignItems: 'center' },
  movableContainer: { position: 'absolute', bottom: 16, left: 16, right: 16, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  movableBtn: { backgroundColor: '#38a169', borderRadius: 8, padding: 10, flex: 1 },
  movableBtnText: { color: 'white', fontWeight: '700', textAlign: 'center', fontSize: 13 },
  bottomPanel: { flexDirection: 'row', padding: 16, gap: 12 },
  diceBox: { width: 72, height: 72, backgroundColor: 'white', borderRadius: 12, borderWidth: 3, borderColor: '#e2e8f0', justifyContent: 'center', alignItems: 'center', position: 'relative' },
  diceBoxActive: { borderColor: '#3182ce', shadowColor: '#3182ce', shadowOpacity: 0.4, shadowRadius: 8, elevation: 6 },
  diceLabel: { color: '#a0aec0', fontWeight: '700', fontSize: 13 },
  dot: { position: 'absolute', width: 14, height: 14, borderRadius: 7, backgroundColor: '#2d3748', transform: [{ translateX: -7 }, { translateY: -7 }] },
  playersList: { flex: 1, gap: 6 },
  playerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 6, borderRadius: 8, backgroundColor: 'white' },
  playerRowActive: { backgroundColor: '#ebf8ff', borderWidth: 1, borderColor: '#3182ce' },
  colorDot: { width: 10, height: 10, borderRadius: 5 },
  playerName: { flex: 1, fontWeight: '600', fontSize: 13, color: '#2d3748' },
  playerScore: { fontSize: 12, color: '#718096' },
  chatContainer: { backgroundColor: 'white', padding: 12, borderTopWidth: 1, borderColor: '#e2e8f0' },
  chatMsg: { fontSize: 13, color: '#2d3748', marginBottom: 2 },
  chatInputRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  chatInput: { flex: 1, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 8, fontSize: 14 },
  chatSendBtn: { backgroundColor: '#3182ce', borderRadius: 8, paddingHorizontal: 12, justifyContent: 'center' },
  gameOverContainer: { padding: 24, alignItems: 'center', gap: 12 },
  gameOverTitle: { fontSize: 32, fontWeight: '900', color: '#2d3748' },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: '12px 20px', backgroundColor: 'white', borderRadius: 12, width: '100%' },
  resultRowMine: { backgroundColor: '#ebf8ff', borderWidth: 2, borderColor: '#3182ce' },
  medal: { fontSize: 28 },
  resultName: { flex: 1, fontWeight: '700', fontSize: 16, color: '#2d3748' },
  resultPrize: { fontWeight: '800', fontSize: 18, color: '#38a169' },
  btn: { borderRadius: 12, padding: 16, alignItems: 'center', width: '100%' },
  btnBlue: { backgroundColor: '#3182ce' },
  btnText: { color: 'white', fontSize: 17, fontWeight: '700' }
});
