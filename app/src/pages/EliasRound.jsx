import { useState, useEffect, useRef, useCallback } from 'react';
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
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import './eliasRound.css';

const DICT_LABELS = {
  basic: 'Базовый',
  animals: 'Животные',
  movies: 'Кино',
  science: 'Наука',
  sport: 'Спорт',
  elias_basic: 'Базовый',
  elias_animals: 'Животные',
  elias_movies: 'Кино',
  elias_science: 'Наука',
  elias_sport: 'Спорт',
};

function formatTime(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

function dictSubtitle(ids) {
  const list = Array.isArray(ids) && ids.length ? ids : ['basic'];
  return list.map((id) => DICT_LABELS[id] || id).join(', ');
}

/** Очки раунда для активной объясняющей команды (предпросмотр как на сервере) */
function explainingTeamRoundDelta(log, currentTeamIndex, skipPenalty) {
  const p = Math.min(3, Math.max(0, Number(skipPenalty) || 0));
  let d = 0;
  for (const e of log || []) {
    if (e.outcome === 'guessed') {
      if (e.lastWordBonus && typeof e.awardedToTeam === 'number') {
        if (e.awardedToTeam === currentTeamIndex) d += 1;
      } else if (!e.lastWordBonus) {
        d += 1;
      }
    } else if (e.outcome === 'skipped' && !e.lastWord) {
      if (p > 0) d -= p;
    }
  }
  return d;
}

function EliasSwipeCard({ word, subtitle, disabled, onYes, onNo }) {
  const start = useRef({ x: 0, y: 0 });
  const [drag, setDrag] = useState({ x: 0, y: 0 });
  const [hint, setHint] = useState(null);

  const reset = () => {
    setDrag({ x: 0, y: 0 });
    setHint(null);
  };

  const getPoint = (e) => {
    const t = e.touches?.[0];
    if (t) return { x: t.clientX, y: t.clientY };
    return { x: e.clientX, y: e.clientY };
  };

  const onDown = (e) => {
    if (disabled) return;
    const p = getPoint(e);
    start.current = p;
    setDrag({ x: 0, y: 0 });
    setHint(null);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch (_) {}
  };

  const onMove = (e) => {
    if (disabled) return;
    const p = getPoint(e);
    const dx = p.x - start.current.x;
    const dy = p.y - start.current.y;
    setDrag({ x: dx, y: dy });
    if (Math.abs(dx) > 28 || Math.abs(dy) > 28) {
      if (Math.abs(dx) >= Math.abs(dy)) {
        setHint(dx > 0 ? 'yes' : 'no');
      } else {
        setHint(dy < 0 ? 'yes' : 'no');
      }
    } else setHint(null);
  };

  const fireSwipe = useCallback(() => {
    const t = 48;
    const { x: dx, y: dy } = drag;
    reset();
    if (Math.abs(dx) < t && Math.abs(dy) < t) return;
    if (Math.abs(dx) >= Math.abs(dy)) {
      if (dx > t) onYes();
      else if (dx < -t) onNo();
    } else {
      if (dy < -t) onYes();
      else if (dy > t) onNo();
    }
  }, [drag, onYes, onNo]);

  const onUp = () => {
    if (disabled) return;
    fireSwipe();
  };

  const rot = Math.max(-12, Math.min(12, drag.x / 25));

  return (
    <div className="elias-round__card-wrap">
      <div className="elias-round__card-stack">
        <div className="elias-round__card-shadow" aria-hidden />
        <div
          className={`elias-round__card ${hint === 'yes' ? 'elias-round__card--hint-yes' : ''} ${hint === 'no' ? 'elias-round__card--hint-no' : ''}`}
          style={{
            '--dx': `${drag.x}px`,
            '--dy': `${drag.y}px`,
            '--rot': `${rot}deg`,
          }}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        >
          <p className="elias-round__word">{word}</p>
          {subtitle ? <p className="elias-round__sub">({subtitle})</p> : null}
        </div>
      </div>
    </div>
  );
}

export default function EliasRound({ roomId, user, room, onLeave }) {
  const navigate = useNavigate();
  useSeo({ robots: 'noindex, nofollow' });
  const myId = user?.id != null ? String(user.id) : '';
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false);
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [winnerTeamIndex, setWinnerTeamIndex] = useState(null);
  const [endedTeams, setEndedTeams] = useState(null);
  const [tick, setTick] = useState(0);
  const [editLog, setEditLog] = useState([]);
  const [finalizeBusy, setFinalizeBusy] = useState(false);
  const requestSeqRef = useRef(0);
  const timerEndedSentRef = useRef(false);
  const prevPhaseRef = useRef(null);

  const refreshState = useCallback(({ silent = false } = {}) => {
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
  }, [roomId, myId]);

  useEffect(() => refreshState(), [refreshState]);
  useEffect(() => {
    if (!myId || !state) return;
    api.post(`/rooms/${roomId}/ready`, { playerId: myId, game: 'elias' }).catch(() => {});
  }, [roomId, myId, state]);

  useEffect(() => {
    const onUpdate = () => refreshState({ silent: true });
    const onTimer = () => refreshState({ silent: true });
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
  }, [refreshState]);

  useEffect(() => {
    const onSock = () => refreshState({ silent: true });
    socket.onConnect(onSock);
    return () => socket.offConnect(onSock);
  }, [refreshState]);

  useEffect(() => {
    if (!state?.roundEndsAt && state?.roundPhase !== 'playing') return;
    const t = setInterval(() => setTick((n) => n + 1), 200);
    return () => clearInterval(t);
  }, [state?.roundEndsAt, state?.roundPhase]);

  useEffect(() => {
    const phase = state?.roundPhase;
    if (phase === 'playing') {
      timerEndedSentRef.current = false;
    }
    if (phase === 'review' && prevPhaseRef.current !== 'review') {
      setEditLog(JSON.parse(JSON.stringify(state?.roundLog || [])));
    }
    prevPhaseRef.current = phase || null;
  }, [state?.roundPhase, state?.roundLog]);

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

  const readyPreRound = async () => {
    try {
      await api.post(`/rooms/${roomId}/elias/ready-pre-round`, { playerId: myId });
      refreshState({ silent: true });
    } catch (_) {}
  };

  const requestExitGame = () => setExitConfirmOpen(true);

  const confirmExitGame = async () => {
    setExitConfirmOpen(false);
    try {
      await onLeave();
    } catch (_) {}
    navigate('/');
  };

  const exitModal = (
    <Modal
      open={exitConfirmOpen}
      onClose={() => setExitConfirmOpen(false)}
      closeOnOverlayClick
      title="Выйти из игры?"
      width={400}
    >
      <p style={{ marginTop: 0, lineHeight: 1.5, fontSize: 15, opacity: 0.95 }}>
        Вы покинете матч. Продолжить и перейти на главный экран?
      </p>
      <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
        <Button variant="secondary" fullWidth onClick={() => setExitConfirmOpen(false)}>
          Отмена
        </Button>
        <Button variant="danger" fullWidth onClick={confirmExitGame}>
          Выйти
        </Button>
      </div>
    </Modal>
  );

  const timerEnded = useCallback(async () => {
    try {
      await api.post(`/rooms/${roomId}/elias/timer-ended`, { playerId: myId });
      refreshState({ silent: true });
    } catch (_) {}
  }, [roomId, myId, refreshState]);

  const lastWordAssign = async (teamIndex) => {
    try {
      await api.post(`/rooms/${roomId}/elias/last-word-assign`, { playerId: myId, teamIndex });
      refreshState({ silent: true });
    } catch (_) {}
  };

  const finalizeRound = async () => {
    if (!editLog.length) return;
    setFinalizeBusy(true);
    try {
      await api.post(`/rooms/${roomId}/elias/finalize-round`, { playerId: myId, roundLog: editLog });
      refreshState({ silent: true });
    } catch (_) {
    } finally {
      setFinalizeBusy(false);
    }
  };

  const timeLeft = state?.roundEndsAt ? Math.max(0, state.roundEndsAt - Date.now()) : 0;
  const durationMs = (state?.timerSeconds || 60) * 1000;
  const timeFrac = state?.roundEndsAt ? Math.min(1, Math.max(0, timeLeft / durationMs)) : 0;

  useEffect(() => {
    if (!state || state.roundPhase !== 'playing' || !state.roundEndsAt) return;
    if (timeLeft > 500) return;
    if (timerEndedSentRef.current) return;
    timerEndedSentRef.current = true;
    timerEnded();
  }, [state, timeLeft, timerEnded]);

  if (loading) {
    return (
      <>
        <GameplayScreen theme="elias" user={user} onBack={requestExitGame} backTitle="Назад" title="Элиас">
          <Loader label="Загрузка Элиаса..." minHeight="50vh" />
        </GameplayScreen>
        {exitModal}
      </>
    );
  }
  if (!state) {
    return (
      <>
        <GameplayScreen theme="elias" user={user} onBack={requestExitGame} backTitle="Назад" title="Элиас">
          <ErrorState title="Нет данных" message="Состояние игры не загружено." actionLabel="В лобби" onAction={() => navigate('/lobby')} />
        </GameplayScreen>
        {exitModal}
      </>
    );
  }

  const awaitingStart = Boolean(state.awaitingExplainerStart);
  const phase = state.roundPhase || null;
  const teams = endedTeams || state.teams || [];
  const winner = state.winner != null ? state.winner : winnerTeamIndex;
  const explainingTeamIndex = state.currentTeamIndex ?? 0;
  const explainingTeamName = teams[explainingTeamIndex]?.name || 'Команда';
  const myTeamIndex = typeof state.myTeamIndex === 'number' ? state.myTeamIndex : -1;
  const myTeamName =
    myTeamIndex >= 0 && teams[myTeamIndex] ? teams[myTeamIndex].name : null;
  const roundPtsPreview = explainingTeamRoundDelta(editLog.length ? editLog : state.roundLog, explainingTeamIndex, state.skipPenalty);
  const canPlayActions =
    state.isCurrentExplainer && phase === 'playing' && !awaitingStart && Boolean(state.word);
  /** Подпись со словарями — только у текущего объясняющего */
  const dictSub = state.isCurrentExplainer ? `(Все наборы: ${dictSubtitle(state.dictionaryIds)})` : null;

  const readyIds = Array.isArray(state.preRoundReadyIds) ? state.preRoundReadyIds : [];
  const mPlayers = Math.max(
    Array.isArray(room?.players) ? room.players.length : 0,
    Number(state.roomPlayersCount) || 0,
    readyIds.length,
  );
  const nReady = readyIds.length;
  const imPreRoundReady = Boolean(myId && readyIds.some((id) => String(id) === myId));

  const updateRowOutcome = (index, outcome) => {
    setEditLog((prev) => {
      const next = [...prev];
      const row = { ...next[index] };
      if (outcome === 'guessed') {
        row.outcome = 'guessed';
        if (row.lastWordBonus) {
          if (typeof row.awardedToTeam !== 'number') {
            row.awardedToTeam = explainingTeamIndex;
          }
        } else {
          delete row.awardedToTeam;
          delete row.lastWordBonus;
        }
        delete row.lastWord;
      } else {
        row.outcome = 'skipped';
        if (row.lastWordBonus) {
          row.lastWord = true;
          delete row.awardedToTeam;
          delete row.lastWordBonus;
        }
      }
      next[index] = row;
      return next;
    });
  };

  if (winner != null) {
    const winTeam = teams[winner];
    return (
      <>
        <PostMatchScreen
          theme="elias"
          top={<BackArrow onClick={requestExitGame} title="Назад" />}
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
            <p style={{ marginBottom: 16 }}>Счёт: {teams.map((t) => `${t.name} ${t.score}`).join(' — ')}</p>
            {state?.mvp && (
              <p style={{ marginBottom: 0, opacity: 0.9 }}>
                MVP: {state.mvp.name} (угадано {state.mvp.guessed}, пропусков {state.mvp.skipped})
              </p>
            )}
          </div>
        </PostMatchScreen>
        {exitModal}
      </>
    );
  }

  return (
    <>
      <GameplayScreen theme="elias" user={user} onBack={requestExitGame} backTitle="Назад" title="Элиас">
        <GameLayout top={null} center={false} padding={0} minHeight="calc(100dvh - 100px)" textAlign="center" bottom={null}>
        <div className="elias-round">
          <div className="elias-round__meta-card gpl__panel">
            <p className="elias-round__meta-card-kicker">Текущий раунд</p>
            <p className="elias-round__meta-card-main">
              Сейчас объясняет: <strong>{state.explainerName}</strong>
              {state.isCurrentExplainer ? (
                <span className="elias-round__meta-you-badge"> — это вы</span>
              ) : null}
            </p>
            <p className="elias-round__meta-card-sub">Ход команды «{explainingTeamName}»</p>
            <p className="elias-round__meta-card-role">
              {state.isCurrentExplainer
                ? 'Вы показываете слова команде (свайп да/нет).'
                : state.isExplainer
                  ? 'Вы отгадываете по подсказкам — слово на экране только у объясняющего.'
                  : 'Вы в другой команде; слово видят только соперники в ходе их раунда.'}
            </p>
            {myTeamName ? (
              <div className="elias-round__meta-pill">
                <span className="elias-round__meta-pill-label">Ваша команда</span>
                <span className="elias-round__meta-pill-value">{myTeamName}</span>
              </div>
            ) : null}
          </div>

          {phase === 'review' ? (
            <div className="elias-round__review">
              <div className="elias-round__review-head">{explainingTeamName}</div>
              <div className="elias-round__review-list">
                {(editLog.length ? editLog : state.roundLog || []).map((entry, i) => (
                  <div key={`${entry.word}-${i}`} className="elias-round__review-row">
                    <span className="elias-round__review-word">
                      {entry.word}
                      {entry.lastWordBonus && typeof entry.awardedToTeam === 'number' ? (
                        <span style={{ fontWeight: 500, fontSize: 12, color: '#718096' }}>
                          {' '}
                          (бонус → {teams[entry.awardedToTeam]?.name || `№${entry.awardedToTeam + 1}`})
                        </span>
                      ) : null}
                    </span>
                    {state.isCurrentExplainer ? (
                      <div className="elias-round__review-toggles">
                        <button
                          type="button"
                          className={`elias-round__toggle elias-round__toggle--no ${entry.outcome === 'skipped' ? 'is-on' : ''}`}
                          onClick={() => updateRowOutcome(i, 'skipped')}
                          aria-label="Не отгадано"
                        >
                          👎
                        </button>
                        <button
                          type="button"
                          className={`elias-round__toggle elias-round__toggle--yes ${entry.outcome === 'guessed' ? 'is-on' : ''}`}
                          onClick={() => updateRowOutcome(i, 'guessed')}
                          aria-label="Отгадано"
                        >
                          👍
                        </button>
                      </div>
                    ) : (
                      <span style={{ fontSize: 13, color: '#718096' }}>
                        {entry.outcome === 'guessed' ? '✓' : '✗'}
                      </span>
                    )}
                  </div>
                ))}
              </div>
              <div className="elias-round__review-footer">
                <div className="elias-round__points-bar">
                  <span>Набрано очков (ваша команда)</span>
                  <span>{roundPtsPreview}</span>
                </div>
                {state.isCurrentExplainer ? (
                  <button
                    type="button"
                    className="elias-round__start-btn"
                    disabled={finalizeBusy || !editLog.length}
                    onClick={finalizeRound}
                  >
                    Дальше
                  </button>
                ) : (
                  <p className="elias-round__review-wait-msg">
                    Ожидайте: диктор подтверждает раунд
                  </p>
                )}
              </div>
            </div>
          ) : (
            <>
              {!awaitingStart ? (
                <div className="elias-round__hud" title="Таймер и очки за раунд">
                  <div className="elias-round__hud-glass">
                    <div className="elias-round__timer-wrap">
                      {phase === 'playing' && state.roundEndsAt ? (
                        <div
                          className="elias-round__timer-ring elias-round__timer-ring--progress"
                          style={{ '--elias-timer-frac': timeFrac }}
                        >
                          <div className="elias-round__timer-inner">{formatTime(timeLeft)}</div>
                        </div>
                      ) : (
                        <div className="elias-round__timer-ring elias-round__timer-ring--idle">
                          <div className="elias-round__timer-inner">—</div>
                        </div>
                      )}
                    </div>
                    <div className="elias-round__hud-divider" aria-hidden />
                    <div className="elias-round__score-block">
                      <span className="elias-round__score-label">Счёт</span>
                      <span className="elias-round__score-num">
                        {state.roundStartScores && teams[explainingTeamIndex]
                          ? (teams[explainingTeamIndex].score ?? 0) - (state.roundStartScores[explainingTeamIndex] ?? 0)
                          : 0}
                      </span>
                    </div>
                  </div>
                </div>
              ) : null}

              <Modal
                open={awaitingStart}
                onClose={() => {}}
                closeOnOverlayClick={false}
                title="Подготовка к раунду"
                width={400}
                className="elias-round__ready-modal-overlay"
              >
                <div className="elias-round__ready-modal-body">
                  {!imPreRoundReady ? (
                    <>
                      <p className="elias-round__ready-modal-text">
                        Раунд начнётся, когда все игроки в комнате нажмут «Готов». Слово и таймер появятся у текущего объясняющего (
                        <strong>{state.explainerName}</strong>).
                      </p>
                      <button type="button" className="elias-round__start-btn" onClick={readyPreRound}>
                        Готов
                      </button>
                    </>
                  ) : (
                    <p className="elias-round__ready-modal-text elias-round__ready-modal-text--solo">
                      {nReady >= mPlayers && mPlayers > 0
                        ? 'Все готовы — стартуем…'
                        : `В ожидании игроков: ${nReady} из ${Math.max(mPlayers, 1)} готовы. Ожидаем ещё ${Math.max(0, mPlayers - nReady)}.`}
                    </p>
                  )}
                </div>
              </Modal>

              {phase === 'last_word' && state.word && (
                <div className="gpl__panel" style={{ marginBottom: 12 }}>
                  <p className="elias-round__last-word-title">Кто отгадал последнее слово?</p>
                  <div className="elias-round__card-wrap">
                    <div className="elias-round__card-stack">
                      <div className="elias-round__card-shadow" aria-hidden />
                      <div className="elias-round__card" style={{ transform: 'none' }}>
                        <p className="elias-round__word">{state.word}</p>
                        {dictSub ? <p className="elias-round__sub">({dictSub})</p> : null}
                      </div>
                    </div>
                  </div>
                  {state.isCurrentExplainer ? (
                    <div className="elias-round__team-grid" style={{ marginTop: 12 }}>
                      {teams.map((t, i) => (
                        <button
                          key={i}
                          type="button"
                          className="elias-round__team-btn"
                          onClick={() => lastWordAssign(i)}
                        >
                          {t.name}
                        </button>
                      ))}
                      <button type="button" className="elias-round__team-btn elias-round__team-btn--muted" onClick={() => lastWordAssign(-1)}>
                        Никто
                      </button>
                    </div>
                  ) : (
                    <p className="elias-round__phase-card-hint" style={{ marginTop: 16, marginBottom: 0, textAlign: 'center' }}>
                      Последнее слово отмечает только объясняющий ({state.explainerName}).
                    </p>
                  )}
                </div>
              )}

              {phase === 'playing' && !awaitingStart && state.word && state.isCurrentExplainer && (
                <div className="elias-round__play-column">
                  <EliasSwipeCard
                    word={state.word}
                    subtitle={dictSub}
                    disabled={!canPlayActions}
                    onYes={guessed}
                    onNo={skip}
                  />
                  <div className="elias-round__actions-shell">
                    <div className="elias-round__actions">
                      <button type="button" className="elias-round__btn-skip" onClick={skip} disabled={!canPlayActions} aria-label="Нет">
                        ✕
                      </button>
                      <button type="button" className="elias-round__btn-yes" onClick={guessed} disabled={!canPlayActions} aria-label="Да">
                        ✓
                      </button>
                    </div>
                    <p className="elias-round__hint">Свайп влево/вниз — нет · вправо/вверх — да</p>
                  </div>
                </div>
              )}

              {phase === 'playing' && !awaitingStart && state.word && state.isExplainer && !state.isCurrentExplainer && (
                <div className="elias-round__phase-stack">
                  <div className="gpl__panel elias-round__phase-card elias-round__phase-card--wait">
                    <p className="elias-round__phase-card-kicker">Ваша команда ходит</p>
                    <p className="elias-round__phase-card-text">
                      Сейчас объясняет <strong>{state.explainerName}</strong>. Слово и кнопки «да/нет» видны только ему — слушайте подсказки и отгадывайте вслух.
                    </p>
                  </div>
                </div>
              )}

              {phase === 'playing' && !awaitingStart && !state.isExplainer && (
                <div className="elias-round__phase-stack">
                  <div className="gpl__panel elias-round__phase-card elias-round__phase-card--spectator">
                    <p className="elias-round__phase-card-kicker">Идёт раунд</p>
                    <p className="elias-round__phase-card-text">
                      Команда «{explainingTeamName}» объясняет слово.
                    </p>
                    <p className="elias-round__phase-card-hint">Слово видно только объясняющей команде.</p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </GameLayout>
    </GameplayScreen>
    {exitModal}
    </>
  );
}
