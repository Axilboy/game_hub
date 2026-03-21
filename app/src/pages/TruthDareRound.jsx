import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { socket } from '../socket';
import BackArrow from '../components/BackArrow';
import useSeo from '../hooks/useSeo';
import GameLayout from '../components/game/GameLayout';
import Loader from '../components/ui/Loader';
import ErrorState from '../components/ui/ErrorState';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { track } from '../analytics';
import { getInventory } from '../inventory';

function formatTime(sec) {
  const s = Math.max(0, Math.ceil(sec));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${rem.toString().padStart(2, '0')}`;
}

export default function TruthDareRound({ roomId, user, room, onLeave }) {
  const navigate = useNavigate();
  useSeo({ robots: 'noindex, nofollow' });

  const myId = user?.id != null ? String(user.id) : '';
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null); // 'done' | 'skip'
  const [cardActionLoading, setCardActionLoading] = useState(null); // 'like' | 'favorite' | 'report'
  const [ageConfirmLoading, setAgeConfirmLoading] = useState(false);
  const [ageGateDismissed, setAgeGateDismissed] = useState(false);
  const [softPaywallDismissed, setSoftPaywallDismissed] = useState(false);
  const [tick, setTick] = useState(0);
  const requestSeqRef = useRef(0);
  const [moderationRows, setModerationRows] = useState([]);
  const isHost = room?.hostId === myId;

  const refreshState = ({ silent = false } = {}) => {
    if (!roomId || !myId) return;
    const reqId = ++requestSeqRef.current;
    if (!silent) setLoading(true);
    api
      .get(`/rooms/${roomId}/truth_dare/state?playerId=${encodeURIComponent(myId)}`)
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
    socket.on('truth_dare_update', onUpdate);
    socket.on('game_ended', onUpdate);
    return () => {
      socket.off('truth_dare_update', onUpdate);
      socket.off('game_ended', onUpdate);
    };
  }, [roomId, myId]);

  useEffect(() => {
    const onSock = () => refreshState({ silent: true });
    socket.onConnect(onSock);
    return () => socket.offConnect(onSock);
  }, [roomId, myId]);

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!state?.show18Plus) setAgeGateDismissed(false);
    if (state?.isAdultConfirmed) setAgeGateDismissed(false);
  }, [state?.show18Plus, state?.isAdultConfirmed]);

  const confirm18Plus = async () => {
    if (ageConfirmLoading) return;
    if (!roomId || !myId) return;
    try {
      setAgeConfirmLoading(true);
      await api.post(`/rooms/${roomId}/truth_dare/confirm-18plus`, { playerId: myId });
      refreshState({ silent: true });
    } catch (_) {
      // ignore
    } finally {
      setAgeConfirmLoading(false);
    }
  };

  const leaveToLobby = async () => {
    try {
      await onLeave?.();
    } catch (_) {}
    navigate('/lobby');
  };

  const submitTurn = async (action, choice) => {
    if (actionLoading) return;
    if (!state?.turnToken) return;
    if (!state?.isMyTurn) return;
    if (action === 'done' && choice !== 'truth' && choice !== 'dare') return;
    try {
      setActionLoading(action === 'done' ? `done_${choice}` : action);
      const body = { playerId: myId, action, turnToken: state.turnToken };
      if (action === 'done') body.choice = choice;
      await api.post(`/rooms/${roomId}/truth_dare/turn`, body);
      track('truth_dare_turn_action', { action, choice: choice || null, category: state.currentCard?.categorySlug || 'unknown' });
      // server will advance via socket; refresh as backup.
      refreshState({ silent: true });
    } catch (_) {
      // ignore; user can press again if timer still active (server is idempotent by turnToken)
    } finally {
      setActionLoading(null);
    }
  };

  const reactToCard = async (type) => {
    if (!roomId || !myId || !state?.currentCard?.id || cardActionLoading) return;
    try {
      setCardActionLoading(type);
      if (type === 'report') {
        await api.post(`/rooms/${roomId}/truth_dare/report`, {
          playerId: myId,
          cardId: state.currentCard.id,
          reason: 'user_feedback',
        });
      } else {
        await api.post(`/rooms/${roomId}/truth_dare/react`, {
          playerId: myId,
          cardId: state.currentCard.id,
          like: type === 'like',
          favorite: type === 'favorite',
        });
      }
      track('truth_dare_card_feedback', { type, category: state.currentCard?.categorySlug || 'unknown' });
      refreshState({ silent: true });
    } catch (_) {
      // ignore
    } finally {
      setCardActionLoading(null);
    }
  };

  const loadModeration = async () => {
    if (!isHost || !roomId || !myId) return;
    try {
      const r = await api.get(`/rooms/${roomId}/truth_dare/moderation?playerId=${encodeURIComponent(myId)}`);
      setModerationRows(Array.isArray(r?.rows) ? r.rows : []);
    } catch (_) {
      // ignore
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 24 }}>
        <Loader label="Загрузка Правды/Действия..." minHeight="50vh" />
      </div>
    );
  }
  if (!state) {
    return (
      <div style={{ padding: 24 }}>
        <ErrorState title="Нет данных" message="Состояние игры не загружено." actionLabel="В лобби" onAction={leaveToLobby} />
      </div>
    );
  }

  const card = state.currentCard;
  const timeLeft = state.turnEndsAt ? Math.max(0, Math.ceil((state.turnEndsAt - Date.now()) / 1000)) : null;
  const ageGateOpen = Boolean(state.show18Plus) && !state.isAdultConfirmed && !ageGateDismissed;
  const myStats = state.playerStats?.[myId] || { done: 0, skip: 0, timeout: 0 };
  const inv = getInventory();
  const hasPremiumAccess = Boolean(inv?.hasPro) || (Array.isArray(inv?.unlockedItems) && inv.unlockedItems.some((id) => String(id).startsWith('td_')));
  const softPaywallOpen = !hasPremiumAccess && !softPaywallDismissed && (Number(state?.roundIndex) || 0) >= 2;

  return (
    <>
      <GameLayout
        top={<BackArrow onClick={leaveToLobby} title="В лобби" />}
        center={false}
        padding={24}
        bottom={
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Button variant="ghost" fullWidth onClick={leaveToLobby} style={{ background: '#444' }}>
              В лобби
            </Button>
          </div>
        }
      >
        <div className="gh-card" style={{ padding: 16, marginBottom: 12 }}>
          <p style={{ margin: 0, opacity: 0.9, fontSize: 14 }}>
            Раунд: {state.roundIndex + 1}/{state.roundsCount || '?'}
          </p>
          <p style={{ margin: '8px 0 0', opacity: 0.9, fontSize: 14 }}>
            Ход игрока: <strong>{state.currentPlayerName || '—'}</strong>
          </p>
          {timeLeft != null && (
            <p style={{ margin: '8px 0 0', opacity: 0.85, fontSize: 14 }}>
              Таймер: {formatTime(timeLeft)}
            </p>
          )}
          {state.skipLimitPerPlayer != null && (
            <p style={{ margin: '8px 0 0', opacity: 0.85, fontSize: 14 }}>
              Пропуски: {state.skipsUsed ?? 0}/{state.skipLimitPerPlayer}
            </p>
          )}
        </div>

        <div className="gh-card" style={{ padding: 16 }}>
          <p style={{ margin: 0, opacity: 0.9, fontSize: 14 }}>
            На карточке два варианта — выбери, что выполняешь: <strong>правда</strong> или <strong>действие</strong>.
          </p>
          <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <p style={{ margin: 0, fontSize: 12, opacity: 0.85, textTransform: 'uppercase', letterSpacing: 0.5 }}>Правда</p>
              <p style={{ margin: '6px 0 0', fontSize: 18, fontWeight: 700, lineHeight: 1.35 }}>
                {card?.truth || card?.text || 'Ожидаем карточку...'}
              </p>
            </div>
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.12)', paddingTop: 12 }}>
              <p style={{ margin: 0, fontSize: 12, opacity: 0.85, textTransform: 'uppercase', letterSpacing: 0.5 }}>Действие</p>
              <p style={{ margin: '6px 0 0', fontSize: 18, fontWeight: 700, lineHeight: 1.35 }}>
                {card?.dare || '—'}
              </p>
            </div>
          </div>
          <p style={{ margin: '10px 0 0', fontSize: 12, opacity: 0.85 }}>
            Категория: {card?.categorySlug || '—'}
          </p>
          <p style={{ margin: '6px 0 0', fontSize: 12, opacity: 0.82 }}>
            👍 {state.currentCardLikes || 0} · 🚩 {state.currentCardReports || 0}
          </p>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <Button variant="secondary" onClick={() => reactToCard('like')} disabled={cardActionLoading === 'like'} style={{ background: '#444', padding: '8px 10px' }}>
              Лайк
            </Button>
            <Button variant="secondary" onClick={() => reactToCard('favorite')} disabled={cardActionLoading === 'favorite'} style={{ background: '#444', padding: '8px 10px' }}>
              В избранное
            </Button>
            <Button variant="ghost" onClick={() => reactToCard('report')} disabled={cardActionLoading === 'report'} style={{ background: '#5a3434', padding: '8px 10px' }}>
              Пожаловаться
            </Button>
          </div>
        </div>

        {state.isMyTurn && (
          <div className="gh-card" style={{ padding: 16, marginTop: 12 }}>
            <p style={{ margin: '0 0 10px', opacity: 0.9, fontSize: 14 }}>
              Ваш ход — отметь, что ты выполнил(а): <strong>правду</strong> или <strong>действие</strong> с карточки.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', gap: 10 }}>
                <Button
                  variant="primary"
                  fullWidth
                  disabled={!!actionLoading}
                  onClick={() => submitTurn('done', 'truth')}
                  style={{ flex: 1, background: '#4a7ab5' }}
                >
                  {actionLoading === 'done_truth' ? '...' : 'Сделал(а) правду'}
                </Button>
                <Button
                  variant="primary"
                  fullWidth
                  disabled={!!actionLoading}
                  onClick={() => submitTurn('done', 'dare')}
                  style={{ flex: 1, background: '#6a5' }}
                >
                  {actionLoading === 'done_dare' ? '...' : 'Сделал(а) действие'}
                </Button>
              </div>
              <Button
                variant="secondary"
                fullWidth
                disabled={actionLoading === 'skip'}
                onClick={() => submitTurn('skip')}
                style={{ background: '#444' }}
              >
                {actionLoading === 'skip' ? 'Пропускаем...' : 'Пропустить карточку'}
              </Button>
            </div>
          </div>
        )}
        {!state.isMyTurn && (
          <div style={{ marginTop: 12, opacity: 0.85, fontSize: 14, textAlign: 'center' }}>
            Ожидайте: ход игрока обновится автоматически.
          </div>
        )}

        <div className="gh-card" style={{ padding: 16, marginTop: 12 }}>
          <p style={{ margin: '0 0 8px', opacity: 0.9, fontSize: 14 }}>Ваши действия</p>
          <p style={{ margin: 0, fontSize: 13, opacity: 0.9 }}>
            Выполнено: <strong>{myStats.done || 0}</strong> (правда {myStats.truth ?? 0} / действие {myStats.dare ?? 0}) · Пропуски:{' '}
            <strong>{myStats.skip || 0}</strong> · Таймауты: <strong>{myStats.timeout || 0}</strong>
          </p>
          {(state.turnHistory || []).length > 0 && (
            <div style={{ marginTop: 10 }}>
              <p style={{ margin: '0 0 6px', fontSize: 12, opacity: 0.8 }}>Последние ходы</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {(state.turnHistory || []).slice(-5).map((x) => (
                  <div key={`${x.token}-${x.at}`} style={{ fontSize: 12, opacity: 0.88 }}>
                    {x.playerName}:{' '}
                    {x.action === 'done' && x.choice ? `готово (${x.choice === 'truth' ? 'правда' : 'действие'})` : x.action}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        {isHost && (
          <div className="gh-card" style={{ padding: 16, marginTop: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
              <p style={{ margin: 0, opacity: 0.9, fontSize: 14 }}>Модерация карточек</p>
              <Button variant="secondary" onClick={loadModeration} style={{ background: '#444', padding: '8px 10px' }}>
                Обновить
              </Button>
            </div>
            {moderationRows.length > 0 ? (
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {moderationRows.slice(0, 5).map((row) => (
                  <div key={row.cardId} style={{ fontSize: 12, opacity: 0.9 }}>
                    [{row.categorySlug}] 🚩 {row.reports} · 👍 {row.likes} — {row.text}
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ margin: '10px 0 0', fontSize: 12, opacity: 0.8 }}>Жалоб пока нет.</p>
            )}
          </div>
        )}
      </GameLayout>

      {ageGateOpen && (
        <Modal
          open={ageGateOpen}
          onClose={() => setAgeGateDismissed(true)}
          title="18+ контент"
          width={420}
        >
          <p style={{ marginTop: 0, marginBottom: 16, opacity: 0.92, lineHeight: 1.5 }}>
            В игре включены 18+ карточки. Подтвердите, что вам исполнилось 18 лет, чтобы получать 18+ контент.
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <Button
              variant="primary"
              fullWidth
              disabled={ageConfirmLoading}
              onClick={confirm18Plus}
              style={{ flex: 1, background: '#6a5' }}
            >
              Мне 18+
            </Button>
            <Button
              variant="secondary"
              fullWidth
              disabled={ageConfirmLoading}
              onClick={() => setAgeGateDismissed(true)}
              style={{ flex: 1, background: '#444' }}
            >
              Пропустить
            </Button>
          </div>
        </Modal>
      )}
      {softPaywallOpen && (
        <Modal
          open={softPaywallOpen}
          onClose={() => setSoftPaywallDismissed(true)}
          title="Открыть премиум-категории?"
          width={420}
        >
          <p style={{ marginTop: 0, marginBottom: 14, opacity: 0.9, lineHeight: 1.45 }}>
            Вы прошли несколько раундов. Откройте Party/18+/Romance паки для более смелых карточек.
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <Button
              variant="primary"
              fullWidth
              onClick={() => {
                track('truth_dare_soft_paywall_click', { source: 'round', step: state?.roundIndex || 0 });
                setSoftPaywallDismissed(true);
                navigate('/');
              }}
              style={{ flex: 1, background: '#6a5' }}
            >
              Открыть оффер
            </Button>
            <Button variant="secondary" fullWidth onClick={() => setSoftPaywallDismissed(true)} style={{ flex: 1, background: '#444' }}>
              Позже
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}

