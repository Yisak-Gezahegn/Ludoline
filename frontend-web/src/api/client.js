import axios from 'axios';
import toast from 'react-hot-toast';

export const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || '/api',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' }
});

// Response interceptor for global error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const msg = error.response?.data?.message || 'Something went wrong';
    if (error.response?.status === 401) {
      localStorage.removeItem('ludoline_token');
      window.location.href = '/login';
    } else if (error.response?.status !== 422) {
      toast.error(msg);
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  requestOtp: (phone, language) => api.post('/auth/request-otp', { phone, language }),
  verifyOtp: (phone, otp) => api.post('/auth/verify-otp', { phone, otp }),
  completeProfile: (data) => api.post('/auth/complete-profile', data),
  me: () => api.get('/auth/me')
};

// Wallet API
export const walletAPI = {
  getBalance: () => api.get('/wallet/balance'),
  deposit: (amount) => api.post('/wallet/deposit', { amount }),
  withdraw: (amount) => api.post('/wallet/withdraw', { amount }),
  getTransactions: (limit = 20, offset = 0) => api.get(`/wallet/transactions?limit=${limit}&offset=${offset}`)
};

// Rooms API
export const roomsAPI = {
  getPublic: () => api.get('/rooms'),
  getByCode: (code) => api.get(`/rooms/${code}`),
  create: (data) => api.post('/rooms', data),
  join: (id) => api.post(`/rooms/${id}/join`),
  getPlayers: (id) => api.get(`/rooms/${id}/players`)
};

// Users API
export const usersAPI = {
  getLeaderboard: () => api.get('/users/leaderboard'),
  getProfile: (username) => api.get(`/users/${username}/profile`),
  getHistory: (limit = 20, offset = 0) => api.get(`/users/me/history?limit=${limit}&offset=${offset}`),
  changeLanguage: (language) => api.patch('/users/me/language', { language })
};
