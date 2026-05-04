import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { get } from '../utils/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Try to resume session from stored token
    (async () => {
      try {
        const token = await AsyncStorage.getItem('token');
        if (token) {
          const res = await get('/me');
          if (res?.user?.id) setUser(res.user);
          else await AsyncStorage.removeItem('token');
        }
      } catch (_) {}
      setLoading(false);
    })();
  }, []);

  const login = async (email, password) => {
    const res = await import('../utils/api').then(m => m.post('/login', { email, password }));
    if (res.error) throw new Error(res.error);
    if (res.token) await AsyncStorage.setItem('token', res.token);
    setUser(res.user || res);
    return res;
  };

  const logout = async () => {
    await AsyncStorage.removeItem('token');
    setUser(null);
  };

  const updateUser = (updates) => setUser(prev => ({ ...prev, ...updates }));

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);