import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { socket } from '../socket';

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function SpyRound({ roomId, user, room }) {
  const navigate = useNavigate();
  const [card, setCard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [secondsLeft, setSecondsLeft] = useState(null);
  const [votingEndsAt, setVotingEndsAt] = useState(null);
  const [votedForId, setVotedForId] = useState(null);
  const [voteResult, setVoteResult] = useState(null);

  const myId = user?.id != null ? String(user.id) : '';
  const otherPlayers = (room?.players || []).filter((p) => p.id !== myId);
  const [voteTick, setVoteTick] = useState(0);
  const voteSecondsLeft = votingEndsAt ? Math.max(0, Math.ceil((votingEndsAt - Date.now()) / 1000)) : 0;

  useEffect(() => {
    if (!myId) return;
    api.get(`/rooms/${roomId}/spy/card?playerId=${encodeURIComponent(myId)}`).then((r) => {
      setCard(r);
      if (r.timerEnabled && r.timerSeconds) setSecondsLeft(r.timerSeconds);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [roomId, myId]);

  useEffect(() => {
    if (secondsLeft == null || secondsLeft <= 0) return;
    const t = setInterval(() => setSecondsLeft((s) => (s <= 1 ? 0 : s - 1)), 1000);
    return () => clearInterval(t);
  }, [secondsLeft]);

  useEffect(() => {
    if (!votingEndsAt) return;
    const t = setInterval(() => setVoteTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [votingEndsAt]);

  useEffect(() => {
    const onVoteStart = (data) => setVotingEndsAt(data?.votingEndsAt || null);
    const onVoteEnd = (data) => setVoteResult(data || null);
    socket.on('game_vote_start', onVoteStart);
    socket.on('game_vote_end', onVoteEnd);
    return () => {
      socket.off('game_vote_start', onVoteStart);
      socket.off('game_vote_end', onVoteEnd);
    };
  }, []);

  const startVote = async () => {
    try {
      const r = await api.post(`/rooms/${roomId}/spy/start-vote`, { playerId: myId });
      if (r.votingEndsAt) setVotingEndsAt(r.votingEndsAt);
    } catch (_) {}
  };

  const sendVote = async (playerId) => {
    if (votedForId) return;
    try {
      await api.post(`/rooms/${roomId}/spy/vote`, { playerId: myId, votedForId: playerId });
      setVotedForId(playerId);
    } catch (_) {}
  };

  const goLobby = () => navigate('/lobby');

  if (loading) return <div style={{ padding: 24 }}>Загрузка…</div>;
  if (!card) return <div style={{ padding: 24 }}>Нет карты</div>;

  const isSpy = card.role === 'spy';
  const timeUp = card.timerEnabled && secondsLeft !== null && secondsLeft <= 0;
  const votingActive = votingEndsAt && Date.now() < votingEndsAt;

  if (voteResult) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <p style={{ fontSize: 22, marginBottom: 16 }}>
          {voteResult.isSpy ? 'Шпион найден!' : 'Ошибка — это не шпион.'}
        </p>
        <p style={{ opacity: 0.9 }}>Голосовали за: {voteResult.votedOutName}</p>
        <button type="button" onClick={goLobby} style={btnStyle}>
          В лобби
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, textAlign: 'center', minHeight: '60vh', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      {card.timerEnabled && secondsLeft !== null && !timeUp && (
        <p style={{ fontSize: 20, marginBottom: 16, opacity: 0.9 }}>Таймер: {formatTime(secondsLeft)}</p>
      )}
      {timeUp && <p style={{ fontSize: 22, color: '#fa0', marginBottom: 16 }}>Время вышло!</p>}
      {isSpy ? (
        <p style={{ fontSize: 24, color: '#f88' }}>Вы шпион</p>
      ) : (
        <p style={{ fontSize: 28, fontWeight: 'bold' }}>{card.word}</p>
      )}

      {!votingActive && !voteResult && (
        <button type="button" onClick={startVote} style={{ ...btnStyle, marginTop: 24, background: '#6a5' }}>
          Голосовать
        </button>
      )}

      {votingActive && (
        <div style={{ marginTop: 24, textAlign: 'left' }}>
          <p style={{ marginBottom: 8 }}>Голосование: {formatTime(voteSecondsLeft)}</p>
          <p style={{ marginBottom: 8 }}>Кто шпион?</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {otherPlayers.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => sendVote(p.id)}
                disabled={!!votedForId}
                style={{
                  ...btnStyle,
                  background: votedForId === p.id ? '#6a5' : '#444',
                }}
              >
                {p.name}{votedForId === p.id ? ' ✓' : ''}
              </button>
            ))}
          </div>
        </div>
      )}

      {!votingActive && !voteResult && (
        <button type="button" onClick={goLobby} style={{ ...btnStyle, marginTop: 16, background: '#555' }}>
          В лобби
        </button>
      )}
    </div>
  );
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
