import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { socket } from '../socket';
import BackArrow from '../components/BackArrow';
import useSeo from '../hooks/useSeo';
import GameLayout from '../components/game/GameLayout';
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

  const refreshState = () => {
    if (!myId) return;
    api.get(`/rooms/${roomId}/mafia/state?playerId=${encodeURIComponent(myId)}`).then((s) => {
      setState(s);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => refreshState(), [roomId, myId]);
  useEffect(() => {
    socket.on('mafia_phase', refreshState);
    socket.on('mafia_ended', (data) => setWinner(data?.winner || null));
    socket.on('game_ended', () => refreshState());
    return () => {
      socket.off('mafia_phase', refreshState);
      socket.off('mafia_ended');
      socket.off('game_ended', refreshState);
    };
  }, [roomId, myId]);

  const advancePhase = async () => {
    if (actionLoading) return;
    try {
      setActionLoading('advance');
      await api.post(`/rooms/${roomId}/mafia/advance`, { playerId: myId });
      refreshState();
    } catch (_) {}
    finally {
      setActionLoading(null);
    }
  };

  const sendMafiaKill = async (targetId) => {
    if (actionLoading) return;
    try {
      setActionLoading('kill');
      await api.post(`/rooms/${roomId}/mafia/action`, { playerId: myId, action: 'mafia_kill', targetId: targetId || undefined });
      refreshState();
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
      refreshState();
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
      refreshState();
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

  if (winner) {
    return (
      <GameLayout
        top={<BackArrow onClick={() => navigate('/lobby')} title="В лобби" />}
        center={true}
        padding={24}
        textAlign="center"
        bottom={
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button type="button" onClick={() => navigate('/lobby')} style={btnStyle}>В лобби</button>
            <button type="button" onClick={onLeave} style={{ ...btnStyle, background: '#333' }}>Выйти</button>
          </div>
        }
      >
        <p style={{ fontSize: 22, marginBottom: 16 }}>{winner === 'civilians' ? 'Победили мирные!' : 'Победила мафия!'}</p>
      </GameLayout>
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
          {actionLoading === 'advance' ? 'Идёт...' : 'Далее (ведущий)'}
        </button>
      )}

    </GameLayout>
  );
}
