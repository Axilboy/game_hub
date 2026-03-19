import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getStats, saveStats } from '../stats';
import { getInventory, setPro } from '../inventory';
import { api } from '../api';
import { getDisplayName, setDisplayName, getAvatar, setAvatar, AVATAR_EMOJI_LIST } from '../displayName';
import ShopModal from '../components/ShopModal';
import BackArrow from '../components/BackArrow';
import useSeo from '../hooks/useSeo';
import { showAdIfNeeded } from '../ads';

const ADMIN_CODE = '555555';
const ADMIN_PASS_KEY = 'gameHub_adminPass';

function formatTime(seconds) {
  if (seconds < 60) return `${seconds} сек`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} мин`;
  return `${(seconds / 3600).toFixed(1)} ч`;
}

export default function Home({ user, onCreateRoom, onJoinByCode, onJoinByInvite }) {
  const navigate = useNavigate();
  useSeo({ robots: 'noindex, nofollow' });
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(getStats);
  const [inv, setInv] = useState(getInventory);
  const [showSubStub, setShowSubStub] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [promoError, setPromoError] = useState('');
  const [showShopStub, setShowShopStub] = useState(false);
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [displayNameValue, setDisplayNameValue] = useState(getDisplayName() || '');
  const [displayNameState, setDisplayNameState] = useState(getDisplayName() || '');
  const [avatarState, setAvatarState] = useState(getAvatar() || '');
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [showInstruction, setShowInstruction] = useState(false);
  const [adLoading, setAdLoading] = useState(false);
  const shownName = displayNameState || user?.first_name || 'Игрок';

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

  const handleShowAd = async () => {
    setError('');
    setAdLoading(true);
    try {
      await showAdIfNeeded();
    } finally {
      setAdLoading(false);
    }
  };

  const handleJoinByCode = async (e) => {
    e.preventDefault();
    if (!code.trim()) return;
    if (code.trim() === ADMIN_CODE) {
      setShowAdminPassword(true);
      return;
    }
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

  const handleAdminPassword = (e) => {
    e.preventDefault();
    if (adminPassword === '1973') {
      sessionStorage.setItem(ADMIN_PASS_KEY, '1973');
      navigate('/admin');
    } else {
      setError('Неверный пароль');
    }
  };

  const applyPromoCode = async () => {
    if (!promoCode.trim()) return;
    setPromoError('');
    try {
      const r = await api.post('/promocode/redeem', { code: promoCode.trim() });
      if (r.proExpiresAt) {
        setPro(r.proExpiresAt);
        setInv(getInventory());
        setPromoCode('');
        setShowSubStub(false);
      }
    } catch (e) {
      setPromoError('Неверный или использованный промокод');
    }
  };

  const saveDisplayName = () => {
    setEditingName(false);
    const v = (displayNameValue || '').trim();
    setDisplayName(v || '');
    setDisplayNameValue(v || '');
    setDisplayNameState(v || '');
  };

  const pickAvatar = (emoji) => {
    setAvatar(emoji || '');
    setAvatarState(emoji || '');
    setShowAvatarPicker(false);
  };

  return (
    <div style={{ padding: 24, maxWidth: 400, margin: '0 auto' }}>
      <BackArrow onClick={() => window.history.back()} title="Назад" />
      <header style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <div onClick={() => setShowAvatarPicker(true)} title="Нажмите, чтобы сменить аватар" style={{ cursor: 'pointer', flexShrink: 0 }}>
          {avatarState ? (
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>
              {avatarState}
            </div>
          ) : user?.photo_url ? (
            <img src={user.photo_url} alt="" style={{ width: 48, height: 48, borderRadius: '50%' }} />
          ) : (
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--tg-theme-button-color, #3a7bd5)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 20 }}>
              {(shownName || '?')[0]}
            </div>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          {editingName ? (
            <input
              type="text"
              value={displayNameValue}
              onChange={(e) => setDisplayNameValue(e.target.value)}
              onBlur={saveDisplayName}
              onKeyDown={(e) => e.key === 'Enter' && saveDisplayName()}
              autoFocus
              placeholder="Имя"
              style={{ width: '100%', padding: 6, fontSize: 18, fontWeight: 'bold', borderRadius: 6, border: '1px solid #555' }}
            />
          ) : (
            <div style={{ fontWeight: 'bold', fontSize: 18, cursor: 'pointer' }} onClick={() => setEditingName(true)} title="Нажмите, чтобы изменить имя">
              {shownName}
            </div>
          )}
          <div style={{ fontSize: 14, opacity: 0.85 }}>{inv.hasPro ? 'Про' : 'Подписка отсутствует'}</div>
        </div>
      </header>

      <section style={{ marginBottom: 24, textAlign: 'center' }}>
        <div style={{ fontSize: 18, opacity: 0.9 }}>ИГРЫ ДЛЯ КОМПАНИИ ОНЛАЙН</div>
        <div style={{ fontSize: 20, fontWeight: 800, marginTop: 6, lineHeight: 1.2 }}>
          Играй с друзьями прямо в браузере
        </div>
        <div style={{ fontSize: 16, opacity: 0.85, marginTop: 6 }}>Без регистрации</div>
      </section>

      {showAvatarPicker && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, padding: 24 }}>
          <div style={{ background: 'var(--tg-theme-bg-color, #1a1a1a)', padding: 24, borderRadius: 12, maxWidth: 320 }}>
            <p style={{ marginBottom: 12 }}>Выберите аватар</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 16 }}>
              {AVATAR_EMOJI_LIST.map((emoji) => (
                <button key={emoji} type="button" onClick={() => pickAvatar(emoji)} style={{ fontSize: 28, padding: 8, background: avatarState === emoji ? 'rgba(90,160,90,0.4)' : 'transparent', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
                  {emoji}
                </button>
              ))}
            </div>
            <button type="button" onClick={() => pickAvatar('')} style={{ ...btnStyle, marginBottom: 8, background: '#555' }}>Фото из Telegram</button>
            <button type="button" onClick={() => setShowAvatarPicker(false)} style={btnStyle}>Закрыть</button>
          </div>
        </div>
      )}

      <section style={{ marginBottom: 24, padding: 12, background: 'rgba(255,255,255,0.06)', borderRadius: 8 }}>
        <div style={{ fontSize: 14, opacity: 0.9 }}>Статистика</div>
        <div style={{ marginTop: 6 }}>Время в GameHub: {formatTime(stats.totalTimeSpent)}</div>
        <div>Сыграно игр: {stats.gamesPlayed}</div>
      </section>

      {error && <p style={{ color: '#f88' }}>{error}</p>}
      <section style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={handleCreate}
            disabled={loading}
            style={{ ...btnStyle, flex: 1 }}
          >
            Создать комнату
          </button>
          <button
            type="button"
            disabled
            aria-hidden="true"
            tabIndex={-1}
            style={{ ...btnStyle, visibility: 'hidden' }}
          >
            Войти
          </button>
        </div>
      </section>
      <section style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={() => setShowInstruction(true)}
            disabled={loading}
            style={{ ...btnStyle, flex: 1, background: '#555' }}
          >
            Инструкция
          </button>
          <button
            type="button"
            disabled
            aria-hidden="true"
            tabIndex={-1}
            style={{ ...btnStyle, visibility: 'hidden' }}
          >
            Войти
          </button>
        </div>
      </section>
      <section style={{ marginBottom: 24 }}>
        <p style={{ marginBottom: 8 }}>Войти по коду</p>
        {showAdminPassword ? (
          <form onSubmit={handleAdminPassword} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input
              type="password"
              placeholder="Пароль"
              value={adminPassword}
              onChange={(e) => { setAdminPassword(e.target.value); setError(''); }}
              style={{ padding: 12, fontSize: 18, borderRadius: 8 }}
            />
            <button type="submit" style={btnStyle}>Войти в админку</button>
            <button type="button" onClick={() => { setShowAdminPassword(false); setAdminPassword(''); setError(''); }} style={{ ...btnStyle, background: '#555' }}>Отмена</button>
          </form>
        ) : (
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
        )}
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
            <p style={{ marginBottom: 16 }}>Нет рекламы, неограниченные игры и режимы для всех участников сессии.</p>
            <button type="button" onClick={() => { setPro(Date.now() + 30 * 24 * 3600 * 1000); setInv(getInventory()); setShowSubStub(false); }} style={{ ...btnStyle, marginBottom: 12, background: '#5a4' }}>Купить подписку</button>
            <p style={{ marginBottom: 6 }}>Промокод</p>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <input type="text" placeholder="Введите промокод" value={promoCode} onChange={(e) => { setPromoCode(e.target.value); setPromoError(''); }} style={{ flex: 1, padding: 12, borderRadius: 8, border: '1px solid #444', background: 'transparent', color: 'inherit' }} />
              <button type="button" onClick={applyPromoCode} style={{ ...btnStyle, width: 'auto' }}>Применить</button>
            </div>
            {promoError && <p style={{ color: '#f88', fontSize: 14, marginBottom: 12 }}>{promoError}</p>}
            <button type="button" onClick={() => setShowSubStub(false)} style={btnStyle}>Закрыть</button>
          </div>
        </div>
      )}
      <ShopModal open={showShopStub} onClose={() => setShowShopStub(false)} initialGameFilter="all" />

      <section style={{ marginTop: 16 }}>
        <button
          type="button"
          onClick={handleShowAd}
          disabled={adLoading}
          style={{ ...btnStyle, width: '100%', background: '#55a' }}
        >
          {adLoading ? 'Запуск рекламы...' : 'Показать рекламу'}
        </button>
      </section>

      {showInstruction && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10,
            padding: 24,
          }}
          onClick={() => setShowInstruction(false)}
        >
          <div
            style={{
              background: 'var(--tg-theme-bg-color, #1a1a1a)',
              padding: 24,
              borderRadius: 12,
              maxWidth: 360,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginTop: 0, marginBottom: 12 }}>Инструкция</h3>
            <div style={{ lineHeight: 1.6, opacity: 0.92, fontSize: 14 }}>
              <div>1) Создай комнату и разошли друзьям код или приглашение.</div>
              <div style={{ marginTop: 6 }}>2) В лобби хост выбирает игру и нажимает «Начать».</div>
              <div style={{ marginTop: 6 }}>3) После старта каждый видит свою карточку/роль.</div>
              <div style={{ marginTop: 6 }}>4) Управление в игре только у ведущего (остальные угадывают/голосуют).</div>
              <div style={{ marginTop: 6 }}>5) Кнопка «Назад» сверху слева дублирует действие «Назад».</div>
            </div>
            <button
              type="button"
              onClick={() => setShowInstruction(false)}
              style={{ ...btnStyle, marginTop: 16, background: '#555', width: '100%' }}
            >
              Понятно
            </button>
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
