import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { socket } from '../socket';
import BackArrow from '../components/BackArrow';

function formatTime(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

const btnStyle = {
  padding: '12px 20px',
  fontSize: 16,
  borderRadius: 8,
  border: 'none',
  color: '#fff',
  cursor: 'pointer',
  width: '100%',
};

export default function EliasRound({ roomId, user, room, onLeave }) {
  const navigate = useNavigate();
  const myId = user?.id != null ? String(user.id) : '';
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [winnerTeamIndex, setWinnerTeamIndex] = useState(null);
  const [endedTeams, setEndedTeams] = useState(null);
  const [tick, setTick] = useState(0);

  const refreshState = () => {
    if (!myId) return;
    api.get(`/rooms/${roomId}/elias/state?playerId=${encodeURIComponent(myId)}`).then((s) => {
      setState(s);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => refreshState(), [roomId, myId]);
  useEffect(() => {
    if (!myId || !state) return;
    api.post(`/rooms/${roomId}/ready`, { playerId: myId, game: 'elias' }).catch(() => {});
  }, [roomId, myId, state]);

  useEffect(() => {
    socket.on('elias_update', refreshState);
    socket.on('elias_timer_start', (data) => {
      if (data?.roundEndsAt) refreshState();
    });
    socket.on('elias_ended', (data) => {
      setWinnerTeamIndex(data?.winnerTeamIndex ?? null);
      if (data?.teams) setEndedTeams(data.teams);
    });
    socket.on('game_ended', refreshState);
    return () => {
      socket.off('elias_update', refreshState);
      socket.off('elias_timer_start');
      socket.off('elias_ended');
      socket.off('game_ended', refreshState);
    };
  }, [roomId, myId]);

  useEffect(() => {
    if (!state?.roundEndsAt) return;
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [state?.roundEndsAt]);

  const guessed = async () => {
    try {
      await api.post(`/rooms/${roomId}/elias/guessed`, { playerId: myId });
      refreshState();
    } catch (_) {}
  };

  const skip = async () => {
    try {
      await api.post(`/rooms/${roomId}/elias/skip`, { playerId: myId });
      refreshState();
    } catch (_) {}
  };

  const nextTurn = async () => {
    try {
      await api.post(`/rooms/${roomId}/elias/next-turn`, { playerId: myId });
      refreshState();
    } catch (_) {}
  };

  if (loading) return <div style={{ padding: 24 }}>Загрузка…</div>;
  if (!state) return <div style={{ padding: 24 }}>Нет данных</div>;

  const timerStarted = state.roundEndsAt != null;
  const timeLeft = state.roundEndsAt ? Math.max(0, state.roundEndsAt - Date.now()) : 0;
  const timeUp = timerStarted && timeLeft <= 0;
  const winner = state.winner != null ? state.winner : winnerTeamIndex;
  const teams = endedTeams || state.teams || [];

  if (winner != null) {
    const winTeam = teams[winner];
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <BackArrow onClick={() => navigate('/lobby')} title="В лобби" />
        <p style={{ fontSize: 22, marginBottom: 16 }}>Победила {winTeam?.name || 'команда'}!</p>
        <p style={{ marginBottom: 16 }}>Счёт: {teams.map((t, i) => `${t.name} ${t.score}`).join(' — ')}</p>
        <button type="button" onClick={() => navigate('/lobby')} style={btnStyle}>В лобби</button>
        <button type="button" onClick={onLeave} style={{ ...btnStyle, marginTop: 8, background: '#333' }}>Выйти</button>
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <BackArrow onClick={() => navigate('/lobby')} title="В лобби" />
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        {(state.teams || []).map((t, i) => (
          <div key={i} style={{ padding: 12, background: state.currentTeamIndex === i ? 'rgba(100,150,255,0.2)' : 'rgba(0,0,0,0.2)', borderRadius: 8, flex: 1, minWidth: 120 }}>
            <p style={{ margin: 0, fontWeight: 'bold' }}>{t.name}</p>
            <p style={{ margin: '4px 0 0', fontSize: 24 }}>{t.score ?? 0} / {state.scoreLimit}</p>
          </div>
        ))}
      </div>

      <p style={{ marginBottom: 8, opacity: 0.9 }}>Объясняет: {state.explainerName}</p>
      {timerStarted ? (
        <p style={{ marginBottom: 16, fontSize: 20 }}>Таймер: {formatTime(timeLeft)}</p>
      ) : (
        <p style={{ marginBottom: 16, fontSize: 16, opacity: 0.8 }}>Ожидание готовности всех…</p>
      )}

      {state.isExplainer ? (
        <>
          <p style={{ fontSize: 28, fontWeight: 'bold', marginBottom: 24, wordBreak: 'break-word' }}>{state.word}</p>
          <div style={{ display: 'flex', gap: 12 }}>
            <button type="button" onClick={guessed} style={{ ...btnStyle, flex: 1, background: '#6a5' }}>Угадали</button>
            <button type="button" onClick={skip} style={{ ...btnStyle, flex: 1, background: '#444' }}>Пропустить</button>
          </div>
        </>
      ) : (
        <p style={{ fontSize: 18, opacity: 0.9 }}>Угадывайте слово! Объясняющий не должен произносить его.</p>
      )}

      {timeUp && (
        <button type="button" onClick={nextTurn} style={{ ...btnStyle, marginTop: 16, background: '#85a' }}>Следующий ход</button>
      )}

      <button type="button" onClick={() => navigate('/lobby')} style={{ ...btnStyle, marginTop: 24, background: '#333' }}>В лобби</button>
    </div>
  );
}
