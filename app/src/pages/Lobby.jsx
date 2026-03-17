import { useState } from 'react';
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

export default function Lobby({ room, roomId, user, onLeave, onRoomUpdate }) {
  const navigate = useNavigate();
  const isHost = room.players?.some((p) => p.id === String(user?.id) && p.isHost);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [timerEnabled, setTimerEnabled] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(60);

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
    });
    const { room: r } = await api.get(`/rooms/${roomId}`);
    onRoomUpdate(r);
    navigate('/spy');
  };

  return (
    <div style={{ padding: 24, maxWidth: 400, margin: '0 auto' }}>
      <h2>Лобби</h2>
      <p>Код комнаты: <strong>{room.code}</strong></p>
      {inviteLink && (
        <div style={{ marginBottom: 24 }}>
          <p>Приглашение:</p>
          <a href={inviteLink} target="_blank" rel="noopener noreferrer" style={{ wordBreak: 'break-all', color: '#7ab' }}>
            {inviteLink}
          </a>
        </div>
      )}
      <p>Игроки ({room.players?.length || 0}):</p>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {(room.players || []).map((p) => (
          <li key={p.id}>{p.name}{p.isHost ? ' (хост)' : ''}</li>
        ))}
      </ul>

      {isHost && (
        <>
          <p style={{ marginTop: 24, marginBottom: 8 }}>Игра: <strong>Шпион</strong></p>
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
              <p style={{ marginTop: 0 }}>Таймер раунда</p>
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
