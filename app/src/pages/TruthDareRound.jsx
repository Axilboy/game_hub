import { useEffect, useState } from 'react';
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
  const [ageConfirmLoading, setAgeConfirmLoading] = useState(false);
  const [ageGateDismissed, setAgeGateDismissed] = useState(false);
  const [tick, setTick] = useState(0);

  const refreshState = () => {
    if (!roomId || !myId) return;
    setLoading(true);
    api
      .get(`/rooms/${roomId}/truth_dare/state?playerId=${encodeURIComponent(myId)}`)
      .then((s) => {
        setState(s);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    refreshState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, myId]);

  useEffect(() => {
    socket.on('truth_dare_update', refreshState);
    socket.on('game_ended', refreshState);
    return () => {
      socket.off('truth_dare_update', refreshState);
      socket.off('game_ended', refreshState);
    };
  }, [roomId, myId]);

  useEffect(() => {
    const onSock = () => refreshState();
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
      refreshState();
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

  const submitTurn = async (action) => {
    if (actionLoading) return;
    if (!state?.turnToken) return;
    if (!state?.isMyTurn) return;
    try {
      setActionLoading(action);
      await api.post(`/rooms/${roomId}/truth_dare/turn`, { playerId: myId, action, turnToken: state.turnToken });
      // server will advance via socket; refresh as backup.
      refreshState();
    } catch (_) {
      // ignore; user can press again if timer still active (server is idempotent by turnToken)
    } finally {
      setActionLoading(null);
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
        </div>

        <div className="gh-card" style={{ padding: 16 }}>
          <p style={{ margin: 0, opacity: 0.9, fontSize: 14 }}>
            Режим: <strong>{card?.type === 'truth' ? 'Правда' : card?.type === 'dare' ? 'Действие' : '—'}</strong>
          </p>
          <p style={{ margin: '12px 0 0', fontSize: 22, fontWeight: 800, lineHeight: 1.25 }}>
            {card?.text || 'Ожидаем карточку...'}
          </p>
          <p style={{ margin: '10px 0 0', fontSize: 12, opacity: 0.85 }}>
            Категория: {card?.categorySlug || '—'}
          </p>
        </div>

        {state.isMyTurn && (
          <div className="gh-card" style={{ padding: 16, marginTop: 12 }}>
            <p style={{ margin: '0 0 10px', opacity: 0.9, fontSize: 14 }}>Ваш ход</p>
            <div style={{ display: 'flex', gap: 12 }}>
              <Button
                variant="primary"
                fullWidth
                disabled={actionLoading === 'done'}
                onClick={() => submitTurn('done')}
                style={{ flex: 1, background: '#6a5' }}
              >
                {actionLoading === 'done' ? 'Отправляем...' : 'Выполнено'}
              </Button>
              <Button
                variant="secondary"
                fullWidth
                disabled={actionLoading === 'skip'}
                onClick={() => submitTurn('skip')}
                style={{ flex: 1, background: '#444' }}
              >
                {actionLoading === 'skip' ? 'Пропускаем...' : 'Пропустить'}
              </Button>
            </div>
          </div>
        )}
        {!state.isMyTurn && (
          <div style={{ marginTop: 12, opacity: 0.85, fontSize: 14, textAlign: 'center' }}>
            Ожидайте: ход игрока обновится автоматически.
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
    </>
  );
}

