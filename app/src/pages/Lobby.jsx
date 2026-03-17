import { useNavigate } from 'react-router-dom';
import { api } from '../api';

const BASE_URL = import.meta.env.VITE_BASE_URL || window.location.origin;
const BOT_USERNAME = import.meta.env.VITE_BOT_USERNAME || '';

export default function Lobby({ room, roomId, user, onLeave, onRoomUpdate }) {
  const navigate = useNavigate();
  const isHost = room.players?.some((p) => p.id === String(user?.id) && p.isHost);
  const inviteToken = sessionStorage.getItem('inviteToken');
  const inviteLink = BOT_USERNAME && inviteToken
    ? `https://t.me/${BOT_USERNAME}?start=${inviteToken}`
    : inviteToken
      ? `${BASE_URL}?invite=${inviteToken}`
      : '';

  const startSpy = async () => {
    if (!isHost) return;
    await api.post('/rooms/spy/start', { roomId, hostId: String(user?.id) });
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
        <button
          type="button"
          onClick={startSpy}
          style={btnStyle}
        >
          Игра «Шпион» — начать
        </button>
      )}
      <button type="button" onClick={onLeave} style={{ ...btnStyle, marginTop: 8, background: '#555' }}>
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
