import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { socket } from '../socket';
import useSeo from '../hooks/useSeo';
import GameplayScreen from '../components/game/GameplayScreen';
import Loader from '../components/ui/Loader';
import ErrorState from '../components/ui/ErrorState';
import Button from '../components/ui/Button';

function clamp(n, min, max) {
  const x = Number(n);
  if (!Number.isFinite(x)) return min;
  return Math.max(min, Math.min(max, Math.round(x)));
}

export default function MunchkinRound({ roomId, user, onLeave }) {
  const navigate = useNavigate();
  useSeo({ robots: 'noindex, nofollow' });
  const myId = user?.id != null ? String(user.id) : '';
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const seqRef = useRef(0);

  const refresh = ({ silent = false } = {}) => {
    if (!roomId || !myId) return;
    const req = ++seqRef.current;
    if (!silent) setLoading(true);
    api
      .get(`/rooms/${roomId}/munchkin/state?playerId=${encodeURIComponent(myId)}`)
      .then((s) => {
        if (req !== seqRef.current) return;
        setState(s);
        if (!silent) setLoading(false);
      })
      .catch(() => {
        if (req !== seqRef.current) return;
        if (!silent) setLoading(false);
      });
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, myId]);

  useEffect(() => {
    const onUpdate = () => refresh({ silent: true });
    socket.on('munchkin_update', onUpdate);
    socket.onConnect(onUpdate);
    return () => {
      socket.off('munchkin_update', onUpdate);
      socket.offConnect(onUpdate);
    };
  }, [roomId, myId]);

  const leaveToLobby = async () => {
    try {
      await onLeave?.();
    } catch (_) {}
    navigate('/lobby');
  };

  const applyUpdate = async ({ targetPlayerId, deltaLevel = 0, deltaPower = 0, setLevel, setPower } = {}) => {
    if (!roomId || !myId || busy) return;
    try {
      setBusy(true);
      await api.post(`/rooms/${roomId}/munchkin/update`, {
        playerId: myId,
        targetPlayerId,
        deltaLevel,
        deltaPower,
        setLevel,
        setPower,
      });
      refresh({ silent: true });
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <GameplayScreen theme="munchkin" user={user} onBack={leaveToLobby} backTitle="В лобби" title="Счетчик Манчкин">
        <Loader label="Загрузка счетчика..." minHeight="50vh" />
      </GameplayScreen>
    );
  }

  if (!state) {
    return (
      <GameplayScreen theme="munchkin" user={user} onBack={leaveToLobby} backTitle="В лобби" title="Счетчик Манчкин">
        <ErrorState title="Нет данных" message="Состояние счетчика не загружено." actionLabel="В лобби" onAction={leaveToLobby} />
      </GameplayScreen>
    );
  }

  const mode = state.mode === 'personal' ? 'personal' : 'shared';
  const winLevel = Number(state.winLevel) || 10;
  const myRow = Array.isArray(state.players) ? state.players.find((p) => String(p.id) === myId) : null;

  return (
    <GameplayScreen theme="munchkin" user={user} onBack={leaveToLobby} backTitle="В лобби" title="Счетчик Манчкин">
      <div className="gpl__panel">
        <p style={{ margin: 0, fontSize: 14, opacity: 0.9 }}>
          Режим: <strong>{mode === 'shared' ? '1 устройство на всех' : 'каждый ведет сам'}</strong>
        </p>
        <p style={{ margin: '8px 0 0', fontSize: 14, opacity: 0.88 }}>
          Победа: <strong>{winLevel} уровень</strong>
        </p>
      </div>

      {mode === 'personal' ? (
        <div className="gpl__panel">
          <h3 style={{ margin: '0 0 10px' }}>Мой счетчик</h3>
          <p style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>
            Уровень: {clamp(myRow?.level, 1, 20)} | Сила: {clamp(myRow?.power, -50, 999)}
          </p>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <Button variant="secondary" onClick={() => applyUpdate({ deltaLevel: -1 })} disabled={busy}>Уровень -1</Button>
            <Button variant="primary" onClick={() => applyUpdate({ deltaLevel: 1 })} disabled={busy}>Уровень +1</Button>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <Button variant="secondary" onClick={() => applyUpdate({ deltaPower: -1 })} disabled={busy}>Сила -1</Button>
            <Button variant="primary" onClick={() => applyUpdate({ deltaPower: 1 })} disabled={busy}>Сила +1</Button>
          </div>
        </div>
      ) : null}

      <div className="gpl__panel">
        <h3 style={{ margin: '0 0 10px' }}>
          {mode === 'shared' ? 'Игроки (редактирование с 1 устройства)' : 'Игроки'}
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {(state.players || []).map((p) => {
            const score = Number(p.level || 1) + Number(p.power || 0);
            const isWin = Number(p.level || 1) >= winLevel;
            const canEdit = mode === 'shared' || String(p.id) === myId;
            return (
              <div key={p.id} className="gh-card" style={{ padding: 10 }}>
                <div style={{ fontWeight: 700 }}>{p.name}{String(p.id) === myId ? ' (вы)' : ''}</div>
                <div style={{ fontSize: 13, opacity: 0.9 }}>
                  Уровень {p.level} | Сила {p.power} | Сумма {score}{isWin ? ' | Победа!' : ''}
                </div>
                {canEdit ? (
                  <>
                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                      <Button
                        variant="secondary"
                        onClick={() => applyUpdate({ targetPlayerId: p.id, deltaLevel: -1 })}
                        disabled={busy}
                      >
                        Уровень -1
                      </Button>
                      <Button
                        variant="primary"
                        onClick={() => applyUpdate({ targetPlayerId: p.id, deltaLevel: 1 })}
                        disabled={busy}
                      >
                        Уровень +1
                      </Button>
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                      <Button
                        variant="secondary"
                        onClick={() => applyUpdate({ targetPlayerId: p.id, deltaPower: -1 })}
                        disabled={busy}
                      >
                        Сила -1
                      </Button>
                      <Button
                        variant="primary"
                        onClick={() => applyUpdate({ targetPlayerId: p.id, deltaPower: 1 })}
                        disabled={busy}
                      >
                        Сила +1
                      </Button>
                    </div>
                  </>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </GameplayScreen>
  );
}

