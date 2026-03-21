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
import Badge from '../components/ui/Badge';
import GameplayScreen from '../components/game/GameplayScreen';
import './spyRound.css';

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
  const [guessPollLock, setGuessPollLock] = useState(false);
  const [exitConfirm, setExitConfirm] = useState(false);
  const [wordPeekVisible, setWordPeekVisible] = useState(true);
  const [rolePeekVisible, setRolePeekVisible] = useState(true);
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
    const onGuessPollStart = () => fetchCard({ silent: true });
    const onGuessPollResult = () => {
      fetchCard({ silent: true });
    };
    socket.on('game_vote_start', onVoteStart);
    socket.on('game_vote_end', onVoteEnd);
    socket.on('game_guess_result', onGuessResult);
    socket.on('game_guess_poll_start', onGuessPollStart);
    socket.on('game_guess_poll_result', onGuessPollResult);
    return () => {
      socket.off('game_vote_start', onVoteStart);
      socket.off('game_vote_end', onVoteEnd);
      socket.off('game_guess_result', onGuessResult);
      socket.off('game_guess_poll_start', onGuessPollStart);
      socket.off('game_guess_poll_result', onGuessPollResult);
    };
  }, [roomId, myId]);

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

  const isHost = String(room?.hostId) === myId;

  const startGuessPoll = async () => {
    if (guessPollLock) return;
    try {
      setGuessPollLock(true);
      await api.post(`/rooms/${roomId}/spy/start-guess-poll`, { playerId: myId });
      fetchCard({ silent: true });
    } catch (_) {}
    finally {
      setGuessPollLock(false);
    }
  };

  const sendGuessPollVote = async (verdict) => {
    if (guessPollLock || card?.guessPollMyVote) return;
    try {
      setGuessPollLock(true);
      await api.post(`/rooms/${roomId}/spy/guess-poll-vote`, { playerId: myId, verdict });
      fetchCard({ silent: true });
    } catch (_) {}
    finally {
      setGuessPollLock(false);
    }
  };

  const endGuessPollEarly = async () => {
    try {
      await api.post(`/rooms/${roomId}/spy/end-guess-poll`, { playerId: myId });
      fetchCard({ silent: true });
    } catch (_) {}
  };

  const goLobby = () => { if (onGoLobby) onGoLobby(); else navigate('/lobby'); };
  const exitToHome = () => {
    setExitConfirm(false);
    if (onLeave) onLeave();
    navigate('/');
  };

  if (loading) {
    return (
      <GameplayScreen theme="spy" user={user} onBack={goLobby} backTitle="В лобби" title="Шпион">
        <Loader label="Загрузка раунда..." minHeight="60vh" />
      </GameplayScreen>
    );
  }
  if (!card) {
    return (
      <GameplayScreen theme="spy" user={user} onBack={goLobby} backTitle="В лобби" title="Шпион">
        <ErrorState title="Нет карты" message="Данные раунда пока недоступны." actionLabel="В лобби" onAction={goLobby} />
      </GameplayScreen>
    );
  }

  const isSpy = card.role === 'spy';
  const allSpiesRound = Boolean(card.allSpiesRound);
  const timeUp = card.timerEnabled && secondsLeft !== null && secondsLeft <= 0;
  const votingActive = votingEndsAt && Date.now() < votingEndsAt;
  const guessPollActive = Boolean(card.guessPollActive);
  const phaseLabel = voteResult ? 'Итог' : votingActive ? 'Голосование' : guessPollActive ? 'Проверка слова' : 'Обсуждение';
  const wordDisplay = isSpy ? (card.wordMask || '• • •') : card.word;
  const canStartGuessPoll = isSpy && !allSpiesRound && !votingActive && !voteResult && !guessPollActive;
  const canVoteGuessPoll = guessPollActive && !isSpy && !card.guessPollMyVote;

  if (voteResult) {
    return (
      <PostMatchScreen
        theme="spy"
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
        <div className="gpl__panel">
          <div style={{ marginBottom: 8 }}>
            <Badge tone={votingActive ? 'warning' : 'info'}>{phaseLabel}</Badge>
          </div>
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
    <GameplayScreen theme="spy" user={user} onBack={() => setExitConfirm(true)} backTitle="Выйти" title="Шпион">
    <GameLayout
      top={null}
      center={false}
      padding={0}
      minHeight="auto"
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
            ? 'Вы ведущий: запускайте голосование и при необходимости проверку устной догадки шпиона.'
            : 'Голосование и проверку слова запускает хост. Следите за таймером.'}
        </p>
        <div style={{ margin: '0 auto 10px', width: 'fit-content' }}>
          <Badge tone={votingActive ? 'warning' : guessPollActive ? 'warning' : 'info'}>{phaseLabel}</Badge>
        </div>
        {card.timerEnabled && (
          <div
            className="gpl__panel"
            style={{
              position: 'absolute',
              top: 56,
              left: '50%',
              transform: 'translateX(-50%)',
              padding: '10px 14px',
              width: 'fit-content',
              boxShadow: '0 14px 40px rgba(0,0,0,0.35)',
              zIndex: 2,
            }}
          >
            <div style={{ fontSize: 12, opacity: 0.9, fontWeight: 800, marginBottom: 4 }}>
              Таймер раунда
            </div>
            <div style={{ fontSize: 16, fontWeight: 900, color: timeUp ? '#ffb38a' : 'var(--gpl-panel-text)' }}>
              {timerStartsAt == null ? 'Ожидаем готовность всех…' : timeUp ? 'Время вышло!' : formatTime(secondsLeft ?? 0)}
            </div>
          </div>
        )}
        <div className="gpl__panel">
          {allSpiesRound && <p className="spy-round__sub" style={{ marginBottom: 12 }}>В этом раунде все — шпионы</p>}

          <button
            type="button"
            className="gameplay__peek-block"
            onClick={() => setWordPeekVisible((v) => !v)}
            aria-label={wordPeekVisible ? 'Скрыть' : 'Показать слово'}
          >
            <span className="gameplay__peek-block__label">
              {isSpy ? 'Ваша подсказка' : 'Локация'}
            </span>
            {wordPeekVisible ? (
              <span className="gameplay__peek-block__word">{wordDisplay}</span>
            ) : (
              <span className="gameplay__peek-block__hidden">Скрыто — нажмите, чтобы показать</span>
            )}
          </button>

          <p className="spy-round__sub" style={{ marginTop: 0 }}>
            {isSpy
              ? 'Догадывайтесь по обсуждению. Не подсматривайте чужие экраны. Нажмите на блок выше, чтобы скрыть экран.'
              : 'Ваше слово на этот раунд. Не показывайте экран другим. Нажмите на блок — можно временно скрыть.'}
          </p>
          {isSpy && card.otherSpyNames?.length > 0 && (
            <p className="spy-round__sub" style={{ marginTop: 8 }}>Сообщники: {card.otherSpyNames.join(', ')}</p>
          )}

          {card.showLocationsList && Array.isArray(card.locationList) && card.locationList.length > 0 && (
            <div
              style={{
                marginTop: 12,
                padding: 14,
                borderRadius: 14,
                background: 'color-mix(in srgb, var(--gpl-panel-text) 6%, var(--gpl-panel))',
                textAlign: 'left',
              }}
            >
              <p style={{ margin: 0, fontSize: 12, fontWeight: 800, opacity: 0.85, color: 'var(--gpl-panel-text)' }}>
                Возможные локации ({card.locationList.length})
              </p>
              <p style={{ margin: '8px 0 0', fontSize: 13, opacity: 0.88, lineHeight: 1.45, color: 'var(--gpl-panel-text)' }}>
                {card.locationList.join(', ')}
              </p>
            </div>
          )}

          {!isSpy && card.showRoleBlock && card.myCivilianRole && (
            <button
              type="button"
              className="gameplay__peek-block"
              style={{ marginTop: 14 }}
              onClick={() => setRolePeekVisible((v) => !v)}
              aria-label={rolePeekVisible ? 'Скрыть роль' : 'Показать роль'}
            >
              <span className="gameplay__peek-block__label">Ваша роль</span>
              {rolePeekVisible ? (
                <span className="gameplay__peek-block__word" style={{ fontSize: 'clamp(20px,4.5vw,28px)' }}>
                  {card.myCivilianRole}
                </span>
              ) : (
                <span className="gameplay__peek-block__hidden">Роль скрыта — нажмите, чтобы показать</span>
              )}
            </button>
          )}

          <div className="spy-round__hint-block">
            <p style={{ margin: 0, fontWeight: 800, fontSize: 13, opacity: 0.95 }}>Подсказки</p>
            <p style={{ margin: '6px 0 0', fontSize: 13, opacity: 0.88, lineHeight: 1.35 }}>
              Обсуждайте вслух. В голосовании выберите подозреваемого. Шпион называет слово вслух — остальные решают, верно ли.
            </p>
            {!isSpy && !card.showRoleBlock && Array.isArray(card.roleHints) && card.roleHints.length > 0 && (
              <p style={{ margin: '6px 0 0', fontSize: 13, opacity: 0.88, lineHeight: 1.35 }}>
                Возможные роли: {card.roleHints.join(', ')}
              </p>
            )}
          </div>
        </div>

        {guessPollActive && (
          <div className="gpl__panel" style={{ marginTop: 12 }}>
            <p style={{ marginTop: 0, marginBottom: 8, fontSize: 14, fontWeight: 700 }}>Проверка устной догадки</p>
            <p style={{ margin: '0 0 10px', fontSize: 13, opacity: 0.9, lineHeight: 1.4 }}>
              Шпион назвал слово вслух. Выберите, совпало ли оно с вашим словом.
            </p>
            {card.guessPollCounts && (
              <p style={{ margin: '0 0 10px', fontSize: 12, opacity: 0.85 }}>
                Голоса: верно {card.guessPollCounts.correct} · неверно {card.guessPollCounts.wrong} · из {card.guessPollCounts.expected}
              </p>
            )}
            {isSpy && (
              <p style={{ margin: 0, fontSize: 13, opacity: 0.9 }}>Ждём голосов мирных игроков…</p>
            )}
            {canVoteGuessPoll && (
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  disabled={guessPollLock}
                  onClick={() => sendGuessPollVote('correct')}
                  style={{ ...btnStyle, flex: 1, background: '#6a5' }}
                >
                  Верно
                </button>
                <button
                  type="button"
                  disabled={guessPollLock}
                  onClick={() => sendGuessPollVote('wrong')}
                  style={{ ...btnStyle, flex: 1, background: '#844' }}
                >
                  Неверно
                </button>
              </div>
            )}
            {!isSpy && card.guessPollMyVote && (
              <p style={{ margin: '8px 0 0', fontSize: 13, opacity: 0.9 }}>
                Ваш голос: {card.guessPollMyVote === 'correct' ? 'верно' : 'неверно'}
              </p>
            )}
            {isHost && (
              <button
                type="button"
                onClick={endGuessPollEarly}
                style={{ ...btnStyle, marginTop: 10, background: '#555' }}
              >
                Завершить проверку (подсчёт по тем, кто проголосовал)
              </button>
            )}
          </div>
        )}

        {canStartGuessPoll && (
          <button
            type="button"
            onClick={startGuessPoll}
            disabled={guessPollLock}
            style={{ ...btnStyle, marginTop: 12, background: '#5a7ab5', opacity: guessPollLock ? 0.7 : 1 }}
          >
            Я назвал(а) слово вслух — начать голосование «верно / неверно»
          </button>
        )}

        {!votingActive && !voteResult && (
          <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button
              type="button"
              onClick={() => startVote()}
              disabled={startVoteLock || guessPollActive}
              style={{
                ...btnStyle,
                background: 'var(--gpl-accent, #f5d547)',
                color: 'var(--gpl-accent-text, #1a1300)',
                opacity: startVoteLock ? 0.75 : 1,
                cursor: guessPollActive ? 'not-allowed' : 'pointer',
              }}
            >
              {startVoteLock ? '…' : 'Начать голосование'}
            </button>
          </div>
        )}

        {votingActive && (
          <div className="gpl__panel" style={{ marginTop: 24, textAlign: 'left' }}>
            <p style={{ marginBottom: 8 }}>Голосование: {formatTime(voteSecondsLeft)}</p>
            {isHost && (
              <button type="button" onClick={endVoteEarly} style={{ ...btnStyle, marginBottom: 12, background: '#85a' }}>
                Огласить результат
              </button>
            )}
            <p style={{ marginBottom: 8 }}>Кто шпион?</p>
            {votedForId ? (
              <p style={{ marginTop: 0, fontSize: 13, opacity: 0.9 }}>Голос принят. Можно дождаться окончания голосования.</p>
            ) : null}
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
    </GameplayScreen>
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
