import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import BackArrow from '../components/BackArrow';
import { useToast } from '../components/ui/ToastProvider';

const ADMIN_PASS_KEY = 'gameHub_adminPass';
const BOT_USERNAME = import.meta.env.VITE_BOT_USERNAME || '';
const APP_LINK = BOT_USERNAME ? `https://t.me/${BOT_USERNAME}` : (import.meta.env.VITE_BASE_URL || window.location.origin);

export default function Admin() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [password, setPassword] = useState(() => sessionStorage.getItem(ADMIN_PASS_KEY) || '');
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');
  const [promoView, setPromoView] = useState(false);
  const [promoType, setPromoType] = useState('day');
  const [createdPromo, setCreatedPromo] = useState(null);

  useEffect(() => {
    if (!password) {
      navigate('/', { replace: true });
      return;
    }
    api.post('/admin/stats', { password })
      .then(setStats)
      .catch(() => setError('Неверный пароль'));
  }, [password, navigate]);

  const loadStats = () => {
    api.post('/admin/stats', { password }).then(setStats).catch(() => setError('Ошибка'));
  };

  const createPromo = async () => {
    setError('');
    try {
      const r = await api.post('/admin/promocode', { password, type: promoType });
      setCreatedPromo(r);
    } catch (e) {
      setError(e.message || 'Ошибка');
    }
  };

  const sharePromo = () => {
    const text = `GameHub — промокод на Про: ${createdPromo.code}\nПерейди в приложение и введи промокод: ${APP_LINK}`;
    const tg = window.Telegram?.WebApp;
    if (tg?.openTelegramLink) {
      tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(APP_LINK)}&text=${encodeURIComponent('GameHub — промокод на Про: ' + createdPromo.code + '\nПерейди в приложение и введи промокод.')}`);
      showToast({ type: 'info', message: 'Выберите чат для отправки' });
    } else {
      navigator.clipboard.writeText(text).then(() => {
        showToast({ type: 'success', message: 'Промокод скопирован' });
      });
    }
  };

  const exitAdmin = () => {
    sessionStorage.removeItem(ADMIN_PASS_KEY);
    navigate('/', { replace: true });
  };

  if (stats === null && !error) return <div style={{ padding: 24 }}>Загрузка…</div>;
  if (error && !stats) {
    return (
      <div style={{ padding: 24 }}>
        <p style={{ color: '#f88' }}>{error}</p>
        <button type="button" onClick={() => navigate('/')} style={btnStyle}>На главную</button>
      </div>
    );
  }

  if (promoView && !createdPromo) {
    return (
      <div style={{ padding: 24, maxWidth: 400, margin: '0 auto' }}>
        <h2 style={{ marginTop: 0 }}>Создать промокод</h2>
        <p style={{ marginBottom: 12 }}>Срок действия:</p>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {['day', 'week', 'month'].map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setPromoType(t)}
              style={{ ...btnStyle, flex: 1, background: promoType === t ? '#5a4' : '#444' }}
            >
              {t === 'day' ? 'День' : t === 'week' ? 'Неделя' : 'Месяц'}
            </button>
          ))}
        </div>
        {error && <p style={{ color: '#f88' }}>{error}</p>}
        <button type="button" onClick={createPromo} style={btnStyle}>Сгенерировать</button>
        <button type="button" onClick={() => { setPromoView(false); setError(''); }} style={{ ...btnStyle, marginTop: 8, background: '#555' }}>Отмена</button>
      </div>
    );
  }

  if (createdPromo) {
    return (
      <div style={{ padding: 24, maxWidth: 400, margin: '0 auto' }}>
        <h2 style={{ marginTop: 0 }}>Промокод создан</h2>
        <p style={{ fontSize: 24, fontWeight: 'bold', letterSpacing: 4 }}>{createdPromo.code}</p>
        <p style={{ fontSize: 14, opacity: 0.8 }}>Срок: {promoType === 'day' ? '1 день' : promoType === 'week' ? '1 неделя' : '1 месяц'}</p>
        <button type="button" onClick={sharePromo} style={{ ...btnStyle, marginTop: 16, background: '#6a5' }}>Поделиться</button>
        <button type="button" onClick={() => { setCreatedPromo(null); setPromoView(false); loadStats(); }} style={{ ...btnStyle, marginTop: 8 }}>К списку</button>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 400, margin: '0 auto' }}>
      <BackArrow onClick={exitAdmin} title="Выйти из админки" />
      <h2 style={{ marginTop: 0 }}>Админка</h2>
      <section style={{ marginBottom: 24, padding: 16, background: 'rgba(255,255,255,0.06)', borderRadius: 8 }}>
        <p style={{ marginBottom: 12 }}>Уникальные игроки</p>
        <p style={{ fontSize: 12, opacity: 0.8, marginBottom: 8 }}>Количество разных пользователей, создавших или вошедших в комнату</p>
        <div>За сутки: <strong>{stats?.day ?? 0}</strong></div>
        <div>За неделю: <strong>{stats?.week ?? 0}</strong></div>
        <div>За месяц: <strong>{stats?.month ?? 0}</strong></div>
        <div>Всего: <strong>{stats?.total ?? 0}</strong></div>
      </section>
      <section style={{ marginBottom: 24, padding: 16, background: 'rgba(255,255,255,0.06)', borderRadius: 8 }}>
        <p style={{ marginBottom: 12 }}>Показы рекламы</p>
        <p style={{ fontSize: 12, opacity: 0.8, marginBottom: 8 }}>При каждом старте игры каждый игрок в комнате считается как один показ (игроки × старты игр)</p>
        <div>За сутки: <strong>{stats?.adImpressionsDay ?? 0}</strong></div>
        <div>За месяц: <strong>{stats?.adImpressionsMonth ?? 0}</strong></div>
        <div>Всего: <strong>{stats?.adImpressionsTotal ?? 0}</strong></div>
      </section>
      <a href="https://publishers.monetag.com/statistics?group_by=date_time&date_from=2026-02-19&date_to=2026-03-19&format_type=ALL&rate_model=1" target="_blank" rel="noopener noreferrer" style={{ display: 'block', ...btnStyle, marginBottom: 8, textAlign: 'center', textDecoration: 'none' }}>Monetag — статистика рекламы</a>
      <button type="button" onClick={() => setPromoView(true)} style={btnStyle}>Создать промокод</button>
      <button type="button" onClick={loadStats} style={{ ...btnStyle, marginTop: 8, background: '#555' }}>Обновить статистику</button>
      <button type="button" onClick={exitAdmin} style={{ ...btnStyle, marginTop: 8, background: '#333' }}>Выйти из админки</button>
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
