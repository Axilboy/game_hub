import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

const BASE_URL = import.meta.env.VITE_BASE_URL || window.location.origin;
const BOT_USERNAME = import.meta.env.VITE_BOT_USERNAME || '';

const TIMER_OPTIONS = [
  { label: '1 мин', value: 60 },
  { label: '2 мин', value: 120 },
  { label: '3 мин', value: 180 },
  { label: '5 мин', value: 300 },
];

const SPY_COUNT_OPTIONS = [1, 2, 3];

export default function Lobby({ room, roomId, user, onLeave, onRoomUpdate }) {
  const navigate = useNavigate();
  const isHost = room.players?.some((p) => p.id === String(user?.id) && p.isHost);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [timerEnabled, setTimerEnabled] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(60);
  const [spyCount, setSpyCount] = useState(1);
  const [editingName, setEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState(room?.name || 'Лобби');
  const [shareToast, setShareToast] = useState(false);
  const [selectedGame, setSelectedGame] = useState(null);

  const roomName = room?.name || 'Лобби';

  useEffect(() => {
    setEditNameValue(roomName);
  }, [roomName]);

  const inviteToken = sessionStorage.getItem('inviteToken');
  const inviteLink = BOT_USERNAME && inviteToken
    ? `https://t.me/${BOT_USERNAME}?start=${inviteToken}`
    : inviteToken
      ? `${BASE_URL}?invite=${inviteToken}`
      : '';

  const startSpy = async () => {
    if (!isHost) return;
    await api.post('/rooms/spy/start', {
      roomId,
      hostId: String(user?.id),
      timerEnabled,
      timerSeconds: timerEnabled ? timerSeconds : undefined,
      spyCount,
    });
    const { room: r } = await api.get(`/rooms/${roomId}`);
    onRoomUpdate(r);
    navigate('/spy');
  };

  const saveRoomName = async () => {
    setEditingName(false);
    const name = (editNameValue || '').trim() || 'Лобби';
    if (name === roomName) return;
    try {
      await api.patch(`/rooms/${roomId}`, { hostId: String(user?.id), name });
      const { room: r } = await api.get(`/rooms/${roomId}`);
      onRoomUpdate(r);
    } catch (_) {}
  };

  const shareInvite = async () => {
    const text = `GameHub — присоединиться к лобби: ${roomName}\n${inviteLink}`;
    try {
      await navigator.clipboard.writeText(text);
      setShareToast(true);
      setTimeout(() => setShareToast(false), 2500);
    } catch (_) {
      setShareToast(true);
      setTimeout(() => setShareToast(false), 2500);
    }
  };

  return (
    <div style={{ padding: 24, maxWidth: 400, margin: '0 auto' }}>
      {editingName && isHost ? (
        <input
          type="text"
          value={editNameValue}
          onChange={(e) => setEditNameValue(e.target.value)}
          onBlur={saveRoomName}
          onKeyDown={(e) => e.key === 'Enter' && saveRoomName()}
          autoFocus
          style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 16, width: '100%', padding: 8, borderRadius: 8 }}
        />
      ) : (
        <h2
          style={{ marginBottom: 16, cursor: isHost ? 'pointer' : 'default' }}
          onClick={() => isHost && setEditingName(true)}
          title={isHost ? 'Нажмите, чтобы изменить название' : ''}
        >
          {roomName}
        </h2>
      )}

      <p>Код комнаты: <strong>{room.code}</strong></p>
      {inviteLink && (
        <div style={{ marginBottom: 16 }}>
          <p>Приглашение:</p>
          <a href={inviteLink} target="_blank" rel="noopener noreferrer" style={{ wordBreak: 'break-all', color: '#7ab' }}>
            {inviteLink}
          </a>
          <button
            type="button"
            onClick={shareInvite}
            style={{ ...btnStyle, marginTop: 8, background: '#6a5' }}
          >
            Поделиться
          </button>
          {shareToast && (
            <p style={{ marginTop: 8, color: '#8f8', fontSize: 14 }}>
              Ссылка скопирована — вставьте в чат
            </p>
          )}
        </div>
      )}
      <p>Игроки ({room.players?.length || 0}):</p>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {(room.players || []).map((p) => (
          <li key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span>{p.name}{p.isHost ? ' (хост)' : ''}</span>
            {isHost && p.id !== String(user?.id) && !p.isHost && (
              <button
                type="button"
                onClick={async () => {
                  try {
                    await api.post(`/rooms/${roomId}/kick`, { hostId: String(user?.id), playerIdToKick: p.id });
                  } catch (_) {}
                }}
                style={{ ...btnStyle, width: 'auto', padding: '6px 12px', margin: 0, fontSize: 14, background: '#a44' }}
              >
                Кик
              </button>
            )}
          </li>
        ))}
      </ul>

      {isHost && selectedGame === null && (
        <div style={{ ...settingsBox, marginTop: 24 }}>
          <p style={{ marginBottom: 12 }}>Выберите игру</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {[
              { id: 'spy', name: 'Шпион', available: true },
              { id: 'mafia', name: 'Мафия', available: false },
              { id: 'bunker', name: 'Бункер', available: false },
              { id: 'elias', name: 'Элиас', available: false },
            ].map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => g.available ? setSelectedGame(g.id) : null}
                style={{
                  ...btnStyle,
                  padding: 20,
                  background: g.available ? 'var(--tg-theme-button-color, #3a7bd5)' : '#333',
                  opacity: g.available ? 1 : 0.8,
                }}
              >
                {g.name}
                {!g.available && <span style={{ display: 'block', fontSize: 12, marginTop: 4 }}>Скоро</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {isHost && selectedGame === 'spy' && (
        <>
          <p style={{ marginTop: 24, marginBottom: 8 }}>Игра: <strong>Шпион</strong> <button type="button" onClick={() => setSelectedGame(null)} style={{ fontSize: 12, marginLeft: 8, background: 'transparent', border: 'none', color: '#8af', cursor: 'pointer' }}>другая</button></p>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <button
              type="button"
              onClick={() => setSettingsOpen(!settingsOpen)}
              style={{ ...btnStyle, background: '#555', flex: 1 }}
            >
              Настройки
            </button>
            <button type="button" onClick={startSpy} style={{ ...btnStyle, flex: 1 }}>
              Начать
            </button>
          </div>
          {settingsOpen && (
            <div style={settingsBox}>
              <p style={{ marginTop: 0 }}>Количество шпионов</p>
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                {SPY_COUNT_OPTIONS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setSpyCount(n)}
                    style={{
                      ...btnStyle,
                      width: 'auto',
                      padding: '8px 14px',
                      background: spyCount === n ? 'var(--tg-theme-button-color, #3a7bd5)' : '#444',
                    }}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <p style={{ marginBottom: 8 }}>Таймер раунда</p>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <input
                  type="checkbox"
                  checked={timerEnabled}
                  onChange={(e) => setTimerEnabled(e.target.checked)}
                />
                <span>Включить таймер</span>
              </label>
              {timerEnabled && (
                <div style={{ marginBottom: 12 }}>
                  <p style={{ marginBottom: 6 }}>Время:</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {TIMER_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setTimerSeconds(opt.value)}
                        style={{
                          ...btnStyle,
                          width: 'auto',
                          padding: '8px 14px',
                          background: timerSeconds === opt.value ? 'var(--tg-theme-button-color, #3a7bd5)' : '#444',
                        }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {isHost && selectedGame && selectedGame !== 'spy' && (
        <div style={{ ...settingsBox, marginTop: 24 }}>
          <p style={{ marginBottom: 8 }}>{selectedGame === 'mafia' ? 'Мафия' : selectedGame === 'bunker' ? 'Бункер' : 'Элиас'} — скоро</p>
          <button type="button" onClick={() => setSelectedGame(null)} style={btnStyle}>Выбрать другую игру</button>
        </div>
      )}

      <button type="button" onClick={onLeave} style={{ ...btnStyle, marginTop: 24, background: '#555' }}>
        Выйти
      </button>
    </div>
  );
}

const btnStyle = {
  padding: '12px 20px',
  fontSize: 16,
  borderRadius: 8,
  border: 'none',
  background: 'var(--tg-theme-button-color, #3a7bd5)',
  color: 'var(--tg-theme-button-text-color, #fff)',
  cursor: 'pointer',
  width: '100%',
};

const settingsBox = {
  padding: 16,
  marginBottom: 16,
  borderRadius: 8,
  background: 'rgba(255,255,255,0.06)',
};
