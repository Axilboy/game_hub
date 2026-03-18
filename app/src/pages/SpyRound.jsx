import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { socket } from '../socket';

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function SpyRound({ roomId, user, room, onLeave }) {
  const navigate = useNavigate();
  const [card, setCard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timerStartsAt, setTimerStartsAt] = useState(null);
  const [votingEndsAt, setVotingEndsAt] = useState(null);
  const [votedForId, setVotedForId] = useState(null);
  const [voteResult, setVoteResult] = useState(null);
  const [voteTick, setVoteTick] = useState(0);

  const myId = user?.id != null ? String(user.id) : '';
  const otherPlayers = (room?.players || []).filter((p) => p.id !== myId);
  const voteSecondsLeft = votingEndsAt ? Math.max(0, Math.ceil((votingEndsAt - Date.now()) / 1000)) : 0;
  const timerSeconds = card?.timerSeconds ?? 60;
  const secondsLeft = card?.timerEnabled && timerStartsAt != null
    ? Math.max(0, Math.ceil((timerStartsAt + timerSeconds * 1000 - Date.now()) / 1000))
    : null;

  const fetchCard = () => {
    if (!myId) return;
    api.get(`/rooms/${roomId}/spy/card?playerId=${encodeURIComponent(myId)}`).then((r) => {
      setCard(r);
      if (r.timerStartsAt) setTimerStartsAt(r.timerStartsAt);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => {
    if (!myId) return;
    fetchCard();
  }, [roomId, myId]);

  useEffect(() => {
    if (!myId || !card) return;
    api.post(`/rooms/${roomId}/ready`, { playerId: myId, game: 'spy' }).catch(() => {});
  }, [roomId, myId, card]);

  useEffect(() => {
    const onTimerStart = (data) => {
      if (data?.timerStartsAt) setTimerStartsAt(data.timerStartsAt);
      else fetchCard();
    };
    socket.on('game_timer_start', onTimerStart);
    return () => socket.off('game_timer_start', onTimerStart);
  }, [roomId, myId]);

  useEffect(() => {
    const t = setInterval(() => setVoteTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

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

  const endVoteEarly = async () => {
    try {
      await api.post(`/rooms/${roomId}/spy/end-vote`);
    } catch (_) {}
  };

  const isHost = room?.players?.some((p) => p.id === myId && p.isHost);

  const [exitConfirm, setExitConfirm] = useState(false);
  const goLobby = () => navigate('/lobby');
  const exitToHome = () => {
    setExitConfirm(false);
    if (onLeave) onLeave();
    navigate('/');
  };

  if (loading) return <div style={{ padding: 24 }}>Загрузка…</div>;
  if (!card) return <div style={{ padding: 24 }}>Нет карты</div>;

  const isSpy = card.role === 'spy';
  const allSpiesRound = Boolean(card.allSpiesRound);
  const timeUp = card.timerEnabled && secondsLeft !== null && secondsLeft <= 0;
  const votingActive = votingEndsAt && Date.now() < votingEndsAt;

  if (voteResult) {
    return (
      <div style={{ padding: 24, textAlign: 'center', minHeight: '60vh', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div>
          {(voteResult.allSpiesRound || voteResult.isSpy) && (
            <p style={{ fontSize: 18, marginBottom: 8, color: '#8af' }}>{voteResult.allSpiesRound ? 'Раунд «Все шпионы»' : ''}</p>
          )}
          <p style={{ fontSize: 22, marginBottom: 12 }}>
            {voteResult.isSpy ? 'Шпион найден!' : 'Ошибка — это не шпион.'}
          </p>
          {voteResult.isSpy && (
            <p style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 8 }}>Им был: {voteResult.votedOutName}</p>
          )}
          <p style={{ opacity: 0.9 }}>Голосовали за: {voteResult.votedOutName}</p>
        </div>
        <div style={{ marginTop: 'auto', paddingTop: 24 }}>
          <button type="button" onClick={goLobby} style={btnStyle}>
            Ок
          </button>
          <button type="button" onClick={() => setExitConfirm(true)} style={{ ...btnStyle, marginTop: 8, background: '#333' }}>
            Выйти
          </button>
          {exitConfirm && (
            <div style={{ marginTop: 16, padding: 16, background: 'rgba(0,0,0,0.3)', borderRadius: 8 }}>
              <p style={{ marginBottom: 12 }}>Вы уверены?</p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" onClick={exitToHome} style={{ ...btnStyle, flex: 1, background: '#c44' }}>Да</button>
                <button type="button" onClick={() => setExitConfirm(false)} style={{ ...btnStyle, flex: 1, background: '#555' }}>Нет</button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, textAlign: 'center', minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        {card.timerEnabled && (timerStartsAt != null ? (
          !timeUp && <p style={{ fontSize: 20, marginBottom: 16, opacity: 0.9 }}>Таймер: {formatTime(secondsLeft ?? 0)}</p>
        ) : (
          <p style={{ fontSize: 16, marginBottom: 16, opacity: 0.8 }}>Ожидание готовности всех (после рекламы)…</p>
        ))}
        {timeUp && <p style={{ fontSize: 22, color: '#fa0', marginBottom: 16 }}>Время вышло!</p>}
        {allSpiesRound && <p style={{ fontSize: 16, color: '#8af', marginBottom: 12 }}>В этом раунде все — шпионы!</p>}
        {isSpy ? (
          <>
            <p style={{ fontSize: 24, color: '#f88' }}>Вы шпион</p>
            {card.otherSpyNames?.length > 0 && (
              <p style={{ fontSize: 14, opacity: 0.9, marginTop: 8 }}>Сообщники: {card.otherSpyNames.join(', ')}</p>
            )}
          </>
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
            {isHost && (
              <button type="button" onClick={endVoteEarly} style={{ ...btnStyle, marginBottom: 12, background: '#85a' }}>
                Огласить результат
              </button>
            )}
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
      </div>

      <div style={{ marginTop: 'auto', paddingTop: 24 }}>
        {!exitConfirm ? (
          <button type="button" onClick={() => setExitConfirm(true)} style={{ ...btnStyle, background: '#333' }}>
            Выйти
          </button>
        ) : (
          <div style={{ padding: 16, background: 'rgba(0,0,0,0.3)', borderRadius: 8 }}>
            <p style={{ marginBottom: 12 }}>Вы уверены?</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={exitToHome} style={{ ...btnStyle, flex: 1, background: '#c44' }}>Да</button>
              <button type="button" onClick={() => setExitConfirm(false)} style={{ ...btnStyle, flex: 1, background: '#555' }}>Нет</button>
            </div>
          </div>
        )}
      </div>
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
