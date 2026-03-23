import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './authContext';
import AuthModal from './components/AuthModal';
import { api, getApiErrorMessage } from './api';
import { getDefaultGameSettings, VALID_LOBBY_PRESET_IDS } from './lobbyPresets';
import { socket } from './socket';
import { addSessionTime, recordGameFinish, recordGameStart, touchVisit } from './stats';
import { getInventory } from './inventory';
import { getAvatar, getDisplayName, getProfilePhoto } from './displayName';
import { showAdIfNeeded } from './ads';
import { track } from './analytics';
import { reapplyStoredTheme } from './theme';
import { usePresenceHeartbeat } from './usePresenceHeartbeat';
import {
  detectAcquisition,
  getOrCreateSessionId,
  getOrCreateVisitorId,
  isSessionStartedSent,
  markSessionStartedSent,
} from './webAnalytics';
import FriendsIncomingModal from './components/FriendsIncomingModal';
import Home from './pages/Home';
import { ToastProvider, useToast } from './components/ui/ToastProvider';
import RouteLoadingFallback from './components/RouteLoadingFallback';

const Profile = lazy(() => import('./pages/Profile'));
const Lobby = lazy(() => import('./pages/Lobby'));
const SpyRound = lazy(() => import('./pages/SpyRound'));
const MafiaRound = lazy(() => import('./pages/MafiaRound'));
const EliasRound = lazy(() => import('./pages/EliasRound'));
const TruthDareRound = lazy(() => import('./pages/TruthDareRound'));
const BunkerRound = lazy(() => import('./pages/BunkerRound'));
const Admin = lazy(() => import('./pages/Admin'));
const SeoGameSpy = lazy(() => import('./pages/SeoGameSpy'));
const SeoGameElias = lazy(() => import('./pages/SeoGameElias'));
const SeoGameMafia = lazy(() => import('./pages/SeoGameMafia'));
const SeoGameTruthDare = lazy(() => import('./pages/SeoGameTruthDare'));
const SeoGameBunker = lazy(() => import('./pages/SeoGameBunker'));
const SeoPrivacy = lazy(() => import('./pages/SeoPrivacy'));
const SeoRules = lazy(() => import('./pages/SeoRules'));
const FriendsPage = lazy(() => import('./pages/Friends'));
const ANALYTICS_BASE =
  (import.meta.env.VITE_API_URL !== undefined && import.meta.env.VITE_API_URL !== '')
    ? import.meta.env.VITE_API_URL
    : (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');
const ANALYTICS_TRACK_URL = `${ANALYTICS_BASE}/api/analytics/track`;

/** Игра идёт или только что закончилась — держим маршрут /spy, /elias и т.д., чтобы экран победы не схлопывался */
function allowGameRoundRoute(room, gameId) {
  if (!room || !gameId) return false;
  if (room.state === 'playing' && room.game === gameId) return true;
  if (room.state === 'lobby' && room.lastGameResult?.game === gameId) return true;
  return false;
}

function AppRoutes() {
  const { showToast } = useToast();
  const { user, ready } = useAuth();
  const [room, setRoom] = useState(null);
  const [roomId, setRoomId] = useState(null);
  const [socketReconnecting, setSocketReconnecting] = useState(false);
  const [isOnline, setIsOnline] = useState(() => (typeof navigator !== 'undefined' ? navigator.onLine : true));
  const navigate = useNavigate();
  const location = useLocation();
  const routeRef = useRef({ path: '', startedAt: 0 });
  const refreshInFlightRef = useRef(false);
  const refreshPendingRef = useRef(false);
  const refreshLastAtRef = useRef(0);

  useEffect(() => {
    touchVisit();
    let lastTs = Date.now();
    const timer = setInterval(() => {
      const now = Date.now();
      addSessionTime(Math.round((now - lastTs) / 1000));
      lastTs = now;
    }, 15000);
    return () => {
      const now = Date.now();
      addSessionTime(Math.round((now - lastTs) / 1000));
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  useEffect(() => {
    const onPwaReady = () => {
      try {
        if (sessionStorage.getItem('gh_pwa_toast_shown')) return;
        sessionStorage.setItem('gh_pwa_toast_shown', '1');
      } catch (_) {}
      showToast({
        type: 'info',
        message: 'Интерфейс сохранён для быстрой работы — так бывает обычно один раз.',
        durationMs: 4200,
      });
    };
    window.addEventListener('gh-pwa-offline-ready', onPwaReady);
    return () => window.removeEventListener('gh-pwa-offline-ready', onPwaReady);
  }, [showToast]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const invite = params.get('invite');
    if (invite) {
      sessionStorage.setItem('pendingInvite', invite);
      track('invite_open', { source: 'url', hasInvite: true });
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    const now = Date.now();
    const visitorId = getOrCreateVisitorId();
    const sessionId = getOrCreateSessionId();
    const currentPath = location.pathname || '/';
    const prev = routeRef.current;

    // Закрываем предыдущую страницу по времени в рамках SPA-навигации
    if (prev.path && prev.startedAt) {
      const dwellMs = now - prev.startedAt;
      if (dwellMs > 4000) {
        api
          .post('/analytics/track', {
            type: 'page_dwell',
            visitorId,
            sessionId,
            path: prev.path,
            dwellMs,
          })
          .catch(() => {});
      }
    }

    // Начало сессии — один раз за вкладку
    if (!isSessionStartedSent()) {
      const acq = detectAcquisition(
        typeof window !== 'undefined' ? window.location.search : '',
        typeof document !== 'undefined' ? document.referrer : '',
      );
      api
        .post('/analytics/track', {
          type: 'session_start',
          visitorId,
          sessionId,
          path: currentPath,
          sourceType: acq.sourceType,
          sourceName: acq.sourceName,
          utmCampaign: acq.utmCampaign,
        })
        .catch(() => {});
      markSessionStartedSent();
    }

    api
      .post('/analytics/track', {
        type: 'page_view',
        visitorId,
        sessionId,
        path: currentPath,
      })
      .catch(() => {});

    routeRef.current = { path: currentPath, startedAt: now };
  }, [ready, location.pathname]);

  useEffect(() => {
    if (!ready) return undefined;
    const sendDwellBeacon = () => {
      const now = Date.now();
      const prev = routeRef.current;
      if (!prev?.path || !prev?.startedAt) return;
      const dwellMs = now - prev.startedAt;
      if (dwellMs <= 4000) return;
      const payload = {
        type: 'page_dwell',
        visitorId: getOrCreateVisitorId(),
        sessionId: getOrCreateSessionId(),
        path: prev.path,
        dwellMs,
      };
      try {
        if (navigator.sendBeacon) {
          const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
          navigator.sendBeacon(ANALYTICS_TRACK_URL, blob);
        } else {
          fetch(ANALYTICS_TRACK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            keepalive: true,
          }).catch(() => {});
        }
      } catch (_) {}
      routeRef.current = { ...prev, startedAt: now };
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') sendDwellBeacon();
    };
    const onBeforeUnload = () => sendDwellBeacon();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [ready]);

  /** После Telegram.ready() — ещё раз применить тему (перебить inline-переменные). */
  useEffect(() => {
    if (ready) reapplyStoredTheme();
  }, [ready]);

  usePresenceHeartbeat({ userId: user?.id, room, roomId, user });

  /** Telegram WebApp перезаписывает --tg-theme-* на <html> после загрузки — повторяем нашу тему. */
  useEffect(() => {
    const run = () => reapplyStoredTheme();
    run();
    const a = requestAnimationFrame(run);
    const t0 = setTimeout(run, 0);
    const t1 = setTimeout(run, 50);
    const t2 = setTimeout(run, 250);
    const tg = typeof window !== 'undefined' ? window.Telegram?.WebApp : null;
    const onTgTheme = () => run();
    try {
      tg?.onEvent?.('themeChanged', onTgTheme);
    } catch (_) {}
    try {
      tg?.onEvent?.('theme_changed', onTgTheme);
    } catch (_) {}
    return () => {
      cancelAnimationFrame(a);
      clearTimeout(t0);
      clearTimeout(t1);
      clearTimeout(t2);
      try {
        tg?.offEvent?.('themeChanged', onTgTheme);
      } catch (_) {}
      try {
        tg?.offEvent?.('theme_changed', onTgTheme);
      } catch (_) {}
    };
  }, []);

  const createRoom = useCallback(
    async (options = {}) => {
      const presetGame = options?.presetGame;
      if (!user?.id) return;
      const inv = getInventory();
      const displayName = getDisplayName();
      const avatarEmoji = getAvatar();
      const customPhoto = getProfilePhoto();
      const { room: r, inviteToken } = await api.post('/rooms', {
        hostId: String(user.id),
        hostName: displayName || user.first_name || 'Хост',
        hostPhotoUrl: customPhoto || user.photo_url || null,
        hostHasPro: inv.hasPro,
        hostAvatarEmoji: avatarEmoji || null,
      });
      let nextRoom = r;
      if (presetGame && VALID_LOBBY_PRESET_IDS.has(presetGame)) {
        const gs = getDefaultGameSettings(presetGame);
        if (gs) {
          const { room: patched } = await api.patch(`/rooms/${r.id}`, {
            hostId: String(user.id),
            selectedGame: presetGame,
            gameSettings: gs,
          });
          if (patched) nextRoom = patched;
        }
      }
      setRoom(nextRoom);
      setRoomId(nextRoom.id);
      sessionStorage.setItem('inviteToken', inviteToken);
      try {
        sessionStorage.removeItem('gameHub_rematchRoomId');
      } catch (_) {}
      track('room_create', { roomId: r.id, presetGame: presetGame || null });
      socket.connect(nextRoom.id, { id: String(user.id), name: displayName || user.first_name || 'Игрок', isHost: true });
    },
    [user?.id],
  );

  /** С лендинга игры: после перехода на главную создать комнату с выбранной игрой и настройками по умолчанию. */
  useEffect(() => {
    if (!ready || !user?.id) return;
    if (location.pathname !== '/') return;
    let preset = null;
    try {
      preset = sessionStorage.getItem('gh_create_lobby_preset');
    } catch (_) {}
    if (!preset || !VALID_LOBBY_PRESET_IDS.has(preset)) return;

    if (roomId) {
      try {
        sessionStorage.removeItem('gh_create_lobby_preset');
      } catch (_) {}
      showToast({
        type: 'info',
        message: 'У вас уже есть комната — открыли лобби.',
        durationMs: 4200,
      });
      navigate('/lobby');
      return;
    }

    try {
      sessionStorage.removeItem('gh_create_lobby_preset');
    } catch (_) {}
    const claimed = preset;

    (async () => {
      try {
        await createRoom({ presetGame: claimed });
        navigate('/lobby');
      } catch (e) {
        showToast({
          type: 'error',
          message: getApiErrorMessage(e, 'Не удалось создать комнату'),
          durationMs: 5200,
        });
      }
    })();
  }, [ready, user?.id, location.pathname, roomId, createRoom, navigate, showToast]);

  const joinByCode = async (code) => {
    if (!user?.id) return null;
    const inv = getInventory();
    const displayName = getDisplayName();
    const avatarEmoji = getAvatar();
    const customPhoto = getProfilePhoto();
    const { room: r } = await api.post('/rooms/join', {
      code: code.trim(),
      playerId: String(user.id),
      playerName: displayName || user.first_name || 'Игрок',
      inventory: { dictionaries: inv.dictionaries, unlockedItems: inv.unlockedItems || [], hasPro: inv.hasPro },
      photo_url: customPhoto || user.photo_url || null,
      avatar_emoji: avatarEmoji || null,
    });
    setRoom(r);
    setRoomId(r.id);
    try {
      sessionStorage.removeItem('gameHub_rematchRoomId');
    } catch (_) {}
    track('room_join', { roomId: r.id, source: 'code' });
    socket.connect(r.id, { id: String(user.id), name: displayName || user.first_name || 'Игрок', isHost: false });
    return r;
  };

  const joinByInvite = async (inviteParam) => {
    if (!user?.id) return null;
    const inv = getInventory();
    const displayName = getDisplayName();
    const avatarEmoji = getAvatar();
    const customPhoto = getProfilePhoto();
    track('invite_join_attempt', { source: 'invite' });
    try {
      const { room: r } = await api.post('/rooms/join', {
        inviteToken: inviteParam,
        playerId: String(user.id),
        playerName: displayName || user.first_name || 'Игрок',
        inventory: { dictionaries: inv.dictionaries, unlockedItems: inv.unlockedItems || [], hasPro: inv.hasPro },
        photo_url: customPhoto || user.photo_url || null,
        avatar_emoji: avatarEmoji || null,
      });
      setRoom(r);
      setRoomId(r.id);
      try {
        sessionStorage.removeItem('gameHub_rematchRoomId');
      } catch (_) {}
      track('room_join', { roomId: r.id, source: 'invite' });
      socket.connect(r.id, { id: String(user.id), name: displayName || user.first_name || 'Игрок', isHost: false });
      return r;
    } catch (e) {
      track('invite_join_failed', { source: 'invite', reason: String(e?.message || 'unknown') });
      throw e;
    }
  };

  const leaveRoom = useCallback(async () => {
    const rid = roomId;
    const pid = user?.id != null ? String(user.id) : '';
    track('leave_room', { roomId: rid || '' });
    try {
      if (rid && pid) {
        await api.post(`/rooms/${rid}/leave`, { playerId: pid });
      }
    } catch (_) {}
    socket.disconnect();
    setRoom(null);
    setRoomId(null);
    sessionStorage.removeItem('inviteToken');
    try {
      sessionStorage.removeItem('gameHub_rematchRoomId');
    } catch (_) {}
  }, [roomId, user?.id]);

  const refreshRoom = useCallback(async () => {
    if (!roomId) return;
    const now = Date.now();
    // Лёгкий троттлинг против шторма socket-событий
    if (now - refreshLastAtRef.current < 350) {
      refreshPendingRef.current = true;
      return;
    }
    if (refreshInFlightRef.current) {
      refreshPendingRef.current = true;
      return;
    }
    refreshInFlightRef.current = true;
    refreshLastAtRef.current = now;
    try {
      const { room: r } = await api.get(`/rooms/${roomId}`);
      setRoom(r);
    } catch (_) {
      // ignore transient refresh errors
    } finally {
      refreshInFlightRef.current = false;
      if (refreshPendingRef.current) {
        refreshPendingRef.current = false;
        setTimeout(() => {
          refreshRoom();
        }, 150);
      }
    }
  }, [roomId]);

  useEffect(() => {
    if (!roomId) return;
    refreshRoom();
    const onDisconnect = (reason) => {
      if (reason === 'io client disconnect') return;
      setSocketReconnecting(true);
    };
    const onConnect = () => {
      setSocketReconnecting(false);
      refreshRoom();
    };
    const onJoin = () => refreshRoom();
    const onLeft = () => refreshRoom();
    const onOffline = () => refreshRoom();
    const onHostChanged = () => refreshRoom();
    const onRoomUpdated = () => refreshRoom();
    const onGameStart = async (data) => {
      if (!data?.game) return;
      recordGameStart(data.game);
      track('game_start', { game: data.game });
      await refreshRoom();
    };
    const onGameEnded = async () => {
      recordGameFinish(room?.game || null);
      track('match_completed', { game: room?.game || 'unknown' });
      try {
        if (roomId) sessionStorage.setItem('gameHub_rematchRoomId', roomId);
      } catch (_) {}
      if (
        ['/spy', '/truth_dare', '/elias', '/mafia', '/bunker'].includes(location.pathname)
      ) {
        return;
      }
      await refreshRoom();
      if (location.pathname !== '/lobby') navigate('/lobby');
    };
    socket.on('disconnect', onDisconnect);
    socket.onConnect(onConnect);
    socket.on('player_joined', onJoin);
    socket.on('player_left', onLeft);
    socket.on('player_offline', onOffline);
    socket.on('host_changed', onHostChanged);
    socket.on('room_updated', onRoomUpdated);
    socket.on('game_start', onGameStart);
    socket.on('game_ended', onGameEnded);
    return () => {
      socket.off('disconnect', onDisconnect);
      socket.offConnect(onConnect);
      socket.off('player_joined', onJoin);
      socket.off('player_left', onLeft);
      socket.off('player_offline', onOffline);
      socket.off('host_changed', onHostChanged);
      socket.off('room_updated', onRoomUpdated);
      socket.off('game_start', onGameStart);
      socket.off('game_ended', onGameEnded);
    };
  }, [roomId, location.pathname, navigate, refreshRoom, room?.game]);

  useEffect(() => {
    if (!roomId) return;
    try {
      sessionStorage.setItem('gameHub_lastRoomId', roomId);
    } catch (_) {}
  }, [roomId]);

  const resumeLastRoom = useCallback(async () => {
    let id = null;
    try {
      id = sessionStorage.getItem('gameHub_lastRoomId');
    } catch (_) {}
    if (!id || !user?.id) return null;
    const pid = String(user.id);
    try {
      const { room: r } = await api.get(`/rooms/${id}`);
      const displayName = getDisplayName() || user.first_name || 'Игрок';
      const avatarEmoji = getAvatar();
      const inv = getInventory();

      let roomToUse = r;
      const customPhoto = getProfilePhoto();
      // If user left the room earlier but lobby is still active, rejoin by code.
      if (!r?.players?.some((p) => p.id === pid)) {
        const joined = await api.post('/rooms/join', {
          code: String(r?.code || '').trim(),
          playerId: pid,
          playerName: displayName,
          inventory: { dictionaries: inv.dictionaries, unlockedItems: inv.unlockedItems || [], hasPro: inv.hasPro },
          photo_url: customPhoto || user?.photo_url || null,
          avatar_emoji: avatarEmoji || null,
        });
        roomToUse = joined?.room || null;
      }

      if (!roomToUse) {
        sessionStorage.removeItem('gameHub_lastRoomId');
        return null;
      }

      const isHost = roomToUse.hostId === pid;
      setRoom(roomToUse);
      setRoomId(id);
      if (roomToUse.inviteToken) sessionStorage.setItem('inviteToken', roomToUse.inviteToken);
      socket.connect(id, { id: pid, name: displayName, isHost });
      return roomToUse;
    } catch (_) {
      try {
        sessionStorage.removeItem('gameHub_lastRoomId');
      } catch (__) {}
      return null;
    }
  }, [user]);

  const onGoLobbyAfterSpy = useCallback(async () => {
    await refreshRoom();
    navigate('/lobby');
  }, [navigate, refreshRoom]);

  /**
   * Игроки в лобби при старте игры хостом: реклама и переход в раунд.
   * Хост не получает рекламу здесь — он сразу уходит в игру через navigate из Lobby после старта.
   * Остаётся на /lobби только не-хост → для них показываем рекламу.
   */
  useEffect(() => {
    if (!roomId || !room) return;
    if (room.state !== 'playing' || !room.game) return;
    const game = room.game;
    const path = `/${game}`;
    if (location.pathname === path) return;
    if (location.pathname !== '/lobby') return;

    const isHostUser = user?.id != null && String(room.hostId) === String(user.id);
    if (isHostUser) return;

    let cancelled = false;
    const uid = user?.id != null ? String(user.id) : '';
    showAdIfNeeded().then(async ({ adSdkShown }) => {
      if (adSdkShown && uid) {
        track('ad_completed', { game });
        try {
          await api.post('/stats/ad-shown', { playerId: uid });
        } catch (_) {}
      }
      if (!cancelled) navigate(path);
    });
    return () => {
      cancelled = true;
    };
  }, [room?.state, room?.game, room?.hostId, location.pathname, roomId, navigate, user?.id]);

  if (!ready) return <div className="gh-skeleton" style={{ margin: 20, height: 56 }} aria-label="Загрузка приложения" />;

  return (
    <>
      {!isOnline ? (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 51,
            padding: '10px 12px',
            background: 'rgba(164, 56, 56, 0.92)',
            color: '#fff',
            textAlign: 'center',
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          Вы офлайн. Проверьте интернет и откройте приложение снова.
        </div>
      ) : null}
      {roomId && socketReconnecting && isOnline ? (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 50,
            padding: '10px 12px',
            background: 'rgba(180, 100, 20, 0.92)',
            color: '#fff',
            textAlign: 'center',
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          Нет связи с сервером — переподключаемся…
        </div>
      ) : null}
      <Suspense fallback={<RouteLoadingFallback />}>
      <Routes>
        <Route
          path="/"
          element={
            <Home
              user={user}
              onCreateRoom={createRoom}
              onJoinByCode={joinByCode}
              onJoinByInvite={joinByInvite}
              onResumeLastRoom={resumeLastRoom}
            />
          }
        />
        <Route path="/seo" element={<Navigate to="/" replace />} />
        <Route path="/how-to-play" element={<Navigate to="/" replace />} />
        <Route
          path="/games/spy"
          element={
            <SeoGameSpy
              onJoin={async (payload) => {
                if (payload.kind === 'invite') await joinByInvite(payload.value);
                else await joinByCode(payload.value);
                navigate('/lobby');
              }}
            />
          }
        />
        <Route
          path="/games/elias"
          element={
            <SeoGameElias
              onJoin={async (payload) => {
                if (payload.kind === 'invite') await joinByInvite(payload.value);
                else await joinByCode(payload.value);
                navigate('/lobby');
              }}
            />
          }
        />
        <Route
          path="/games/mafia"
          element={
            <SeoGameMafia
              onJoin={async (payload) => {
                if (payload.kind === 'invite') await joinByInvite(payload.value);
                else await joinByCode(payload.value);
                navigate('/lobby');
              }}
            />
          }
        />
        <Route
          path="/games/truth_dare"
          element={
            <SeoGameTruthDare
              onJoin={async (payload) => {
                if (payload.kind === 'invite') await joinByInvite(payload.value);
                else await joinByCode(payload.value);
                navigate('/lobby');
              }}
            />
          }
        />
        <Route
          path="/games/bunker"
          element={
            <SeoGameBunker
              onJoin={async (payload) => {
                if (payload.kind === 'invite') await joinByInvite(payload.value);
                else await joinByCode(payload.value);
                navigate('/lobby');
              }}
            />
          }
        />
        <Route
          path="/privacy"
          element={<SeoPrivacy />}
        />
        <Route
          path="/rules"
          element={<SeoRules />}
        />
        <Route
          path="/lobby"
          element={
            roomId && room ? (
              <Lobby
                room={room}
                roomId={roomId}
                user={user}
                onLeave={leaveRoom}
                onRoomUpdate={setRoom}
              />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
        <Route
          path="/spy"
          element={
            roomId && allowGameRoundRoute(room, 'spy') ? (
              <SpyRound roomId={roomId} user={user} room={room} onLeave={leaveRoom} onGoLobby={onGoLobbyAfterSpy} />
            ) : roomId ? (
              <Navigate to="/lobby" replace />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
        <Route
          path="/mafia"
          element={
            roomId && allowGameRoundRoute(room, 'mafia') ? (
              <MafiaRound roomId={roomId} user={user} room={room} onLeave={leaveRoom} />
            ) : roomId ? (
              <Navigate to="/lobby" replace />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
        <Route
          path="/elias"
          element={
            roomId && allowGameRoundRoute(room, 'elias') ? (
              <EliasRound roomId={roomId} user={user} room={room} onLeave={leaveRoom} />
            ) : roomId ? (
              <Navigate to="/lobby" replace />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
        <Route
          path="/truth_dare"
          element={
            roomId && allowGameRoundRoute(room, 'truth_dare') ? (
              <TruthDareRound roomId={roomId} user={user} room={room} onLeave={leaveRoom} />
            ) : roomId ? (
              <Navigate to="/lobby" replace />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
        <Route
          path="/bunker"
          element={
            roomId && allowGameRoundRoute(room, 'bunker') ? (
              <BunkerRound roomId={roomId} user={user} room={room} onLeave={leaveRoom} />
            ) : roomId ? (
              <Navigate to="/lobby" replace />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
        <Route path="/admin" element={<Admin />} />
        <Route
          path="/friends"
          element={<FriendsPage user={user} onJoinByInvite={joinByInvite} />}
        />
        <Route path="/profile" element={<Profile user={user} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
      <FriendsIncomingModal user={user} />
      <AuthModal />
    </>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </ToastProvider>
  );
}
