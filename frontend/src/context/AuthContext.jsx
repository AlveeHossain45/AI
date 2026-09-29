import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../api/client.js';

const AuthContext = createContext(null);

const DEFAULT_PREFERENCES = {
  theme: 'system',
  mode: 'AUTO',
  showSources: true,
  enterToSend: true,
  speakAnswers: false,
  analyticsOptOut: false,
};

export function AuthProvider ({ children }) {
  const [user, setUser] = useState(null);
  const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await api.get('/api/auth/me');
      setUser(data?.user || null);
      if (data?.user) {
        const prefs = await api.get('/api/user/settings').catch(() => null);
        if (prefs?.preferences) setPreferences({ ...DEFAULT_PREFERENCES, ...prefs.preferences });
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = useCallback(async (email, password) => {
    const data = await api.post('/api/auth/login', { email, password });
    setUser(data.user);
    const prefs = await api.get('/api/user/settings').catch(() => null);
    if (prefs?.preferences) setPreferences({ ...DEFAULT_PREFERENCES, ...prefs.preferences });
    return data.user;
  }, []);

  const register = useCallback(async (payload) => {
    const data = await api.post('/api/auth/register', payload);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    await api.post('/api/auth/logout', {}).catch(() => {});
    setUser(null);
    setPreferences(DEFAULT_PREFERENCES);
  }, []);

  const updatePreferences = useCallback(async (patch) => {
    setPreferences((current) => ({ ...current, ...patch }));
    try {
      const data = await api.patch('/api/user/settings', patch);
      if (data?.preferences) setPreferences(data.preferences);
      return data?.preferences;
    } catch (error) {
      return Promise.reject(error);
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      preferences,
      isAdmin: user?.role === 'ADMIN',
      login,
      register,
      logout,
      refresh,
      setUser,
      updatePreferences,
    }),
    [user, loading, preferences, login, register, logout, refresh, updatePreferences]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

export default AuthContext;
