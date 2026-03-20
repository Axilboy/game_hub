import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, getApiErrorMessage } from '../api';
import { socket } from '../socket';
import BackArrow from '../components/BackArrow';
import useSeo from '../hooks/useSeo';
import GameLayout from '../components/game/GameLayout';
import PostMatchScreen from '../components/game/PostMatchScreen';
import Loader from '../components/ui/Loader';
import ErrorState from '../components/ui/ErrorState';

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function SpyRound({ roomId, user, room, onLeave, onGoLobby }) {
  const navigate = useNavigate();
  useSeo({
    robots: 'noindex, nofollow',
  });
  const [card, setCard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timerStartsAt, setTimerStartsAt] = useState(null);
  const [votingEndsAt, setVotingEndsAt] = useState(null);
  const [votedForId, setVotedForId] = useState(null);
  const [voteResult, setVoteResult] = useState(null);
  const [voteTick, setVoteTick] = useState(0);
  const [voteRequestLock, setVoteRequestLock] = useState(false);
  const [startVoteLock, setStartVoteLock] = useState(false);
  const [guessText, setGuessText] = useState('');
  const [guessResult, setGuessResult] = useState(null);
  const [guessLoading, setGuessLoading] = useState(false);
  const requestSeqRef = useRef(0);

  const myId = user?.id != null ? String(user.id) : '';
  const otherPlayers = (room?.players || []).filter((p) => p.id !== myId);
  const voteSecondsLeft = votingEndsAt ? Math.max(0, Math.ceil((votingEndsAt - Date.now()) / 1000)) : 0;
  const timerSeconds = card?.timerSeconds ?? 60;
  const secondsLeft = card?.timerEnabled && timerStartsAt != null
    ? Math.max(0, Math.ceil((timerStartsAt + timerSeconds * 1000 - Date.now()) / 1000))
    : null;

  const fetchCard = ({ silent = false } = {}) => {
    if (!myId) return;
    const reqId = ++requestSeqRef.current;
    if (!silent) setLoading(true);
    api.get(`/rooms/${roomId}/spy/card?playerId=${encodeURIComponent(myId)}`).then((r) => {
      if (reqId !== requestSeqRef.current) return;
      setCard(r);
      if (r.timerStartsAt) setTimerStartsAt(r.timerStartsAt);
      if (!silent) setLoading(false);
    }).catch(() => {
      if (reqId !== requestSeqRef.current) return;
      if (!silent) setLoading(false);
    });
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
      else fetchCard({ silent: true });
    };
    socket.on('game_timer_start', onTimerStart);
    return () => socket.off('game_timer_start', onTimerStart);
  }, [roomId, myId]);

  useEffect(() => {
    if (!votingEndsAt && !(card?.timerEnabled && timerStartsAt != null)) return;
    const t = setInterval(() => setVoteTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [votingEndsAt, card?.timerEnabled, timerStartsAt]);

  useEffect(() => {
    const onVoteStart = (data) => setVotingEndsAt(data?.votingEndsAt || null);
    const onVoteEnd = (data) => setVoteResult(data || null);
    const onGuessResult = (data) => {
      if (data?.correct) {
        setVoteResult({
          guessMode: true,
          isSpy: true,
          votedOutName: data.guessedByName || 'Шпион',
          guessedLocation: data.guessedLocation || null,
          actualLocation: data.actualLocation || null,
        });
      }
    };
    socket.on('game_vote_start', onVoteStart);
    socket.on('game_vote_end', onVoteEnd);
    socket.on('game_guess_result', onGuessResult);
    return () => {
      socket.off('game_vote_start', onVoteStart);
      socket.off('game_vote_end', onVoteEnd);
      socket.off('game_guess_result', onGuessResult);
    };
  }, []);

  useEffect(() => {
    const resync = async () => {
      if (!myId || !roomId) return;
      try {
        const st = await api.get(`/rooms/${roomId}/spy/vote-status`);
        if (st?.active && st?.votingEndsAt) setVotingEndsAt(st.votingEndsAt);
      } catch (_) {}
      fetchCard({ silent: true });
    };
    socket.onConnect(resync);
    return () => socket.offConnect(resync);
  }, [roomId, myId]);

  const startVote = async () => {
    if (startVoteLock) return;
    try {
      setStartVoteLock(true);
      const r = await api.post(`/rooms/${roomId}/spy/start-vote`, { playerId: myId });
      if (r.votingEndsAt) setVotingEndsAt(r.votingEndsAt);
    } catch (_) {}
    finally {
      setStartVoteLock(false);
    }
  };

  const sendVote = async (playerId) => {
    if (votedForId || voteRequestLock) return;
    try {
      setVoteRequestLock(true);
      await api.post(`/rooms/${roomId}/spy/vote`, { playerId: myId, votedForId: playerId });
      setVotedForId(playerId);
    } catch (_) {}
    finally {
      setVoteRequestLock(false);
    }
  };

  const endVoteEarly = async () => {
    try {
      await api.post(`/rooms/${roomId}/spy/end-vote`, { playerId: myId });
    } catch (_) {}
  };

  const isHost = room?.players?.some((p) => p.id === myId && p.isHost);
  const canSpyGuess = isSpy && !votingActive && !voteResult;

  const submitGuess = async () => {
    if (!canSpyGuess || guessLoading) return;
    const val = guessText.trim();
    if (!val) return;
    setGuessLoading(true);
    setGuessResult(null);
    try {
      const r = await api.post(`/rooms/${roomId}/spy/guess-location`, { playerId: myId, guess: val });
      if (!r?.correct) {
        setGuessResult('Неверно. Продолжайте играть и собирать подсказки.');
      }
    } catch (e) {
      setGuessResult(getApiErrorMessage(e, 'Не удалось отправить попытку'));
    } finally {
      setGuessLoading(false);
    }
  };

  const [exitConfirm, setExitConfirm] = useState(false);
  const goLobby = () => { if (onGoLobby) onGoLobby(); else navigate('/lobby'); };
  const exitToHome = () => {
    setExitConfirm(false);
    if (onLeave) onLeave();
    navigate('/');
  };

  if (loading) return <div style={{ padding: 24 }}><Loader label="Загрузка раунда..." minHeight="60vh" /></div>;
  if (!card) return <div style={{ padding: 24 }}><ErrorState title="Нет карты" message="Данные раунда пока недоступны." actionLabel="В лобби" onAction={goLobby} /></div>;

  const isSpy = card.role === 'spy';
  const allSpiesRound = Boolean(card.allSpiesRound);
  const timeUp = card.timerEnabled && secondsLeft !== null && secondsLeft <= 0;
  const votingActive = votingEndsAt && Date.now() < votingEndsAt;

  if (voteResult) {
    return (
      <PostMatchScreen
        top={<BackArrow onClick={goLobby} title="В лобби" />}
        center={false}
        padding={24}
        primaryLabel="Ок"
        onPrimary={goLobby}
        secondaryLabel="Выйти"
        onSecondary={exitToHome}
        secondaryBg="#333"
        confirmSecondary={true}
        confirmTitle="Вы уверены?"
        confirmText="Выйти прямо сейчас — вы покинете комнату."
      >
        <div className="gh-card" style={{ padding: 16 }}>
          {(voteResult.allSpiesRound || voteResult.isSpy) && (
            <p style={{ fontSize: 18, marginBottom: 8, color: '#8af' }}>
              {voteResult.allSpiesRound ? 'Раунд «Все шпионы»' : ''}
            </p>
          )}
          <p style={{ fontSize: 22, marginBottom: 12 }}>
            {voteResult.guessMode
              ? 'Шпион угадал локацию!'
              : voteResult.isSpy ? 'Шпион найден!' : 'Ошибка — это не шпион.'}
          </p>
          {voteResult.guessMode ? (
            <>
              <p style={{ fontSize: 18, marginBottom: 8 }}>Шпион: {voteResult.votedOutName}</p>
              <p style={{ opacity: 0.9, marginBottom: 0 }}>
                Локация: {voteResult.actualLocation || voteResult.guessedLocation || 'скрыто'}
              </p>
            </>
          ) : voteResult.isSpy && (
            <p style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 8 }}>Им был: {voteResult.votedOutName}</p>
          )}
          {!voteResult.guessMode ? (
            <p style={{ opacity: 0.9 }}>Голосовали за: {voteResult.votedOutName}</p>
          ) : null}
        </div>
      </PostMatchScreen>
    );
  }

  return (
    <GameLayout
      top={<BackArrow onClick={() => setExitConfirm(true)} title="Выйти" />}
      center={false}
      padding={24}
      bottom={
        !exitConfirm ? (
          <div style={{ paddingTop: 24 }}>
            <button type="button" onClick={() => setExitConfirm(true)} style={{ ...btnStyle, background: '#333' }}>
              Выйти
            </button>
          </div>
        ) : (
          <div style={{ paddingTop: 24, display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}>
            <div style={{ padding: 16, background: 'rgba(0,0,0,0.3)', borderRadius: 8 }}>
              <p style={{ marginBottom: 12 }}>Вы уверены?</p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" onClick={exitToHome} style={{ ...btnStyle, flex: 1, background: '#c44' }}>Да</button>
                <button type="button" onClick={() => setExitConfirm(false)} style={{ ...btnStyle, flex: 1, background: '#555' }}>Нет</button>
              </div>
            </div>
          </div>
        )
      }
    >
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <p style={{ fontSize: 13, opacity: 0.88, textAlign: 'center', margin: '0 0 12px', lineHeight: 1.4 }}>
          {isHost
            ? 'Вы ведущий (хост): запускайте голосование и при необходимости оглашайте результат.'
            : 'Голосование запускает хост. Следите за таймером и выберите игрока, когда откроется этап.'}
        </p>
        {card.timerEnabled && (
          <div
            className="gh-card"
            style={{
              position: 'absolute',
              top: 56,
              left: '50%',
              transform: 'translateX(-50%)',
              padding: '10px 14px',
              borderRadius: 12,
              width: 'fit-content',
              background: timeUp ? 'rgba(255,100,0,0.18)' : 'rgba(0,0,0,0.25)',
              border: `1px solid ${timeUp ? 'rgba(255,120,0,0.5)' : 'rgba(255,255,255,0.12)'}`,
              boxShadow: '0 14px 40px rgba(0,0,0,0.35)',
            }}
          >
            <div style={{ fontSize: 12, opacity: 0.9, fontWeight: 800, marginBottom: 4 }}>
              Таймер раунда
            </div>
            <div style={{ fontSize: 16, fontWeight: 900, color: timeUp ? '#ffb38a' : '#fff' }}>
              {timerStartsAt == null ? 'Ожидаем готовность всех…' : timeUp ? 'Время вышло!' : formatTime(secondsLeft ?? 0)}
            </div>
          </div>
        )}
        <div className="gh-card" style={{ padding: 16 }}>
          {allSpiesRound && <p style={{ fontSize: 16, color: '#8af', marginBottom: 12 }}>В этом раунде все — шпионы!</p>}
          {isSpy ? (
            <>
              <p style={{ fontSize: 24, color: '#f88', margin: 0 }}>Вы шпион</p>
              <p style={{ fontSize: 28, fontWeight: 'bold', margin: 0, opacity: 0.55 }}>Слово скрыто</p>
              {card.otherSpyNames?.length > 0 && (
                <p style={{ fontSize: 14, opacity: 0.9, marginTop: 8 }}>Сообщники: {card.otherSpyNames.join(', ')}</p>
              )}
              <div style={{ marginTop: 12, padding: 12, borderRadius: 12, background: 'rgba(0,0,0,0.25)' }}>
                <p style={{ margin: 0, fontWeight: 800, fontSize: 13, opacity: 0.95 }}>Подсказки</p>
                <p style={{ margin: '6px 0 0', fontSize: 13, opacity: 0.9, lineHeight: 1.35 }}>Что видно: слово скрыто</p>
                <p style={{ margin: '6px 0 0', fontSize: 13, opacity: 0.9, lineHeight: 1.35 }}>Что делать: голосуй во время голосования</p>
              </div>
            </>
          ) : (
            <>
              <p style={{ fontSize: 28, fontWeight: 'bold', margin: 0 }}>{card.word}</p>
              <div style={{ marginTop: 12, padding: 12, borderRadius: 12, background: 'rgba(0,0,0,0.25)' }}>
                <p style={{ margin: 0, fontWeight: 800, fontSize: 13, opacity: 0.95 }}>Подсказки</p>
                <p style={{ margin: '6px 0 0', fontSize: 13, opacity: 0.9, lineHeight: 1.35 }}>Что видно: слово видно</p>
                <p style={{ margin: '6px 0 0', fontSize: 13, opacity: 0.9, lineHeight: 1.35 }}>Что делать: голосуй во время голосования</p>
              </div>
            </>
          )}
          {card.showLocationsList && Array.isArray(card.locationList) && card.locationList.length > 0 && (
            <div style={{ marginTop: 12, padding: 10, borderRadius: 10, background: 'rgba(255,255,255,0.05)' }}>
              <p style={{ margin: 0, fontSize: 12, opacity: 0.9, fontWeight: 700 }}>Возможные локации ({card.locationList.length})</p>
              <p style={{ margin: '6px 0 0', fontSize: 12, opacity: 0.85, lineHeight: 1.4 }}>
                {card.locationList.join(', ')}
              </p>
            </div>
          )}
        </div>

        {canSpyGuess && (
          <div className="gh-card" style={{ marginTop: 12, padding: 12 }}>
            <p style={{ marginTop: 0, marginBottom: 8, fontSize: 14 }}>Попытка шпиона: угадать локацию</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                value={guessText}
                onChange={(e) => setGuessText(e.target.value)}
                placeholder="Введите локацию"
                style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid #555', background: 'transparent', color: 'inherit' }}
              />
              <button
                type="button"
                onClick={submitGuess}
                disabled={guessLoading || !guessText.trim()}
                style={{ ...btnStyle, width: 'auto', background: '#8a5', opacity: guessLoading ? 0.7 : 1 }}
              >
                {guessLoading ? '...' : 'Угадать'}
              </button>
            </div>
            {guessResult ? <p style={{ margin: '8px 0 0', fontSize: 13, opacity: 0.9 }}>{guessResult}</p> : null}
          </div>
        )}

        {!votingActive && !voteResult && (
          isHost ? (
            <button
              type="button"
              onClick={startVote}
              disabled={startVoteLock}
              style={{ ...btnStyle, marginTop: 24, background: '#6a5', opacity: startVoteLock ? 0.7 : 1 }}
            >
              Запустить голосование
            </button>
          ) : (
            <div style={{ marginTop: 24, opacity: 0.85 }}>
              <p style={{ margin: 0, fontSize: 14 }}>Ожидайте: хост запустит голосование</p>
            </div>
          )
        )}

        {votingActive && (
          <div className="gh-card" style={{ marginTop: 24, textAlign: 'left', padding: 16 }}>
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
                  disabled={!!votedForId || voteRequestLock}
                  style={{
                    ...btnStyle,
                    background: votedForId === p.id ? '#6a5' : '#444',
                    opacity: voteRequestLock ? 0.7 : 1,
                  }}
                >
                  {p.name}{votedForId === p.id ? ' ✓' : ''}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </GameLayout>
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
