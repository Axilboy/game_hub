import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { socket } from '../socket';
import BackArrow from '../components/BackArrow';
import useSeo from '../hooks/useSeo';
import GameLayout from '../components/game/GameLayout';
import GameplayScreen from '../components/game/GameplayScreen';
import Loader from '../components/ui/Loader';
import ErrorState from '../components/ui/ErrorState';
import Button from '../components/ui/Button';
import PostMatchScreen from '../components/game/PostMatchScreen';
import { track } from '../analytics';

/** Порядок вывода полей на карточке (база + премиум) */
const BUNKER_FIELD_ORDER = [
  'profession',
  'skill',
  'phobia',
  'baggage',
  'gender',
  'age',
  'disease',
  'body',
  'hobby',
  'secret',
];

function orderedKeysForCharacter(ch) {
  if (!ch || typeof ch !== 'object') return [];
  return BUNKER_FIELD_ORDER.filter((k) => ch[k] != null && ch[k] !== '');
}

function phaseTitle(phase) {
  if (phase === 'intro') return 'Ознакомление';
  if (phase === 'reveals') return 'Раскрытия по очереди';
  if (phase === 'discussion') return 'Обсуждение';
  if (phase === 'voting') return 'Голосование';
  if (phase === 'tie_break') return 'Тай-брейк';
  if (phase === 'round_event') return 'Событие раунда';
  if (phase === 'final') return 'Финал';
  return 'Бункер';
}

function eliminationReason(by) {
  if (by === 'vote') return 'Голосование';
  if (by === 'tie_break') return 'Тай-брейк';
  return 'Исключение';
}

export default function BunkerRound({ roomId, user, room, onLeave }) {
  const navigate = useNavigate();
  useSeo({ robots: 'noindex, nofollow' });

  const myId = user?.id != null ? String(user.id) : '';
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null); // 'vote' | 'reveal'
  const [selectedRevealField, setSelectedRevealField] = useState(null);
  const maxRounds = state && typeof state.maxRounds === 'number' ? state.maxRounds : null;
  const [, setTick] = useState(0);
  const requestSeqRef = useRef(0);
  const phaseTrackRef = useRef('');

  const refreshState = ({ silent = false } = {}) => {
    if (!roomId || !myId) return;
    const reqId = ++requestSeqRef.current;
    if (!silent) setLoading(true);
    api
      .get(`/rooms/${roomId}/bunker/state?playerId=${encodeURIComponent(myId)}`)
      .then((s) => {
        if (reqId !== requestSeqRef.current) return;
        setState(s);
        if (!silent) setLoading(false);
      })
      .catch(() => {
        if (reqId !== requestSeqRef.current) return;
        if (!silent) setLoading(false);
      });
  };

  useEffect(() => {
    refreshState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, myId]);

  useEffect(() => {
    const onUpdate = () => refreshState({ silent: true });
    socket.on('bunker_update', onUpdate);
    socket.on('game_ended', onUpdate);
    return () => {
      socket.off('bunker_update', onUpdate);
      socket.off('game_ended', onUpdate);
    };
  }, [roomId, myId]);

  useEffect(() => {
    const onSock = () => refreshState({ silent: true });
    socket.onConnect(onSock);
    return () => socket.offConnect(onSock);
  }, [roomId, myId]);

  useEffect(() => {
    if (!state?.phaseEndsAt) return;
    const id = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(id);
  }, [state?.phaseEndsAt]);

  useEffect(() => {
    if (!state?.phase) return;
    const key = `${state.phase}:${state.roundIndex ?? 0}`;
    if (phaseTrackRef.current === key) return;
    phaseTrackRef.current = key;
    track('bunker_phase_change', { phase: state.phase, round: state.roundIndex ?? 0 });
  }, [state?.phase, state?.roundIndex]);

  const leaveToLobby = async () => {
    try {
      await onLeave?.();
    } catch (_) {}
    navigate('/lobby');
  };

  const exitToHome = () => {
    try {
      onLeave?.();
    } catch (_) {}
    navigate('/');
  };

  useEffect(() => {
    if (!state) return;
    const u = state.myUnrevealedFields || [];
    if (state.isMyRevealTurn && u.length) {
      setSelectedRevealField((prev) => (prev && u.includes(prev) ? prev : u[0]));
    }
  }, [state?.isMyRevealTurn, state?.myUnrevealedFields]);

  const revealField = async () => {
    if (actionLoading || !state?.isMyRevealTurn || !selectedRevealField) return;
    try {
      setActionLoading('reveal');
      await api.post(`/rooms/${roomId}/bunker/reveal`, { playerId: myId, fieldKey: selectedRevealField });
      refreshState({ silent: true });
    } catch (_) {
      // ignore
    } finally {
      setActionLoading(null);
    }
  };

  const vote = async (targetId) => {
    if (actionLoading) return;
    if (!state?.votes || !state?.phase) return;
    if (state.phase !== 'voting') return;
    if (!Array.isArray(state.alive) || !state.alive.some((p) => p.id === myId)) return;
    const already = state.votes?.[myId];
    if (already) return;
    try {
      setActionLoading('vote');
      await api.post(`/rooms/${roomId}/bunker/vote`, { playerId: myId, targetId });
      refreshState({ silent: true });
    } catch (_) {
      // ignore
    } finally {
      setActionLoading(null);
    }
  };

  const lrBunker = room?.lastGameResult?.game === 'bunker' ? room.lastGameResult : null;

  if (lrBunker && !state) {
    const winner = lrBunker.winnerName || '—';
    const crisesSeen = Array.isArray(lrBunker.crisisHistory) ? lrBunker.crisisHistory.length : 0;
    return (
      <PostMatchScreen
        theme="bunker"
        top={<BackArrow onClick={leaveToLobby} title="В лобби" />}
        center={false}
        padding={24}
        primaryLabel="В лобби"
        onPrimary={leaveToLobby}
        secondaryLabel="Выйти"
        onSecondary={exitToHome}
        secondaryBg="#333"
      >
        <div className="gpl__panel">
          <p style={{ fontSize: 22, margin: 0, marginBottom: 12, fontWeight: 800 }}>Бункер завершён</p>
          <p style={{ margin: 0, fontSize: 16, opacity: 0.92 }}>
            Победитель: <strong>{winner}</strong>
          </p>
          <p style={{ margin: '10px 0 0', fontSize: 13, opacity: 0.86 }}>
            Раундов сыграно: {lrBunker.roundIndex ?? 0} · Катастроф пережито: {crisesSeen}
          </p>
          {Array.isArray(lrBunker.crisisHistory) && lrBunker.crisisHistory.length > 0 && (
            <p style={{ margin: '8px 0 0', fontSize: 12, opacity: 0.8, lineHeight: 1.45 }}>
              Кризисы: {lrBunker.crisisHistory.map((c) => c.name).join(' · ')}
            </p>
          )}
        </div>
      </PostMatchScreen>
    );
  }

  if (loading) {
    return (
      <GameplayScreen theme="bunker" user={user} onBack={leaveToLobby} backTitle="В лобби" title="Бункер">
        <Loader label="Загрузка Бункера..." minHeight="50vh" />
      </GameplayScreen>
    );
  }

  if (!state) {
    return (
      <GameplayScreen theme="bunker" user={user} onBack={leaveToLobby} backTitle="В лобби" title="Бункер">
        <ErrorState title="Нет данных" message="Состояние Бункера не загружено." actionLabel="В лобби" onAction={leaveToLobby} />
      </GameplayScreen>
    );
  }

  if (state.phase === 'final') {
    const winner =
      Array.isArray(state.alive) && state.alive.length === 1
        ? state.alive[0]?.name || state.alive[0]?.id || '—'
        : '—';

    const survived = Array.isArray(state.alive) && state.alive.some((p) => p.id === myId);
    const crisesSeen = Array.isArray(state.crisisHistory) ? state.crisisHistory.length : 0;
    return (
      <PostMatchScreen
        theme="bunker"
        top={<BackArrow onClick={leaveToLobby} title="В лобби" />}
        center={false}
        padding={24}
        primaryLabel="В лобби"
        onPrimary={leaveToLobby}
        secondaryLabel="Выйти"
        onSecondary={exitToHome}
        secondaryBg="#333"
      >
        <div className="gpl__panel">
          <p style={{ fontSize: 22, margin: 0, marginBottom: 12, fontWeight: 800 }}>
            Бункер завершён
          </p>
          <p style={{ margin: 0, fontSize: 16, opacity: 0.92 }}>
            Победитель: <strong>{winner}</strong>
          </p>
          <p style={{ margin: '10px 0 0', fontSize: 14, opacity: 0.9 }}>
            Ваш итог: <strong>{survived ? 'Выжили' : 'Исключены'}</strong>
          </p>
          <p style={{ margin: '6px 0 0', fontSize: 13, opacity: 0.86 }}>
            Раундов сыграно: {state.roundIndex ?? 0} · Катастроф пережито: {crisesSeen}
          </p>
          {Array.isArray(state.crisisHistory) && state.crisisHistory.length > 0 && (
            <p style={{ margin: '8px 0 0', fontSize: 12, opacity: 0.8, lineHeight: 1.45 }}>
              Кризисы: {state.crisisHistory.map((c) => c.name).join(' · ')}
            </p>
          )}
        </div>
      </PostMatchScreen>
    );
  }

  const aliveIds = (state.alive || []).map((p) => p.id);
  const myAlive = aliveIds.some((id) => String(id) === String(myId));
  const myVote = state.votes?.[myId] || null;
  const playerNameById = (id) =>
    (state.alive || []).find((p) => String(p.id) === String(id))?.name || id;
  const fieldLabel = (key) => (state.fieldLabels && state.fieldLabels[key]) || key;

  return (
    <GameplayScreen theme="bunker" user={user} onBack={leaveToLobby} backTitle="В лобби" title="Бункер">
    <GameLayout
      top={null}
      center={false}
      padding={0}
      minHeight="auto"
      bottom={null}
    >
      <div className="gpl__panel">
        <p style={{ margin: 0, opacity: 0.9, fontSize: 14 }}>
          Фаза: <strong>{phaseTitle(state.phase)}</strong>
        </p>
        {state.phaseSecondsLeft != null && (
          <p style={{ margin: '8px 0 0', opacity: 0.85, fontSize: 14 }}>
            Таймер: {state.phaseEndsAt != null ? Math.max(0, Math.ceil((state.phaseEndsAt - Date.now()) / 1000)) : state.phaseSecondsLeft} сек
          </p>
        )}
        <p style={{ margin: '8px 0 0', opacity: 0.85, fontSize: 14 }}>
          Раунд: {(state.roundIndex ?? 0) + 1}
          {maxRounds != null ? `/${maxRounds}` : ''}
        </p>
        <p style={{ margin: '8px 0 0', opacity: 0.85, fontSize: 14 }}>
          Живые: <strong>{(state.alive || []).length}</strong>
        </p>
        {state.scenario?.name && (
          <p style={{ margin: '8px 0 0', opacity: 0.85, fontSize: 14 }}>
            Сценарий: <strong>{state.scenario.name}</strong>
          </p>
        )}
      </div>

      {(state.eliminatedLog || []).length ? (
        <div className="gpl__panel">
          <p style={{ margin: 0, opacity: 0.9, fontSize: 14 }}>Журнал исключений</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
            {(state.eliminatedLog || []).map((e) => (
              <div key={`${e.id}-${e.at || ''}`} style={{ padding: '10px 12px', borderRadius: 10, background: 'color-mix(in srgb, var(--gpl-panel-text) 8%, transparent)' }}>
                <div style={{ fontWeight: 700, marginBottom: 2 }}>{e.name}</div>
                <div style={{ fontSize: 12, opacity: 0.85 }}>{eliminationReason(e.by)}</div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="gpl__panel">
        <p style={{ margin: 0, opacity: 0.9, fontSize: 14 }}>Ваша карточка (видите только вы)</p>
        {state.myCharacter ? (
          <div style={{ marginTop: 10, lineHeight: 1.55, fontSize: 14, opacity: 0.95 }}>
            {orderedKeysForCharacter(state.myCharacter).map((key) => (
              <div key={key} style={{ marginBottom: 6 }}>
                {fieldLabel(key)}: <strong>{state.myCharacter[key]}</strong>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ marginTop: 10, opacity: 0.8 }}>—</p>
        )}

        {state.phase === 'reveals' && state.myCharacter && (
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid color-mix(in srgb, var(--gpl-panel-text) 15%, transparent)' }}>
            <p style={{ margin: 0, opacity: 0.88, fontSize: 13, lineHeight: 1.45 }}>
              Выберите, <strong>какую характеристику раскроете этим ходом</strong> (порядок на ваше усмотрение), затем нажмите «Раскрыть».
            </p>
            {state.isMyRevealTurn ? (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
                  {(state.myUnrevealedFields || []).map((key) => (
                    <label
                      key={key}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        cursor: 'pointer',
                        padding: '8px 10px',
                        borderRadius: 10,
                        background:
                          selectedRevealField === key
                            ? 'color-mix(in srgb, var(--gpl-panel-text) 14%, transparent)'
                            : 'color-mix(in srgb, var(--gpl-panel-text) 6%, transparent)',
                      }}
                    >
                      <input
                        type="radio"
                        name="bunker-reveal"
                        checked={selectedRevealField === key}
                        onChange={() => setSelectedRevealField(key)}
                      />
                      <span style={{ fontSize: 13 }}>
                        {fieldLabel(key)} — <strong>{state.myCharacter[key]}</strong>
                      </span>
                    </label>
                  ))}
                </div>
                {(state.myUnrevealedFields || []).length === 0 ? (
                  <p style={{ margin: '10px 0 0', fontSize: 13, opacity: 0.85 }}>Все ваши поля уже раскрыты, ждите остальных.</p>
                ) : (
                  <div style={{ marginTop: 14 }}>
                    <Button
                      variant="primary"
                      fullWidth
                      disabled={actionLoading === 'reveal' || !selectedRevealField}
                      onClick={revealField}
                      className="gameplay__btn"
                      style={{ borderRadius: 10 }}
                    >
                      Раскрыть
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <p style={{ margin: '12px 0 0', fontSize: 14, opacity: 0.9 }}>
                Сейчас ход: <strong>{playerNameById(state.revealTurnPlayerId)}</strong>
              </p>
            )}
          </div>
        )}
      </div>

      {state.phase === 'intro' && (
        <div className="gpl__panel">
          <p style={{ margin: 0, opacity: 0.9, fontSize: 14 }}>Скоро начнутся поочерёдные раскрытия. У каждого своя карточка.</p>
        </div>
      )}

      {(state.phase === 'reveals' ||
        state.phase === 'discussion' ||
        state.phase === 'voting' ||
        state.phase === 'round_event' ||
        state.phase === 'tie_break') &&
        state.publicRevealed && (
        <div className="gh-card" style={{ padding: 16, marginBottom: 12 }}>
          <p style={{ margin: 0, opacity: 0.9, fontSize: 14 }}>Игроки и раскрытые характеристики</p>
          <p style={{ margin: '8px 0 0', fontSize: 12, opacity: 0.78, lineHeight: 1.4 }}>
            Появляются по мере ходов. Скрытые строки не показываются, пока игрок сам их не откроет.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
            {(state.alive || []).map((p) => {
              const pr = state.publicRevealed[p.id] ?? state.publicRevealed[String(p.id)] ?? {};
              const stats = state.playerRevealStats?.[p.id] ?? state.playerRevealStats?.[String(p.id)];
              const revealedKeys = BUNKER_FIELD_ORDER.filter((k) => pr[k] != null && pr[k] !== '');
              return (
                <div
                  key={p.id}
                  style={{
                    padding: '12px 14px',
                    borderRadius: 10,
                    background: 'color-mix(in srgb, var(--gpl-panel-text) 8%, transparent)',
                  }}
                >
                  <div style={{ fontWeight: 800, marginBottom: 8, opacity: 0.96 }}>
                    {p.name}
                    {String(p.id) === String(myId) ? ' (вы)' : ''}
                  </div>
                  {revealedKeys.length === 0 ? (
                    <div style={{ fontSize: 13, opacity: 0.75 }}>Пока ничего не раскрыто</div>
                  ) : (
                    revealedKeys.map((k) => (
                      <div key={k} style={{ fontSize: 13, opacity: 0.92, lineHeight: 1.45, marginBottom: 4 }}>
                        {fieldLabel(k)}: <strong>{pr[k]}</strong>
                      </div>
                    ))
                  )}
                  {stats && stats.total > 0 && (
                    <div style={{ fontSize: 11, opacity: 0.65, marginTop: 6 }}>
                      Раскрыто: {stats.revealedCount}/{stats.total}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {state.phase === 'round_event' && (
        <div className="gpl__panel">
          <p style={{ margin: 0, opacity: 0.9, fontSize: 14 }}>Событие раунда</p>
          <p style={{ margin: '10px 0 0', fontSize: 18, fontWeight: 800 }}>{state.currentCrisis?.name || '—'}</p>
          <p style={{ margin: '8px 0 0', opacity: 0.85, fontSize: 14 }}>{state.currentCrisis?.description || ''}</p>
        </div>
      )}

      {state.phase === 'voting' && (
        <div className="gpl__panel">
          <p style={{ margin: 0, opacity: 0.9, fontSize: 14, marginBottom: 10 }}>Кого исключить?</p>
          {!myAlive ? (
            <p style={{ margin: 0, opacity: 0.85 }}>Вы уже выбыли.</p>
          ) : myVote ? (
            <p style={{ margin: 0, opacity: 0.85 }}>
              Голос учтён: <strong>{playerNameById(myVote)}</strong>
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(state.alive || [])
                .filter((p) => String(p.id) !== String(myId))
                .map((p) => (
                  <Button
                    key={p.id}
                    variant="secondary"
                    fullWidth
                    disabled={actionLoading === 'vote'}
                    onClick={() => vote(p.id)}
                    className="gameplay__btn gameplay__btn--secondary"
                    style={{ borderRadius: 10 }}
                  >
                    {p.name}
                  </Button>
                ))}
            </div>
          )}

          {state.voteCounts && Object.keys(state.voteCounts).length ? (
            <div style={{ marginTop: 14 }}>
              <p style={{ margin: 0, fontSize: 12, opacity: 0.8 }}>Текущий счёт</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                {Object.entries(state.voteCounts)
                  .sort((a, b) => (b[1] || 0) - (a[1] || 0))
                  .slice(0, 6)
                  .map(([targetId, count]) => (
                    <div key={targetId} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13, opacity: 0.92 }}>
                      <span>{playerNameById(targetId)}</span>
                      <strong>{count}</strong>
                    </div>
                  ))}
              </div>
            </div>
          ) : null}
        </div>
      )}

      {state.phase === 'tie_break' && (
        <div className="gpl__panel">
          <p style={{ margin: 0, opacity: 0.9, fontSize: 14 }}>Тай-брейк идёт...</p>
          {(state.tieCandidates || []).length ? (
            <div style={{ marginTop: 10 }}>
              <p style={{ margin: 0, opacity: 0.85, fontSize: 14 }}>Кандидаты:</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                {(state.tieCandidates || []).map((id) => (
                  <div key={id} style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.06)', opacity: 0.95 }}>
                    {playerNameById(id)}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p style={{ margin: '8px 0 0', opacity: 0.85, fontSize: 14 }}>Кандидаты: —</p>
          )}
        </div>
      )}
    </GameLayout>
    </GameplayScreen>
  );
}

