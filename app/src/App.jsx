import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useTelegram } from './useTelegram';
import { api } from './api';
import { socket } from './socket';
import Home from './pages/Home';
import Lobby from './pages/Lobby';
import SpyRound from './pages/SpyRound';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

function AppRoutes() {
  const { user, ready } = useTelegram();
  const [room, setRoom] = useState(null);
  const [roomId, setRoomId] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const invite = params.get('invite');
    if (invite) {
      sessionStorage.setItem('pendingInvite', invite);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const createRoom = async () => {
    if (!user?.id) return;
    const { room: r, inviteToken } = await api.post('/rooms', {
      hostId: String(user.id),
      hostName: user.first_name || 'Хост',
    });
    setRoom(r);
    setRoomId(r.id);
    sessionStorage.setItem('inviteToken', inviteToken);
    socket.connect(r.id, { id: String(user.id), name: user.first_name || 'Игрок', isHost: true });
  };

  const joinByCode = async (code) => {
    if (!user?.id) return null;
    const { room: r } = await api.post('/rooms/join', {
      code: code.trim(),
      playerId: String(user.id),
      playerName: user.first_name || 'Игрок',
    });
    setRoom(r);
    setRoomId(r.id);
    socket.connect(r.id, { id: String(user.id), name: user.first_name || 'Игрок', isHost: false });
    return r;
  };

  const joinByInvite = async (inviteParam) => {
    if (!user?.id) return null;
    const { room: r } = await api.post('/rooms/join', {
      inviteToken: inviteParam,
      playerId: String(user.id),
      playerName: user.first_name || 'Игрок',
    });
    setRoom(r);
    setRoomId(r.id);
    socket.connect(r.id, { id: String(user.id), name: user.first_name || 'Игрок', isHost: false });
    return r;
  };

  const leaveRoom = () => {
    socket.disconnect();
    setRoom(null);
    setRoomId(null);
    sessionStorage.removeItem('inviteToken');
  };

  const refreshRoom = async () => {
    if (!roomId) return;
    const { room: r } = await api.get(`/rooms/${roomId}`);
    setRoom(r);
  };

  useEffect(() => {
    if (!roomId) return;
    const onJoin = () => refreshRoom();
    const onLeft = () => refreshRoom();
    const onGameStart = async (data) => {
      if (data?.game === 'spy') {
        await refreshRoom();
        if (location.pathname !== '/spy') navigate('/spy');
      }
    };
    socket.on('player_joined', onJoin);
    socket.on('player_left', onLeft);
    socket.on('game_start', onGameStart);
    return () => {
      socket.off('player_joined', onJoin);
      socket.off('player_left', onLeft);
      socket.off('game_start', onGameStart);
    };
  }, [roomId, location.pathname, navigate]);

  if (!ready) return <div style={{ padding: 20 }}>Загрузка…</div>;

  return (
    <Routes>
        <Route
          path="/"
          element={
            <Home
              user={user}
              onCreateRoom={createRoom}
              onJoinByCode={joinByCode}
              onJoinByInvite={joinByInvite}
            />
          }
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
            roomId && room?.state === 'playing' ? (
              <SpyRound roomId={roomId} user={user} room={room} />
            ) : roomId ? (
              <Navigate to="/lobby" replace />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
