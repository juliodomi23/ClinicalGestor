import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';

import { API } from '@/lib/api';

// Tiempo restante en segundos antes de que expire el token
const getTokenSecondsLeft = (token) => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp - Math.floor(Date.now() / 1000);
  } catch {
    return 0;
  }
};

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser]       = useState(null);
  const [token, setToken]     = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);
  const refreshTimer          = useRef(null);
  const isRefreshing          = useRef(false);

  const applyToken = useCallback((t) => {
    localStorage.setItem('token', t);
    axios.defaults.headers.common['Authorization'] = `Bearer ${t}`;
    setToken(t);
  }, []);

  const logout = useCallback(() => {
    clearTimeout(refreshTimer.current);
    localStorage.removeItem('token');
    delete axios.defaults.headers.common['Authorization'];
    setToken(null);
    setUser(null);
  }, []);

  const scheduleRefresh = useCallback((t) => {
    clearTimeout(refreshTimer.current);
    const secsLeft = getTokenSecondsLeft(t);
    // Refrescar cuando queden 10 minutos (600 segundos)
    const delay = Math.max((secsLeft - 600) * 1000, 0);
    refreshTimer.current = setTimeout(async () => {
      try {
        const res = await axios.post(`${API}/auth/refresh`);
        applyToken(res.data.access_token);
        scheduleRefresh(res.data.access_token);
      } catch {
        logout();
      }
    }, delay);
  }, [applyToken, logout]);

  // Interceptor: reintenta 1 vez tras refrescar token en 401
  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      res => res,
      async (error) => {
        const original = error.config;
        if (
          error.response?.status === 401 &&
          !original._retry &&
          !original.url?.includes('/auth/login') &&
          !original.url?.includes('/auth/refresh')
        ) {
          original._retry = true;
          if (!isRefreshing.current) {
            isRefreshing.current = true;
            try {
              const res = await axios.post(`${API}/auth/refresh`);
              applyToken(res.data.access_token);
              scheduleRefresh(res.data.access_token);
              original.headers['Authorization'] = `Bearer ${res.data.access_token}`;
              isRefreshing.current = false;
              return axios(original);
            } catch {
              isRefreshing.current = false;
              logout();
            }
          }
        }
        return Promise.reject(error);
      }
    );
    return () => axios.interceptors.response.eject(interceptor);
  }, [applyToken, logout, scheduleRefresh]);

  useEffect(() => {
    if (token) {
      const secsLeft = getTokenSecondsLeft(token);
      if (secsLeft <= 0) {
        logout();
        return;
      }
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      fetchUser();
      scheduleRefresh(token);
    } else {
      setLoading(false);
    }
    return () => clearTimeout(refreshTimer.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchUser = async () => {
    try {
      const response = await axios.get(`${API}/auth/me`);
      setUser(response.data);
    } catch {
      logout();
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    const response = await axios.post(`${API}/auth/login`, { email, password });
    const { access_token, user: userData } = response.data;
    applyToken(access_token);
    scheduleRefresh(access_token);
    setUser(userData);
    return userData;
  };

  const loginWithGoogle = async (credential) => {
    const response = await axios.post(`${API}/auth/google`, { credential });
    const { access_token, user: userData } = response.data;
    applyToken(access_token);
    scheduleRefresh(access_token);
    setUser(userData);
    return userData;
  };

  const value = { user, token, loading, login, loginWithGoogle, logout, isAuthenticated: !!user };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
