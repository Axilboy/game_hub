import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { socket } from '../socket';
import BackArrow from '../components/BackArrow';
import useSeo from '../hooks/useSeo';
import GameLayout from '../components/game/GameLayout';
import PostMatchScreen from '../components/game/PostMatchScreen';
import Loader from '../components/ui/Loader';
import ErrorState from '../components/ui/ErrorState';

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
  useSeo({
    robots: 'noindex, nofollow',
  });
  const myId = user?.id != null ? String(user.id) : '';
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [winnerTeamIndex, setWinnerTeamIndex] = useState(null);
  const [endedTeams, setEndedTeams] = useState(null);
  const [tick, setTick] = useState(0);
  const requestSeqRef = useRef(0);

  const refreshState = ({ silent = false } = {}) => {
    if (!myId) return;
    const reqId = ++requestSeqRef.current;
    if (!silent) setLoading(true);
    api.get(`/rooms/${roomId}/elias/state?playerId=${encodeURIComponent(myId)}`).then((s) => {
      if (reqId !== requestSeqRef.current) return;
      setState(s);
      if (!silent) setLoading(false);
    }).catch(() => {
      if (reqId !== requestSeqRef.current) return;
      if (!silent) setLoading(false);
    });
  };

  useEffect(() => refreshState(), [roomId, myId]);
  useEffect(() => {
    if (!myId || !state) return;
    api.post(`/rooms/${roomId}/ready`, { playerId: myId, game: 'elias' }).catch(() => {});
  }, [roomId, myId, state]);

  useEffect(() => {
    const onUpdate = () => refreshState({ silent: true });
    const onTimer = (data) => {
      if (data?.roundEndsAt) refreshState({ silent: true });
    };
    const onEnded = (data) => {
      setWinnerTeamIndex(data?.winnerTeamIndex ?? null);
      if (data?.teams) setEndedTeams(data.teams);
    };
    const onGameEnded = () => refreshState({ silent: true });
    socket.on('elias_update', onUpdate);
    socket.on('elias_timer_start', onTimer);
    socket.on('elias_ended', onEnded);
    socket.on('game_ended', onGameEnded);
    return () => {
      socket.off('elias_update', onUpdate);
      socket.off('elias_timer_start', onTimer);
      socket.off('elias_ended', onEnded);
      socket.off('game_ended', onGameEnded);
    };
  }, [roomId, myId]);

  useEffect(() => {
    const onSock = () => refreshState({ silent: true });
    socket.onConnect(onSock);
    return () => socket.offConnect(onSock);
  }, [roomId, myId]);

  useEffect(() => {
    if (!state?.roundEndsAt) return;
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [state?.roundEndsAt]);

  const guessed = async () => {
    try {
      await api.post(`/rooms/${roomId}/elias/guessed`, { playerId: myId });
      refreshState({ silent: true });
    } catch (_) {}
  };

  const skip = async () => {
    try {
      await api.post(`/rooms/${roomId}/elias/skip`, { playerId: myId });
      refreshState({ silent: true });
    } catch (_) {}
  };

  const nextTurn = async () => {
    try {
      await api.post(`/rooms/${roomId}/elias/next-turn`, { playerId: myId });
      refreshState({ silent: true });
    } catch (_) {}
  };

  if (loading) return <div style={{ padding: 24 }}><Loader label="Загрузка Элиаса..." minHeight="50vh" /></div>;
  if (!state) return <div style={{ padding: 24 }}><ErrorState title="Нет данных" message="Состояние игры не загружено." actionLabel="В лобби" onAction={() => navigate('/lobby')} /></div>;

  const timerStarted = state.roundEndsAt != null;
  const timeLeft = state.roundEndsAt ? Math.max(0, state.roundEndsAt - Date.now()) : 0;
  const timeUp = timerStarted && timeLeft <= 0;
  const winner = state.winner != null ? state.winner : winnerTeamIndex;
  const teams = endedTeams || state.teams || [];
  const explainingTeamIndex = state.currentTeamIndex ?? null;
  const explainingTeamName =
    explainingTeamIndex != null && teams[explainingTeamIndex]
      ? teams[explainingTeamIndex].name
      : null;

  if (winner != null) {
    const winTeam = teams[winner];
    return (
      <PostMatchScreen
        top={<BackArrow onClick={() => navigate('/lobby')} title="В лобби" />}
        center={true}
        padding={24}
        primaryLabel="В лобби"
        onPrimary={() => navigate('/lobby')}
        secondaryLabel="Выйти"
        onSecondary={onLeave}
        secondaryBg="#333"
      >
        <p style={{ fontSize: 22, marginBottom: 16 }}>Победила {winTeam?.name || 'команда'}!</p>
        <p style={{ marginBottom: 16 }}>Счёт: {teams.map((t, i) => `${t.name} ${t.score}`).join(' — ')}</p>
      </PostMatchScreen>
    );
  }

  return (
    <GameLayout
      top={<BackArrow onClick={() => navigate('/lobby')} title="В лобби" />}
      center={false}
      padding={24}
      textAlign="center"
      bottom={
        <button type="button" onClick={() => navigate('/lobby')} style={{ ...btnStyle, background: '#333' }}>В лобби</button>
      }
    >
      <div className="gh-card" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8, padding: 12 }}>
        {(state.teams || []).map((t, i) => (
          <div key={i} style={{ padding: 12, background: state.currentTeamIndex === i ? 'rgba(100,150,255,0.2)' : 'rgba(0,0,0,0.2)', borderRadius: 8, flex: 1, minWidth: 120 }}>
            <p style={{ margin: 0, fontWeight: 'bold' }}>
              {t.name}{state.currentTeamIndex === i ? ' ' : ''}
              {state.currentTeamIndex === i && (
                <span style={{ marginLeft: 8, fontSize: 12, padding: '4px 8px', borderRadius: 999, background: 'rgba(100,150,255,0.22)', border: '1px solid rgba(100,150,255,0.35)', opacity: 0.95 }}>
                  Объясняет
                </span>
              )}
            </p>
            <p style={{ margin: '4px 0 0', fontSize: 24 }}>{t.score ?? 0} / {state.scoreLimit}</p>
          </div>
        ))}
      </div>

      <div className="gh-card" style={{ marginBottom: 16, padding: 12 }}>
        <p style={{ marginBottom: 8, opacity: 0.9 }}>Объясняет: {state.explainerName}</p>
        {timerStarted ? (
          <>
            <p style={{ marginBottom: 6, fontSize: 20 }}>Таймер: {formatTime(timeLeft)}</p>
            <p style={{ marginBottom: 0, fontSize: 14, opacity: 0.85 }}>
              Смена слова: {timeUp ? 'сейчас' : `через ${Math.max(1, Math.ceil(timeLeft / 1000))} сек`}
            </p>
          </>
        ) : (
          <p style={{ marginBottom: 0, fontSize: 16, opacity: 0.8 }}>Ожидание готовности всех…</p>
        )}
      </div>

      {state.isExplainer ? (
        <div className="gh-card" style={{ padding: 16 }}>
          <p style={{ margin: 0, fontSize: 14, opacity: 0.85, fontWeight: 800, marginBottom: 10 }}>
            Команда объясняет
          </p>
          <p style={{ margin: '0 0 16px', fontSize: 13, opacity: 0.9, lineHeight: 1.4 }}>
            Правило: не произноси само слово вслух. Объясняй так, чтобы команда догадалась.
          </p>
          <p style={{ fontSize: 28, fontWeight: 'bold', marginBottom: 24, wordBreak: 'break-word' }}>{state.word}</p>
          <div style={{ display: 'flex', gap: 12 }}>
            <button type="button" onClick={guessed} style={{ ...btnStyle, flex: 1, background: '#6a5' }}>Угадали</button>
            <button type="button" onClick={skip} style={{ ...btnStyle, flex: 1, background: '#444' }}>Пропустить</button>
          </div>
        </div>
      ) : (
        <div className="gh-card" style={{ padding: 16 }}>
          <p style={{ margin: 0, fontSize: 18, opacity: 0.9, fontWeight: 800 }}>Раунд: угадывайте</p>
          <div style={{ marginTop: 10, padding: 12, borderRadius: 12, background: 'rgba(0,0,0,0.25)' }}>
            <p style={{ margin: 0, fontSize: 13, opacity: 0.9, lineHeight: 1.5 }}>• Слово видит только команда объясняющего</p>
            <p style={{ margin: '8px 0 0', fontSize: 13, opacity: 0.9, lineHeight: 1.5 }}>• Объясняющий не произносит слово вслух</p>
            <p style={{ margin: '8px 0 0', fontSize: 13, opacity: 0.9, lineHeight: 1.5 }}>• Нажимайте действия только во время своего этапа</p>
          </div>
          {explainingTeamName && (
            <p style={{ margin: '10px 0 0', fontSize: 14, opacity: 0.85 }}>
              Сейчас объясняет: <strong>{explainingTeamName}</strong> (кнопки доступны этой команде)
            </p>
          )}
        </div>
      )}

      {timeUp && (
        <button type="button" onClick={nextTurn} style={{ ...btnStyle, marginTop: 16, background: '#85a' }}>Следующий ход</button>
      )}
    </GameLayout>
  );
}
