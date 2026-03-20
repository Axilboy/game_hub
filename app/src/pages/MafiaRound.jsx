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

const btnStyle = {
  padding: '12px 20px',
  fontSize: 16,
  borderRadius: 8,
  border: 'none',
  color: '#fff',
  cursor: 'pointer',
  width: '100%',
};

export default function MafiaRound({ roomId, user, room, onLeave }) {
  const navigate = useNavigate();
  useSeo({
    robots: 'noindex, nofollow',
  });
  const myId = user?.id != null ? String(user.id) : '';
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [winner, setWinner] = useState(null);
  const [voteTarget, setVoteTarget] = useState(null);
  const [commissionerResult, setCommissionerResult] = useState(null);
  const [actionLoading, setActionLoading] = useState(null); // 'kill' | 'commissioner_check' | 'vote' | 'advance'
  const [tick, setTick] = useState(0);
  const autoAdvanceRef = useRef({ phase: null, phaseStartedAt: null, sent: false });
  const requestSeqRef = useRef(0);

  const refreshState = ({ silent = false } = {}) => {
    if (!myId) return;
    const reqId = ++requestSeqRef.current;
    if (!silent) setLoading(true);
    api.get(`/rooms/${roomId}/mafia/state?playerId=${encodeURIComponent(myId)}`).then((s) => {
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
    const onPhase = () => refreshState({ silent: true });
    const onEnded = (data) => setWinner(data?.winner || null);
    const onGameEnded = () => refreshState({ silent: true });
    socket.on('mafia_phase', onPhase);
    socket.on('mafia_ended', onEnded);
    socket.on('game_ended', onGameEnded);
    return () => {
      socket.off('mafia_phase', onPhase);
      socket.off('mafia_ended', onEnded);
      socket.off('game_ended', onGameEnded);
    };
  }, [roomId, myId]);

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const onSock = () => refreshState({ silent: true });
    socket.onConnect(onSock);
    return () => socket.offConnect(onSock);
  }, [roomId, myId]);

  const advancePhase = async (opts = {}) => {
    if (actionLoading) return;
    try {
      setActionLoading('advance');
      const expectedPhase = opts.expectedPhase ?? state?.phase ?? undefined;
      const expectedPhaseStartedAt = opts.expectedPhaseStartedAt ?? state?.phaseStartedAt ?? undefined;
      await api.post(`/rooms/${roomId}/mafia/advance`, {
        playerId: myId,
        expectedPhase,
        expectedPhaseStartedAt,
      });
      refreshState({ silent: true });
      return true;
    } catch (_) {}
    finally {
      setActionLoading(null);
    }
    return false;
  };

  const sendMafiaKill = async (targetId) => {
    if (actionLoading) return;
    try {
      setActionLoading('kill');
      await api.post(`/rooms/${roomId}/mafia/action`, { playerId: myId, action: 'mafia_kill', targetId: targetId || undefined });
      refreshState({ silent: true });
    } catch (_) {}
    finally {
      setActionLoading(null);
    }
  };

  const sendCommissionerCheck = async (targetId) => {
    if (actionLoading) return;
    try {
      setActionLoading('commissioner_check');
      const r = await api.post(`/rooms/${roomId}/mafia/action`, { playerId: myId, action: 'commissioner_check', targetId });
      setCommissionerResult(r?.isMafia != null ? (r.isMafia ? 'Мафия' : 'Мирный') : null);
      refreshState({ silent: true });
    } catch (_) {}
    finally {
      setActionLoading(null);
    }
  };

  const sendVote = async (targetId) => {
    if (actionLoading || !!voteTarget) return;
    try {
      setActionLoading('vote');
      await api.post(`/rooms/${roomId}/mafia/vote`, { playerId: myId, targetId });
      setVoteTarget(targetId);
      refreshState({ silent: true });
    } catch (_) {}
    finally {
      setActionLoading(null);
    }
  };

  if (loading) return <div style={{ padding: 24 }}><Loader label="Загрузка Мафии..." minHeight="50vh" /></div>;
  if (!state) return <div style={{ padding: 24 }}><ErrorState title="Нет данных" message="Состояние игры не загружено." actionLabel="В лобби" onAction={() => navigate('/lobby')} /></div>;

  const isModerator = state.isModerator;
  const myRole = state.myRole;
  const phase = state.phase;
  const alive = state.alive || [];
  const amAlive = alive.some((p) => p.id === myId);
  const isDead = !amAlive && myRole;
  const phaseSecondsLeft = state.phaseStartedAt && state.phaseDurationSec
    ? Math.max(0, Math.ceil((state.phaseStartedAt + state.phaseDurationSec * 1000 - Date.now()) / 1000))
    : null;

  // Reset auto-advance latch when phase changes.
  useEffect(() => {
    if (!isModerator) {
      autoAdvanceRef.current = { phase: null, phaseStartedAt: null, sent: false };
      return;
    }
    autoAdvanceRef.current = { phase, phaseStartedAt: state?.phaseStartedAt ?? null, sent: false };
  }, [isModerator, phase, state?.phaseStartedAt]);

  // Auto-advance: moderator triggers `advance` once when timer reaches 0.
  useEffect(() => {
    if (!isModerator) return;
    if (actionLoading) return;
    if (phaseSecondsLeft == null) return;
    if (phaseSecondsLeft !== 0) return;
    if (!state?.phaseStartedAt || !state?.phaseDurationSec) return;
    if (autoAdvanceRef.current.sent) return;

    autoAdvanceRef.current.sent = true;
    // Use expectedPhase/expectedPhaseStartedAt so server ignores stale duplicates.
    (async () => {
      const ok = await advancePhase({
        expectedPhase: phase,
        expectedPhaseStartedAt: state.phaseStartedAt,
      });
      if (!ok) autoAdvanceRef.current.sent = false;
    })();
  }, [isModerator, actionLoading, phaseSecondsLeft, tick, phase, state?.phaseStartedAt, state?.phaseDurationSec]);

  if (winner) {
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
        <p style={{ fontSize: 22, marginBottom: 16 }}>
          {winner === 'civilians' ? 'Победили мирные!' : 'Победила мафия!'}
        </p>
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
        <div style={{ marginTop: 24 }}>
          <p style={{ fontSize: 14, marginBottom: 8 }}>В игре: {alive.map((p) => p.name).join(', ')}</p>
          <button type="button" onClick={() => navigate('/lobby')} style={{ ...btnStyle, background: '#333' }}>В лобби</button>
        </div>
      }
    >
      <div className="gh-card" style={{ marginBottom: 12, padding: 12 }}>
        <p style={{ marginBottom: 8, opacity: 0.9 }}>Фаза: {phase === 'night_mafia' ? 'Ночь — мафия' : phase === 'night_commissioner' ? 'Ночь — комиссар' : phase === 'day' ? 'День' : 'Голосование'}</p>
        {phaseSecondsLeft != null && (
          <p style={{ marginTop: 0, marginBottom: 8, fontSize: 13, opacity: 0.85 }}>
            Таймер фазы: {phaseSecondsLeft} сек
          </p>
        )}

        {isModerator && <p style={{ fontSize: 16, color: '#8af', marginBottom: 8 }}>Вы ведущий</p>}
        {myRole && (
          <p style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 0 }}>Ваша роль: {myRole.roleName}</p>
        )}
      </div>

      {(state.killedTonight?.length || state.eliminatedToday?.length || state.revealed?.length) > 0 && (
        <div className="gh-card" style={{ marginBottom: 16, padding: 12, background: 'rgba(0,0,0,0.2)' }}>
          {state.killedTonight?.length > 0 && <p>Погиб ночью: {state.killedTonight.map((x) => (typeof x === 'object' && x?.name) ? x.name : x).join(', ')}</p>}
          {state.eliminatedToday?.length > 0 && <p>Исключён днём: {state.eliminatedToday.map((x) => (typeof x === 'object' && x?.name) ? x.name : x).join(', ')}</p>}
          {state.revealed?.length > 0 && state.revealed.map((r) => <p key={r.id} style={{ margin: '4px 0', fontSize: 14 }}>Роль раскрыта: {r.role}</p>)}
        </div>
      )}

      {phase === 'night_mafia' && state.mafiaTeammates !== undefined && (
        <div className="gh-card" style={{ marginBottom: 16, padding: 12 }}>
          <p style={{ marginBottom: 8 }}>Мафия выбирает жертву</p>
          {alive.filter((p) => !state.mafiaTeammates?.some((m) => m.id === p.id)).map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => sendMafiaKill(p.id)}
              disabled={actionLoading === 'kill'}
              style={{ ...btnStyle, marginBottom: 8, background: '#633', opacity: actionLoading === 'kill' ? 0.7 : 1 }}
            >
              {actionLoading === 'kill' ? `${p.name}...` : p.name}
            </button>
          ))}
          {state.settings?.mafiaCanSkipKill && (
            <button
              type="button"
              onClick={() => sendMafiaKill(null)}
              disabled={actionLoading === 'kill'}
              style={{ ...btnStyle, background: '#444', opacity: actionLoading === 'kill' ? 0.7 : 1 }}
            >
              {actionLoading === 'kill' ? '...' : 'Не убивать'}
            </button>
          )}
        </div>
      )}

      {isDead && <p style={{ color: '#f88', marginBottom: 16 }}>Вы погибли. Ожидайте окончания игры.</p>}

      {phase === 'night_commissioner' && myRole?.role === 'commissioner' && amAlive && (
        <div className="gh-card" style={{ marginBottom: 16, padding: 12 }}>
          <p style={{ marginBottom: 8 }}>Проверить игрока</p>
          {alive.filter((p) => p.id !== myId).map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => sendCommissionerCheck(p.id)}
              disabled={actionLoading === 'commissioner_check'}
              style={{ ...btnStyle, marginBottom: 8, background: '#363', opacity: actionLoading === 'commissioner_check' ? 0.7 : 1 }}
            >
              {actionLoading === 'commissioner_check' ? `${p.name}...` : p.name}
            </button>
          ))}
          {commissionerResult != null && <p style={{ marginTop: 8, color: '#8af' }}>Результат: {commissionerResult}</p>}
        </div>
      )}

      {phase === 'voting' && amAlive && (
        <div className="gh-card" style={{ marginBottom: 16, padding: 12 }}>
          <p style={{ marginBottom: 8 }}>Голосование — кого исключить?</p>
          {alive.filter((p) => p.id !== myId).map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => sendVote(p.id)}
              disabled={!!voteTarget || actionLoading === 'vote'}
              style={{
                ...btnStyle,
                marginBottom: 8,
                background: voteTarget === p.id ? '#6a5' : '#444',
                opacity: voteTarget === p.id || actionLoading !== 'vote' ? 1 : 0.8,
              }}
            >
              {p.name}{voteTarget === p.id ? ' ✓' : ''}
              {actionLoading === 'vote' && voteTarget == null ? '...' : ''}
            </button>
          ))}
        </div>
      )}

      {isModerator && (
        <button
          type="button"
          onClick={advancePhase}
          disabled={!!actionLoading}
          style={{ ...btnStyle, marginTop: 16, background: '#6a5', opacity: actionLoading ? 0.7 : 1 }}
        >
          {actionLoading === 'advance' ? 'Идёт...' : phaseSecondsLeft === 0 ? 'Таймер вышел — далее' : 'Далее (ведущий)'}
        </button>
      )}

    </GameLayout>
  );
}
