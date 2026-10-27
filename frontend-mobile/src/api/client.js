import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001/api';

export const api = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' }
});

api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('ludoline_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    if (err.response?.status === 401) {
      await SecureStore.deleteItemAsync('ludoline_token');
    }
    return Promise.reject(err);
  }
);

export const authAPI = {
  requestOtp: (phone, language) => api.post('/auth/request-otp', { phone, language }),
  verifyOtp: (phone, otp) => api.post('/auth/verify-otp', { phone, otp }),
  completeProfile: (data) => api.post('/auth/complete-profile', data),
  me: () => api.get('/auth/me')
};

export const walletAPI = {
  getBalance: () => api.get('/wallet/balance'),
  deposit: (amount) => api.post('/wallet/deposit', { amount }),
  withdraw: (amount) => api.post('/wallet/withdraw', { amount }),
  getTransactions: (limit = 20) => api.get(`/wallet/transactions?limit=${limit}`)
};

export const roomsAPI = {
  getPublic: () => api.get('/rooms'),
  getByCode: (code) => api.get(`/rooms/${code}`),
  create: (data) => api.post('/rooms', data),
  join: (id) => api.post(`/rooms/${id}/join`)
};

export const usersAPI = {
  getLeaderboard: () => api.get('/users/leaderboard'),
  getHistory: () => api.get('/users/me/history'),
  changeLanguage: (language) => api.patch('/users/me/language', { language })
};
