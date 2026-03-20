import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useTelegram } from './useTelegram';
import { api } from './api';
import { socket } from './socket';
import { addSessionTime, recordGameFinish, recordGameStart, touchVisit } from './stats';
import { getInventory } from './inventory';
import { getDisplayName, getAvatar } from './displayName';
import { showAdIfNeeded } from './ads';
import { track } from './analytics';
import Home from './pages/Home';
import { ToastProvider } from './components/ui/ToastProvider';

const Profile = lazy(() => import('./pages/Profile'));
const Lobby = lazy(() => import('./pages/Lobby'));
const SpyRound = lazy(() => import('./pages/SpyRound'));
const MafiaRound = lazy(() => import('./pages/MafiaRound'));
const EliasRound = lazy(() => import('./pages/EliasRound'));
const TruthDareRound = lazy(() => import('./pages/TruthDareRound'));
const BunkerRound = lazy(() => import('./pages/BunkerRound'));
const Admin = lazy(() => import('./pages/Admin'));
const SeoLanding = lazy(() => import('./pages/SeoLanding'));
const SeoGameSpy = lazy(() => import('./pages/SeoGameSpy'));
const SeoGameElias = lazy(() => import('./pages/SeoGameElias'));
const SeoGameMafia = lazy(() => import('./pages/SeoGameMafia'));
const SeoGameTruthDare = lazy(() => import('./pages/SeoGameTruthDare'));
const SeoGameBunker = lazy(() => import('./pages/SeoGameBunker'));
const SeoHowToPlay = lazy(() => import('./pages/SeoHowToPlay'));
const SeoPrivacy = lazy(() => import('./pages/SeoPrivacy'));
const SeoRules = lazy(() => import('./pages/SeoRules'));

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

function AppRoutes() {
  const { user, ready } = useTelegram();
  const [room, setRoom] = useState(null);
  const [roomId, setRoomId] = useState(null);
  const [pendingNavigateGame, setPendingNavigateGame] = useState(null);
  const [socketReconnecting, setSocketReconnecting] = useState(false);
  const [isOnline, setIsOnline] = useState(() => (typeof navigator !== 'undefined' ? navigator.onLine : true));
  const navigate = useNavigate();
  const location = useLocation();

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
    const params = new URLSearchParams(window.location.search);
    const invite = params.get('invite');
    if (invite) {
      sessionStorage.setItem('pendingInvite', invite);
      track('invite_open', { source: 'url', hasInvite: true });
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const createRoom = async () => {
    if (!user?.id) return;
    const inv = getInventory();
    const displayName = getDisplayName();
    const avatarEmoji = getAvatar();
    const { room: r, inviteToken } = await api.post('/rooms', {
      hostId: String(user.id),
      hostName: displayName || user.first_name || 'Хост',
      hostPhotoUrl: user.photo_url || null,
      hostHasPro: inv.hasPro,
      hostAvatarEmoji: avatarEmoji || null,
    });
    setRoom(r);
    setRoomId(r.id);
    sessionStorage.setItem('inviteToken', inviteToken);
    try {
      sessionStorage.removeItem('gameHub_rematchRoomId');
    } catch (_) {}
    track('room_create', { roomId: r.id });
    socket.connect(r.id, { id: String(user.id), name: displayName || user.first_name || 'Игрок', isHost: true });
  };

  const joinByCode = async (code) => {
    if (!user?.id) return null;
    const inv = getInventory();
    const displayName = getDisplayName();
    const avatarEmoji = getAvatar();
    const { room: r } = await api.post('/rooms/join', {
      code: code.trim(),
      playerId: String(user.id),
      playerName: displayName || user.first_name || 'Игрок',
      inventory: { dictionaries: inv.dictionaries, unlockedItems: inv.unlockedItems || [], hasPro: inv.hasPro },
      photo_url: user.photo_url || null,
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
    track('invite_join_attempt', { source: 'invite' });
    try {
      const { room: r } = await api.post('/rooms/join', {
        inviteToken: inviteParam,
        playerId: String(user.id),
        playerName: displayName || user.first_name || 'Игрок',
        inventory: { dictionaries: inv.dictionaries, unlockedItems: inv.unlockedItems || [], hasPro: inv.hasPro },
        photo_url: user.photo_url || null,
        avatar_emoji: avatarEmoji || null,
      });
      setRoom(r);
      setRoomId(r.id);
      try {
        sessionStorage.removeItem('gameHub_rematchRoomId');
      } catch (_) {}
      track('room_join', { roomId: r.id, source: 'invite' });
      socket.connect(r.id, { id: String(user.id), name: user.first_name || 'Игрок', isHost: false });
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
      sessionStorage.removeItem('gameHub_lastRoomId');
      sessionStorage.removeItem('gameHub_rematchRoomId');
    } catch (_) {}
  }, [roomId, user?.id]);

  const refreshRoom = useCallback(async () => {
    if (!roomId) return;
    try {
      const { room: r } = await api.get(`/rooms/${roomId}`);
      setRoom(r);
    } catch (_) {}
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
      setPendingNavigateGame(data.game);
      await refreshRoom();
    };
    const onGameEnded = async () => {
      recordGameFinish(room?.game || pendingNavigateGame || null);
      track('match_completed', { game: room?.game || pendingNavigateGame || 'unknown' });
      try {
        if (roomId) sessionStorage.setItem('gameHub_rematchRoomId', roomId);
      } catch (_) {}
      if (location.pathname === '/spy') return;
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
  }, [roomId, location.pathname, navigate, refreshRoom, room?.game, pendingNavigateGame]);

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
      if (!r?.players?.some((p) => p.id === pid)) {
        sessionStorage.removeItem('gameHub_lastRoomId');
        return null;
      }
      const displayName = getDisplayName() || user.first_name || 'Игрок';
      const isHost = r.hostId === pid;
      setRoom(r);
      setRoomId(id);
      if (r.inviteToken) sessionStorage.setItem('inviteToken', r.inviteToken);
      socket.connect(id, { id: pid, name: displayName, isHost });
      return r;
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

  useEffect(() => {
    if (!pendingNavigateGame || room?.state !== 'playing' || room?.game !== pendingNavigateGame) return;
    const path = '/' + pendingNavigateGame;
    if (location.pathname === path) {
      setPendingNavigateGame(null);
      return;
    }
    let cancelled = false;
    const uid = user?.id != null ? String(user.id) : '';
    showAdIfNeeded().then(async ({ adSdkShown }) => {
      if (adSdkShown && uid) {
        track('ad_completed', { game: pendingNavigateGame });
        try {
          await api.post('/stats/ad-shown', { playerId: uid });
        } catch (_) {}
      }
      if (!cancelled) {
        setPendingNavigateGame(null);
        navigate(path);
      }
    });
    return () => { cancelled = true; };
  }, [pendingNavigateGame, room?.state, room?.game, location.pathname, navigate, user?.id]);

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
      <Suspense fallback={<div className="gh-skeleton" style={{ margin: 20, height: 56 }} aria-label="Загрузка экрана" />}>
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
        <Route
          path="/seo"
          element={<SeoLanding navigateToApp={() => navigate('/')} onNavigate={(p) => navigate(p)} />}
        />
        <Route
          path="/games/spy"
          element={<SeoGameSpy onBack={() => navigate('/seo')} />}
        />
        <Route
          path="/games/elias"
          element={<SeoGameElias onBack={() => navigate('/seo')} />}
        />
        <Route
          path="/games/mafia"
          element={<SeoGameMafia onBack={() => navigate('/seo')} />}
        />
        <Route
          path="/games/truth_dare"
          element={<SeoGameTruthDare onBack={() => navigate('/seo')} />}
        />
        <Route
          path="/games/bunker"
          element={<SeoGameBunker onBack={() => navigate('/seo')} />}
        />
        <Route
          path="/how-to-play"
          element={<SeoHowToPlay onBack={() => navigate('/seo')} />}
        />
        <Route
          path="/privacy"
          element={<SeoPrivacy onBack={() => navigate('/seo')} />}
        />
        <Route
          path="/rules"
          element={<SeoRules onBack={() => navigate('/seo')} />}
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
            roomId && room?.state === 'playing' && room?.game === 'spy' ? (
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
            roomId && room?.state === 'playing' && room?.game === 'mafia' ? (
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
            roomId && room?.state === 'playing' && room?.game === 'elias' ? (
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
            roomId && room?.state === 'playing' && room?.game === 'truth_dare' ? (
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
            roomId && room?.state === 'playing' && room?.game === 'bunker' ? (
              <BunkerRound roomId={roomId} user={user} room={room} onLeave={leaveRoom} />
            ) : roomId ? (
              <Navigate to="/lobby" replace />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
        <Route path="/admin" element={<Admin />} />
        <Route path="/profile" element={<Profile user={user} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
    </>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </ToastProvider>
  );
}
