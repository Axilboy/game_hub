import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

export default function SpyRound({ roomId, user, room }) {
  const navigate = useNavigate();
  const [card, setCard] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const playerId = user?.id != null ? String(user.id) : '';
    if (!playerId) return;
    api.get(`/rooms/${roomId}/spy/card?playerId=${encodeURIComponent(playerId)}`).then((r) => {
      setCard(r);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [roomId, user?.id]);

  if (loading) return <div style={{ padding: 24 }}>Загрузка…</div>;
  if (!card) return <div style={{ padding: 24 }}>Нет карты</div>;

  const isSpy = card.role === 'spy';

  return (
    <div style={{ padding: 24, textAlign: 'center', minHeight: '60vh', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      {isSpy ? (
        <p style={{ fontSize: 24, color: '#f88' }}>Вы шпион</p>
      ) : (
        <p style={{ fontSize: 28, fontWeight: 'bold' }}>{card.word}</p>
      )}
      <button
        type="button"
        onClick={() => navigate('/lobby')}
        style={{ marginTop: 32, padding: 12, borderRadius: 8, border: 'none', background: '#555', color: '#fff', cursor: 'pointer' }}
      >
        В лобби
      </button>
    </div>
  );
}
