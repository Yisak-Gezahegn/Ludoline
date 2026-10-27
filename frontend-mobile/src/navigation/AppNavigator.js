import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { ActivityIndicator, View } from 'react-native';
import LoginScreen from '../screens/LoginScreen';
import GameScreen from '../screens/GameScreen';

// Lazy imports for main screens
const LobbyScreen = require('../screens/LobbyScreen').default;
const WalletScreen = require('../screens/WalletScreen').default;
const LeaderboardScreen = require('../screens/LeaderboardScreen').default;
const ProfileScreen = require('../screens/ProfileScreen').default;

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          const icons = {
            Lobby: focused ? 'home' : 'home-outline',
            Wallet: focused ? 'wallet' : 'wallet-outline',
            Leaderboard: focused ? 'trophy' : 'trophy-outline',
            Profile: focused ? 'person' : 'person-outline'
          };
          return <Ionicons name={icons[route.name]} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#3182ce',
        tabBarInactiveTintColor: '#a0aec0',
        headerStyle: { backgroundColor: '#3182ce' },
        headerTintColor: 'white',
        headerTitleStyle: { fontWeight: '900' },
        headerLeft: () => null
      })}
    >
      <Tab.Screen name="Lobby" component={LobbyScreen} options={{ title: 'Lobby' }} />
      <Tab.Screen name="Wallet" component={WalletScreen} options={{ title: 'Wallet' }} />
      <Tab.Screen name="Leaderboard" component={LeaderboardScreen} options={{ title: 'Leaderboard' }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profile' }} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const [initialRoute, setInitialRoute] = useState(null);

  useEffect(() => {
    SecureStore.getItemAsync('ludoline_token').then((token) => {
      setInitialRoute(token ? 'Main' : 'Login');
    });
  }, []);

  if (!initialRoute) {
    return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator size="large" color="#3182ce" /></View>;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName={initialRoute} screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Main" component={MainTabs} />
        <Stack.Screen
          name="Game"
          component={GameScreen}
          options={{ headerShown: true, title: 'Ludoline', headerStyle: { backgroundColor: '#3182ce' }, headerTintColor: 'white' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
