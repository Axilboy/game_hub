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
  const [rolePeekVisible, setRolePeekVisible] = useState(true);
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

  // Reset auto-advance latch when phase changes (must run before any early return).
  useEffect(() => {
    if (!state?.isModerator) {
      autoAdvanceRef.current = { phase: null, phaseStartedAt: null, sent: false };
      return;
    }
    autoAdvanceRef.current = {
      phase: state.phase,
      phaseStartedAt: state.phaseStartedAt ?? null,
      sent: false,
    };
  }, [state?.isModerator, state?.phase, state?.phaseStartedAt]);

  // Auto-advance: moderator triggers `advance` once when timer reaches 0.
  useEffect(() => {
    if (!state?.isModerator) return;
    if (actionLoading) return;
    const phaseSecondsLeft =
      state.phaseStartedAt && state.phaseDurationSec
        ? Math.max(
            0,
            Math.ceil((state.phaseStartedAt + state.phaseDurationSec * 1000 - Date.now()) / 1000),
          )
        : null;
    if (phaseSecondsLeft == null) return;
    if (phaseSecondsLeft !== 0) return;
    if (!state.phaseStartedAt || !state.phaseDurationSec) return;
    if (autoAdvanceRef.current.sent) return;

    autoAdvanceRef.current.sent = true;
    const ph = state.phase;
    const started = state.phaseStartedAt;
    (async () => {
      const ok = await advancePhase({
        expectedPhase: ph,
        expectedPhaseStartedAt: started,
      });
      if (!ok) autoAdvanceRef.current.sent = false;
    })();
  }, [state, actionLoading, tick]);

  if (loading) {
    return (
      <GameplayScreen theme="mafia" user={user} onBack={() => navigate('/lobby')} backTitle="В лобби" title="Мафия">
        <Loader label="Загрузка Мафии..." minHeight="50vh" />
      </GameplayScreen>
    );
  }
  if (!state) {
    return (
      <GameplayScreen theme="mafia" user={user} onBack={() => navigate('/lobby')} backTitle="В лобби" title="Мафия">
        <ErrorState title="Нет данных" message="Состояние игры не загружено." actionLabel="В лобби" onAction={() => navigate('/lobby')} />
      </GameplayScreen>
    );
  }

  const isModerator = state.isModerator;
  const myRole = state.myRole;
  const phase = state.phase;
  const alive = state.alive || [];
  const aliveNameById = new Map(alive.map((p) => [p.id, p.name]));
  const amAlive = alive.some((p) => p.id === myId);
  const isDead = !amAlive && myRole;
  const myVoteId = state.dayVotes?.[myId] || voteTarget || null;
  const actingLabel = phase === 'night_mafia'
    ? 'Действует: мафия'
    : phase === 'night_commissioner'
      ? 'Действует: комиссар'
      : phase === 'day'
        ? 'Действуют: все игроки (обсуждение)'
        : 'Действуют: все живые (голосование)';
  const phaseSecondsLeft = state.phaseStartedAt && state.phaseDurationSec
    ? Math.max(0, Math.ceil((state.phaseStartedAt + state.phaseDurationSec * 1000 - Date.now()) / 1000))
    : null;

  if (winner) {
    return (
      <PostMatchScreen
        theme="mafia"
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
        <p style={{ fontSize: 22, marginBottom: 16 }}>
          {winner === 'civilians' ? 'Победили мирные!' : 'Победила мафия!'}
        </p>
        </div>
      </PostMatchScreen>
    );
  }

  return (
    <GameplayScreen theme="mafia" user={user} onBack={() => navigate('/lobby')} backTitle="В лобби" title="Мафия">
    <GameLayout
      top={null}
      center={false}
      padding={0}
      minHeight="auto"
      textAlign="center"
      bottom={
        <div style={{ marginTop: 24 }}>
          <p style={{ fontSize: 14, marginBottom: 8, opacity: 0.92 }}>В игре: {alive.map((p) => p.name).join(', ')}</p>
          <button type="button" onClick={() => navigate('/lobby')} className="gameplay__btn gameplay__btn--secondary">В лобби</button>
        </div>
      }
    >
      {myRole && (
        <button
          type="button"
          className="gameplay__peek-block"
          onClick={() => setRolePeekVisible((v) => !v)}
          aria-label={rolePeekVisible ? 'Скрыть роль' : 'Показать роль'}
        >
          <span className="gameplay__peek-block__label">Ваша роль</span>
          {rolePeekVisible ? (
            <span className="gameplay__peek-block__word" style={{ color: 'var(--gpl-accent)' }}>
              {myRole.roleName}
            </span>
          ) : (
            <span className="gameplay__peek-block__hidden">Роль скрыта — нажмите, чтобы показать</span>
          )}
        </button>
      )}

      <div className="gpl__panel">
        <p style={{ marginBottom: 8, opacity: 0.9 }}>Фаза: {phase === 'night_mafia' ? 'Ночь — мафия' : phase === 'night_commissioner' ? 'Ночь — комиссар' : phase === 'day' ? 'День' : 'Голосование'}</p>
        <p style={{ marginTop: 0, marginBottom: 8, fontSize: 13, opacity: 0.85 }}>{actingLabel}</p>
        {phaseSecondsLeft != null && (
          <p style={{ marginTop: 0, marginBottom: 8, fontSize: 13, opacity: 0.85 }}>
            Таймер фазы: {phaseSecondsLeft} сек
          </p>
        )}

        {isModerator && <p style={{ fontSize: 16, color: 'var(--gpl-accent)', marginBottom: 0 }}>Вы ведущий</p>}
      </div>

      <div className="gpl__panel" style={{ background: 'color-mix(in srgb, var(--gpl-panel-text) 8%, var(--gpl-panel))' }}>
        <p style={{ margin: '0 0 6px 0', fontWeight: 700 }}>Подсказка для новичков</p>
        <p style={{ margin: 0, fontSize: 13, opacity: 0.9 }}>
          Ночью действуют скрытые роли, днем обсуждение, затем голосование.
          Мирные ищут мафию, мафия маскируется. Победа мирных — исключить всю мафию.
        </p>
      </div>

      {(state.killedTonight?.length || state.eliminatedToday?.length || state.revealed?.length) > 0 && (
        <div className="gpl__panel" style={{ marginBottom: 16, background: 'color-mix(in srgb, var(--gpl-panel-text) 8%, var(--gpl-panel))' }}>
          {state.killedTonight?.length > 0 && <p>Погиб ночью: {state.killedTonight.map((x) => (typeof x === 'object' && x?.name) ? x.name : x).join(', ')}</p>}
          {state.eliminatedToday?.length > 0 && <p>Исключён днём: {state.eliminatedToday.map((x) => (typeof x === 'object' && x?.name) ? x.name : x).join(', ')}</p>}
          {state.revealed?.length > 0 && state.revealed.map((r) => <p key={r.id} style={{ margin: '4px 0', fontSize: 14 }}>Роль раскрыта: {r.role}</p>)}
        </div>
      )}

      {phase === 'night_mafia' && state.mafiaTeammates !== undefined && (
        <div className="gpl__panel" style={{ marginBottom: 16 }}>
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

      {isDead && <p style={{ color: '#c44', marginBottom: 16 }}>Вы погибли. Ожидайте окончания игры.</p>}

      {phase === 'night_commissioner' && myRole?.role === 'commissioner' && amAlive && (
        <div className="gpl__panel" style={{ marginBottom: 16 }}>
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
          {commissionerResult != null && <p style={{ marginTop: 8, color: 'var(--gpl-accent)' }}>Результат: {commissionerResult}</p>}
        </div>
      )}

      {phase === 'voting' && amAlive && (
        <div className="gpl__panel" style={{ marginBottom: 16 }}>
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
          {myVoteId && (
            <p style={{ marginTop: 8, marginBottom: 0, fontSize: 13, opacity: 0.9 }}>
              Ваш голос: {aliveNameById.get(myVoteId) || 'принят'}
            </p>
          )}
        </div>
      )}

      {phase === 'voting' && (
        <div className="gpl__panel" style={{ marginBottom: 16, background: 'color-mix(in srgb, var(--gpl-panel-text) 8%, var(--gpl-panel))' }}>
          <p style={{ margin: '0 0 8px 0', fontWeight: 700 }}>Протокол голосования</p>
          {alive.length === 0 ? (
            <p style={{ margin: 0, opacity: 0.8 }}>Нет живых игроков.</p>
          ) : (
            alive.map((p) => (
              <p key={p.id} style={{ margin: '4px 0', fontSize: 13, opacity: 0.92 }}>
                {p.name}: {state.voteCounts?.[p.id] || 0} голос(ов)
              </p>
            ))
          )}
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
    </GameplayScreen>
  );
}
