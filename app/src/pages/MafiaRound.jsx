import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { socket } from '../socket';
import BackArrow from '../components/BackArrow';

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
  const myId = user?.id != null ? String(user.id) : '';
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [winner, setWinner] = useState(null);
  const [voteTarget, setVoteTarget] = useState(null);
  const [commissionerResult, setCommissionerResult] = useState(null);

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
    try {
      await api.post(`/rooms/${roomId}/mafia/advance`, { playerId: myId });
      refreshState();
    } catch (_) {}
  };

  const sendMafiaKill = async (targetId) => {
    try {
      await api.post(`/rooms/${roomId}/mafia/action`, { playerId: myId, action: 'mafia_kill', targetId: targetId || undefined });
      refreshState();
    } catch (_) {}
  };

  const sendCommissionerCheck = async (targetId) => {
    try {
      const r = await api.post(`/rooms/${roomId}/mafia/action`, { playerId: myId, action: 'commissioner_check', targetId });
      setCommissionerResult(r?.isMafia != null ? (r.isMafia ? 'Мафия' : 'Мирный') : null);
      refreshState();
    } catch (_) {}
  };

  const sendVote = async (targetId) => {
    try {
      await api.post(`/rooms/${roomId}/mafia/vote`, { playerId: myId, targetId });
      setVoteTarget(targetId);
      refreshState();
    } catch (_) {}
  };

  if (loading) return <div style={{ padding: 24 }}>Загрузка…</div>;
  if (!state) return <div style={{ padding: 24 }}>Нет данных</div>;

  const isModerator = state.isModerator;
  const myRole = state.myRole;
  const phase = state.phase;
  const alive = state.alive || [];
  const amAlive = alive.some((p) => p.id === myId);
  const isDead = !amAlive && myRole;

  if (winner) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <BackArrow onClick={() => navigate('/lobby')} title="В лобби" />
        <p style={{ fontSize: 22, marginBottom: 16 }}>{winner === 'civilians' ? 'Победили мирные!' : 'Победила мафия!'}</p>
        <button type="button" onClick={() => navigate('/lobby')} style={btnStyle}>В лобби</button>
        <button type="button" onClick={onLeave} style={{ ...btnStyle, marginTop: 8, background: '#333' }}>Выйти</button>
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <BackArrow onClick={() => navigate('/lobby')} title="В лобби" />
      <p style={{ marginBottom: 8, opacity: 0.9 }}>Фаза: {phase === 'night_mafia' ? 'Ночь — мафия' : phase === 'night_commissioner' ? 'Ночь — комиссар' : phase === 'day' ? 'День' : 'Голосование'}</p>

      {isModerator && <p style={{ fontSize: 16, color: '#8af', marginBottom: 8 }}>Вы ведущий</p>}
      {myRole && (
        <p style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 16 }}>Ваша роль: {myRole.roleName}</p>
      )}

      {(state.killedTonight?.length || state.eliminatedToday?.length || state.revealed?.length) > 0 && (
        <div style={{ marginBottom: 16, padding: 12, background: 'rgba(0,0,0,0.2)', borderRadius: 8 }}>
          {state.killedTonight?.length > 0 && <p>Погиб ночью: {state.killedTonight.map((x) => (typeof x === 'object' && x?.name) ? x.name : x).join(', ')}</p>}
          {state.eliminatedToday?.length > 0 && <p>Исключён днём: {state.eliminatedToday.map((x) => (typeof x === 'object' && x?.name) ? x.name : x).join(', ')}</p>}
          {state.revealed?.length > 0 && state.revealed.map((r) => <p key={r.id} style={{ margin: '4px 0', fontSize: 14 }}>Роль раскрыта: {r.role}</p>)}
        </div>
      )}

      {phase === 'night_mafia' && state.mafiaTeammates !== undefined && (
        <div style={{ marginBottom: 16 }}>
          <p style={{ marginBottom: 8 }}>Мафия выбирает жертву</p>
          {alive.filter((p) => !state.mafiaTeammates?.some((m) => m.id === p.id)).map((p) => (
            <button key={p.id} type="button" onClick={() => sendMafiaKill(p.id)} style={{ ...btnStyle, marginBottom: 8, background: '#633' }}>{p.name}</button>
          ))}
          {state.settings?.mafiaCanSkipKill && <button type="button" onClick={() => sendMafiaKill(null)} style={{ ...btnStyle, background: '#444' }}>Не убивать</button>}
        </div>
      )}

      {isDead && <p style={{ color: '#f88', marginBottom: 16 }}>Вы погибли. Ожидайте окончания игры.</p>}

      {phase === 'night_commissioner' && myRole?.role === 'commissioner' && amAlive && (
        <div style={{ marginBottom: 16 }}>
          <p style={{ marginBottom: 8 }}>Проверить игрока</p>
          {alive.filter((p) => p.id !== myId).map((p) => (
            <button key={p.id} type="button" onClick={() => sendCommissionerCheck(p.id)} style={{ ...btnStyle, marginBottom: 8, background: '#363' }}>{p.name}</button>
          ))}
          {commissionerResult != null && <p style={{ marginTop: 8, color: '#8af' }}>Результат: {commissionerResult}</p>}
        </div>
      )}

      {phase === 'voting' && amAlive && (
        <div style={{ marginBottom: 16 }}>
          <p style={{ marginBottom: 8 }}>Голосование — кого исключить?</p>
          {alive.filter((p) => p.id !== myId).map((p) => (
            <button key={p.id} type="button" onClick={() => sendVote(p.id)} disabled={!!voteTarget} style={{ ...btnStyle, marginBottom: 8, background: voteTarget === p.id ? '#6a5' : '#444' }}>{p.name}{voteTarget === p.id ? ' ✓' : ''}</button>
          ))}
        </div>
      )}

      {isModerator && (
        <button type="button" onClick={advancePhase} style={{ ...btnStyle, marginTop: 16, background: '#6a5' }}>Далее (ведущий)</button>
      )}

      <div style={{ marginTop: 24 }}>
        <p style={{ fontSize: 14, marginBottom: 8 }}>В игре: {alive.map((p) => p.name).join(', ')}</p>
        <button type="button" onClick={() => navigate('/lobby')} style={{ ...btnStyle, background: '#333' }}>В лобби</button>
      </div>
    </div>
  );
}
