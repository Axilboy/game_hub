import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { socket } from '../socket';
import BackArrow from '../components/BackArrow';
import useSeo from '../hooks/useSeo';
import GameLayout from '../components/game/GameLayout';
import GameplayScreen from '../components/game/GameplayScreen';
import PostMatchScreen from '../components/game/PostMatchScreen';
import Loader from '../components/ui/Loader';
import ErrorState from '../components/ui/ErrorState';

function formatTime(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

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

  const beginRound = async () => {
    try {
      await api.post(`/rooms/${roomId}/elias/begin-round`, { playerId: myId });
      refreshState({ silent: true });
    } catch (_) {}
  };

  if (loading) {
    return (
      <GameplayScreen theme="elias" user={user} onBack={() => navigate('/lobby')} backTitle="В лобби" title="Элиас">
        <Loader label="Загрузка Элиаса..." minHeight="50vh" />
      </GameplayScreen>
    );
  }
  if (!state) {
    return (
      <GameplayScreen theme="elias" user={user} onBack={() => navigate('/lobby')} backTitle="В лобби" title="Элиас">
        <ErrorState title="Нет данных" message="Состояние игры не загружено." actionLabel="В лобби" onAction={() => navigate('/lobby')} />
      </GameplayScreen>
    );
  }

  const awaitingStart = Boolean(state.awaitingExplainerStart);
  const timerStarted = state.roundEndsAt != null && !awaitingStart;
  const timeLeft = state.roundEndsAt ? Math.max(0, state.roundEndsAt - Date.now()) : 0;
  const timeUp = timerStarted && timeLeft <= 0;
  const winner = state.winner != null ? state.winner : winnerTeamIndex;
  const teams = endedTeams || state.teams || [];
  const explainingTeamIndex = state.currentTeamIndex ?? null;
  const explainingTeamName =
    explainingTeamIndex != null && teams[explainingTeamIndex]
      ? teams[explainingTeamIndex].name
      : null;
  const myStats = state.playerStats?.[myId] || { guessed: 0, skipped: 0 };
  const topPlayers = Object.entries(state.playerStats || {})
    .map(([id, s]) => ({
      id,
      guessed: Number(s?.guessed) || 0,
      skipped: Number(s?.skipped) || 0,
      value: (Number(s?.guessed) || 0) - (Number(s?.skipped) || 0),
    }))
    .sort((a, b) => b.value - a.value || b.guessed - a.guessed)
    .slice(0, 3);
  const playerNameById = new Map(
    (room?.players || []).map((p) => [p.id, p.name]),
  );

  if (winner != null) {
    const winTeam = teams[winner];
    return (
      <PostMatchScreen
        theme="elias"
        top={<BackArrow onClick={() => navigate('/lobby')} title="В лобби" />}
        center={true}
        padding={24}
        primaryLabel="В лобби"
        onPrimary={() => navigate('/lobby')}
        secondaryLabel="Выйти"
        onSecondary={onLeave}
        secondaryBg="#333"
      >
        <div className="gpl__panel" style={{ textAlign: 'center' }}>
        <p style={{ fontSize: 22, marginBottom: 16 }}>Победила {winTeam?.name || 'команда'}!</p>
        <p style={{ marginBottom: 16 }}>Счёт: {teams.map((t, i) => `${t.name} ${t.score}`).join(' — ')}</p>
        {state?.mvp && (
          <p style={{ marginBottom: 0, opacity: 0.9 }}>
            MVP: {state.mvp.name} (угадано {state.mvp.guessed}, пропусков {state.mvp.skipped})
          </p>
        )}
        </div>
      </PostMatchScreen>
    );
  }

  return (
    <GameplayScreen theme="elias" user={user} onBack={() => navigate('/lobby')} backTitle="В лобби" title="Элиас">
    <GameLayout
      top={null}
      center={false}
      padding={0}
      minHeight="auto"
      textAlign="center"
      bottom={
        <button type="button" onClick={() => navigate('/lobby')} className="gameplay__btn gameplay__btn--secondary">
          В лобби
        </button>
      }
    >
      <div className="gpl__panel" style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        {(state.teams || []).map((t, i) => (
          <div
            key={i}
            style={{
              padding: 12,
              background:
                state.currentTeamIndex === i
                  ? 'color-mix(in srgb, var(--gpl-accent) 18%, transparent)'
                  : 'rgba(0,0,0,0.06)',
              borderRadius: 12,
              flex: 1,
              minWidth: 120,
              border:
                state.currentTeamIndex === i ? '1px solid color-mix(in srgb, var(--gpl-accent) 40%, transparent)' : '1px solid rgba(0,0,0,0.08)',
            }}
          >
            <p style={{ margin: 0, fontWeight: 'bold' }}>
              {t.name}{state.currentTeamIndex === i ? ' ' : ''}
              {state.currentTeamIndex === i && (
                <span
                  style={{
                    marginLeft: 8,
                    fontSize: 12,
                    padding: '4px 8px',
                    borderRadius: 999,
                    background: 'color-mix(in srgb, var(--gpl-accent) 22%, transparent)',
                    border: '1px solid color-mix(in srgb, var(--gpl-accent) 45%, transparent)',
                    opacity: 0.95,
                  }}
                >
                  Объясняет
                </span>
              )}
            </p>
            <p style={{ margin: '4px 0 0', fontSize: 24 }}>{t.score ?? 0} / {state.scoreLimit}</p>
          </div>
        ))}
      </div>

      <div className="gpl__panel">
        <p style={{ marginBottom: 8, opacity: 0.9 }}>Объясняет: {state.explainerName}</p>
        {explainingTeamName && (
          <p style={{ marginTop: 0, marginBottom: 8, fontSize: 13, opacity: 0.85 }}>
            Активная команда: {explainingTeamName}
          </p>
        )}
        {awaitingStart ? (
          <p style={{ marginBottom: 0, fontSize: 16, opacity: 0.9 }}>
            Слово и таймер запустятся, когда объясняющий нажмёт «Начать».
          </p>
        ) : timerStarted ? (
          <>
            <p style={{ marginBottom: 6, fontSize: 20 }}>Таймер: {formatTime(timeLeft)}</p>
            <p style={{ marginBottom: 0, fontSize: 14, opacity: 0.85 }}>
              Смена слова: {timeUp ? 'сейчас' : `через ${Math.max(1, Math.ceil(timeLeft / 1000))} сек`}
            </p>
          </>
        ) : (
          <p style={{ marginBottom: 0, fontSize: 16, opacity: 0.8 }}>Подготовка раунда…</p>
        )}
      </div>

      <div className="gpl__panel" style={{ background: 'color-mix(in srgb, var(--gpl-panel-text) 6%, var(--gpl-panel))' }}>
        <p style={{ margin: '0 0 8px 0', fontWeight: 700 }}>Scoreboard раунда</p>
        <p style={{ margin: '0 0 6px 0', fontSize: 13, opacity: 0.9 }}>
          Ваш вклад: угадано {myStats.guessed || 0} · пропусков {myStats.skipped || 0}
        </p>
        <p style={{ margin: '0 0 6px 0', fontSize: 13, opacity: 0.85 }}>
          Штраф за пропуск: −{state.skipPenalty ?? 1} очко (у активной команды)
        </p>
        {state.mvp && (
          <p style={{ margin: 0, fontSize: 13, opacity: 0.92 }}>
            MVP объясняющего: {state.mvp.name} (угадано {state.mvp.guessed}, пропусков {state.mvp.skipped}, value {state.mvp.value})
          </p>
        )}
        {topPlayers.length > 0 && (
          <p style={{ margin: '8px 0 0 0', fontSize: 13, opacity: 0.9 }}>
            Топ раунда: {topPlayers.map((p) => `${playerNameById.get(p.id) || 'Игрок'} (${p.value})`).join(' · ')}
          </p>
        )}
      </div>

      {state.isExplainer ? (
        <div className="gpl__panel">
          <p style={{ margin: 0, fontSize: 14, opacity: 0.85, fontWeight: 800, marginBottom: 10 }}>
            Команда объясняет
          </p>
          <p style={{ margin: '0 0 16px', fontSize: 13, opacity: 0.9, lineHeight: 1.4 }}>
            Правило: не произноси само слово вслух. Объясняй так, чтобы команда догадалась.
          </p>
          {awaitingStart ? (
            <>
              {state.isCurrentExplainer ? (
                <button type="button" onClick={beginRound} className="gameplay__btn gameplay__btn--primary" style={{ marginBottom: 12 }}>
                  Начать
                </button>
              ) : (
                <p style={{ margin: '0 0 12px', fontSize: 14, opacity: 0.9 }}>
                  Ожидайте: раунд начнёт <strong>{state.explainerName}</strong> — кнопка «Начать» у текущего объясняющего.
                </p>
              )}
              <p style={{ margin: 0, fontSize: 13, opacity: 0.75 }}>Слово скрыто, пока раунд не начат.</p>
            </>
          ) : (
            <>
              <p style={{ fontSize: 28, fontWeight: 'bold', marginBottom: 24, wordBreak: 'break-word', color: 'var(--gpl-accent)' }}>{state.word}</p>
              <div style={{ display: 'flex', gap: 12 }}>
                <button type="button" onClick={guessed} className="gameplay__btn gameplay__btn--primary" style={{ flex: 1 }}>
                  Угадали
                </button>
                <button type="button" onClick={skip} className="gameplay__btn gameplay__btn--secondary" style={{ flex: 1 }}>
                  Пропустить
                </button>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="gh-card" style={{ padding: 16 }}>
          <p style={{ margin: 0, fontSize: 18, opacity: 0.9, fontWeight: 800 }}>Раунд: угадывайте</p>
          {awaitingStart && (
            <p style={{ margin: '10px 0 0', fontSize: 14, opacity: 0.9 }}>
              Скоро начнётся объяснение — ждите, пока <strong>{state.explainerName}</strong> нажмёт «Начать».
            </p>
          )}
          <div style={{ marginTop: 10, padding: 12, borderRadius: 12, background: 'color-mix(in srgb, var(--gpl-panel-text) 8%, transparent)' }}>
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
        state.isCurrentExplainer ? (
          <button type="button" onClick={nextTurn} className="gameplay__btn gameplay__btn--primary" style={{ marginTop: 16 }}>
            Следующий ход
          </button>
        ) : (
          <div className="gpl__panel" style={{ marginTop: 16, background: 'color-mix(in srgb, var(--gpl-panel-text) 6%, var(--gpl-panel))' }}>
            <p style={{ margin: 0, fontSize: 13, opacity: 0.9 }}>
              Таймер вышел. Смену хода запускает текущий объясняющий: <strong>{state.explainerName}</strong>
            </p>
          </div>
        )
      )}
    </GameLayout>
    </GameplayScreen>
  );
}
