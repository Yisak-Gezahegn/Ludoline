import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { usersAPI } from '../api/client';

export default function LeaderboardScreen() {
  const [leaders, setLeaders] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const res = await usersAPI.getLeaderboard();
      setLeaders(res.data.leaderboard || []);
    } catch {}
  };

  useEffect(() => { load(); }, []);

  const medals = ['🥇', '🥈', '🥉'];

  const renderItem = ({ item, index }) => (
    <View style={styles.row}>
      <Text style={styles.rank}>{index < 3 ? medals[index] : `#${index + 1}`}</Text>
      <View style={styles.avatar}><Text style={styles.avatarText}>{item.username?.[0]?.toUpperCase()}</Text></View>
      <View style={styles.info}>
        <Text style={styles.username}>{item.username}</Text>
        <Text style={styles.sub}>{item.games_played} games · {item.games_won} wins</Text>
      </View>
      <View style={styles.right}>
        <Text style={styles.won}>{parseFloat(item.total_won || 0).toFixed(2)} ETB</Text>
        <Text style={styles.pts}>{item.score} pts</Text>
      </View>
    </View>
  );

  return (
    <FlatList
      data={leaders}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      ListHeaderComponent={<Text style={styles.header}>🏆 Leaderboard</Text>}
      contentContainerStyle={{ padding: 16 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
    />
  );
}

const styles = StyleSheet.create({
  header: { fontSize: 24, fontWeight: '900', color: '#2d3748', marginBottom: 16 },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', borderRadius: 12, padding: 14, marginBottom: 8, gap: 12 },
  rank: { fontSize: 22, width: 36, textAlign: 'center' },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#3182ce', justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: 'white', fontWeight: '900', fontSize: 18 },
  info: { flex: 1 },
  username: { fontWeight: '700', fontSize: 16, color: '#2d3748' },
  sub: { fontSize: 12, color: '#a0aec0', marginTop: 2 },
  right: { alignItems: 'flex-end' },
  won: { fontWeight: '800', color: '#38a169', fontSize: 16 },
  pts: { fontSize: 12, color: '#a0aec0' }
});
