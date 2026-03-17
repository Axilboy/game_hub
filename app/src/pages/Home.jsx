import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Home({ user, onCreateRoom, onJoinByCode, onJoinByInvite }) {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const pending = sessionStorage.getItem('pendingInvite');
    if (pending) {
      sessionStorage.removeItem('pendingInvite');
      setLoading(true);
      onJoinByInvite(pending)
        .then(() => navigate('/lobby'))
        .catch(() => setError('Не удалось войти по приглашению'))
        .finally(() => setLoading(false));
    }
  }, []);

  const handleCreate = async () => {
    setError('');
    setLoading(true);
    try {
      await onCreateRoom();
      navigate('/lobby');
    } catch (e) {
      setError(e.message || 'Ошибка создания комнаты');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinByCode = async (e) => {
    e.preventDefault();
    if (!code.trim()) return;
    setError('');
    setLoading(true);
    try {
      await onJoinByCode(code);
      navigate('/lobby');
    } catch (e) {
      setError('Комната не найдена или неверный код');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 24, maxWidth: 400, margin: '0 auto' }}>
      <h1 style={{ marginTop: 0 }}>Игровой хаб</h1>
      {error && <p style={{ color: '#f88' }}>{error}</p>}
      <section style={{ marginBottom: 32 }}>
        <button
          type="button"
          onClick={handleCreate}
          disabled={loading}
          style={btnStyle}
        >
          Создать комнату
        </button>
      </section>
      <section>
        <p style={{ marginBottom: 8 }}>Войти по коду</p>
        <form onSubmit={handleJoinByCode} style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            placeholder="000000"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            style={{ flex: 1, padding: 12, fontSize: 18, borderRadius: 8 }}
          />
          <button type="submit" disabled={loading} style={btnStyle}>
            Войти
          </button>
        </form>
      </section>
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
};
