import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getStats, saveStats } from '../stats';

function formatTime(seconds) {
  if (seconds < 60) return `${seconds} сек`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} мин`;
  return `${(seconds / 3600).toFixed(1)} ч`;
}

export default function Home({ user, onCreateRoom, onJoinByCode, onJoinByInvite }) {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(getStats);
  const [subscription] = useState(false);
  const [showSubStub, setShowSubStub] = useState(false);
  const [showShopStub, setShowShopStub] = useState(false);

  useEffect(() => {
    const s = getStats();
    const now = Date.now();
    if (!s.firstVisitAt) {
      saveStats({ ...s, firstVisitAt: now, lastVisitAt: now });
      setStats(getStats());
    } else {
      const added = s.lastVisitAt ? Math.floor((now - s.lastVisitAt) / 1000) : 0;
      const next = { ...s, totalTimeSpent: s.totalTimeSpent + added, lastVisitAt: now };
      saveStats(next);
      setStats(next);
    }
  }, []);

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
      <header style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        {user?.photo_url ? (
          <img src={user.photo_url} alt="" style={{ width: 48, height: 48, borderRadius: '50%' }} />
        ) : (
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--tg-theme-button-color, #3a7bd5)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 20 }}>
            {(user?.first_name || '?')[0]}
          </div>
        )}
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 'bold', fontSize: 18 }}>{user?.first_name || 'Игрок'}</div>
          <div style={{ fontSize: 14, opacity: 0.85 }}>{subscription ? 'Про' : 'Подписка отсутствует'}</div>
        </div>
      </header>

      <section style={{ marginBottom: 24, padding: 12, background: 'rgba(255,255,255,0.06)', borderRadius: 8 }}>
        <div style={{ fontSize: 14, opacity: 0.9 }}>Статистика</div>
        <div style={{ marginTop: 6 }}>Время в GameHub: {formatTime(stats.totalTimeSpent)}</div>
        <div>Сыграно игр: {stats.gamesPlayed}</div>
      </section>

      {error && <p style={{ color: '#f88' }}>{error}</p>}
      <section style={{ marginBottom: 16 }}>
        <button
          type="button"
          onClick={handleCreate}
          disabled={loading}
          style={btnStyle}
        >
          Создать комнату
        </button>
      </section>
      <section style={{ marginBottom: 24 }}>
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

      <section style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button type="button" onClick={() => setShowSubStub(true)} style={{ ...btnStyle, flex: 1, background: '#5a4' }}>
          Купить подписку
        </button>
        <button type="button" onClick={() => setShowShopStub(true)} style={{ ...btnStyle, flex: 1, background: '#55a' }}>
          Магазин
        </button>
      </section>

      {showSubStub && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, padding: 24 }}>
          <div style={{ background: 'var(--tg-theme-bg-color, #1a1a1a)', padding: 24, borderRadius: 12, maxWidth: 320 }}>
            <p style={{ marginBottom: 16 }}>Купить подписку — скоро</p>
            <button type="button" onClick={() => setShowSubStub(false)} style={btnStyle}>Закрыть</button>
          </div>
        </div>
      )}
      {showShopStub && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, padding: 24 }}>
          <div style={{ background: 'var(--tg-theme-bg-color, #1a1a1a)', padding: 24, borderRadius: 12, maxWidth: 320 }}>
            <p style={{ marginBottom: 16 }}>Магазин — скоро</p>
            <button type="button" onClick={() => setShowShopStub(false)} style={btnStyle}>Закрыть</button>
          </div>
        </div>
      )}
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
