import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, getApiErrorMessage } from './api';
import { useTelegram } from './useTelegram';

const TOKEN_KEY = 'gameHub_authToken';
const WEB_PLAYER_ID_KEY = 'gameHub_webPlayerId';
const WEB_NAME_KEY = 'gameHub_webDisplayName';

const AuthContext = createContext(null);

function readToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function persistSession(token, user) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
    if (user?.id) localStorage.setItem(WEB_PLAYER_ID_KEY, String(user.id));
    if (user?.first_name) localStorage.setItem(WEB_NAME_KEY, String(user.first_name));
  } catch (_) {}
}

function clearSessionStorageOnly() {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch (_) {}
}

function clearGuestIdentity() {
  try {
    localStorage.removeItem(WEB_PLAYER_ID_KEY);
    localStorage.removeItem(WEB_NAME_KEY);
  } catch (_) {}
}

export function AuthProvider({ children }) {
  const { user: tgUser, ready: tgReady } = useTelegram();
  const [accountUser, setAccountUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);

  useEffect(() => {
    const token = readToken();
    if (!token) {
      setAuthChecked(true);
      setAccountUser(null);
      return undefined;
    }
    let cancelled = false;
    api
      .get('/auth/me', { skipAuth: true, headers: { Authorization: `Bearer ${token}` } })
      .then((r) => {
        if (cancelled || !r?.user) return;
        setAccountUser(r.user);
        try {
          if (r.user?.id) localStorage.setItem(WEB_PLAYER_ID_KEY, String(r.user.id));
          if (r.user?.first_name) localStorage.setItem(WEB_NAME_KEY, String(r.user.first_name));
        } catch (_) {}
      })
      .catch(() => {
        clearSessionStorageOnly();
        clearGuestIdentity();
        setAccountUser(null);
      })
      .finally(() => {
        if (!cancelled) setAuthChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const user = useMemo(() => {
    if (accountUser) return accountUser;
    return tgUser;
  }, [accountUser, tgUser]);

  const isGuestWeb = Boolean(user?.id && String(user.id).startsWith('web_'));
  const canUseFriendsShop = !isGuestWeb;

  const openAuthModal = useCallback(() => setAuthModalOpen(true), []);
  const closeAuthModal = useCallback(() => setAuthModalOpen(false), []);

  const login = useCallback(async (email, password) => {
    setAuthBusy(true);
    try {
      const r = await api.post('/auth/login', { email, password }, { skipAuth: true });
      if (!r?.token || !r?.user) throw new Error('Нет данных сессии');
      persistSession(r.token, r.user);
      setAccountUser(r.user);
      closeAuthModal();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: getApiErrorMessage(e, 'Не удалось войти') };
    } finally {
      setAuthBusy(false);
    }
  }, [closeAuthModal]);

  const register = useCallback(async (email, password, displayName) => {
    setAuthBusy(true);
    try {
      const r = await api.post(
        '/auth/register',
        { email, password, displayName: displayName || undefined },
        { skipAuth: true },
      );
      if (!r?.token || !r?.user) throw new Error('Нет данных сессии');
      persistSession(r.token, r.user);
      setAccountUser(r.user);
      closeAuthModal();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: getApiErrorMessage(e, 'Не удалось зарегистрироваться') };
    } finally {
      setAuthBusy(false);
    }
  }, [closeAuthModal]);

  const logout = useCallback(() => {
    clearSessionStorageOnly();
    clearGuestIdentity();
    setAccountUser(null);
    window.location.reload();
  }, []);

  const ready = tgReady && authChecked;

  const value = useMemo(
    () => ({
      user,
      ready,
      isGuestWeb,
      canUseFriendsShop,
      accountUser,
      authModalOpen,
      openAuthModal,
      closeAuthModal,
      login,
      register,
      logout,
      authBusy,
    }),
    [
      user,
      ready,
      isGuestWeb,
      canUseFriendsShop,
      accountUser,
      authModalOpen,
      openAuthModal,
      closeAuthModal,
      login,
      register,
      logout,
      authBusy,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
