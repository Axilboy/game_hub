import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getStats, saveStats } from '../stats';
import { getInventory, setPro } from '../inventory';
import { api } from '../api';
import { getDisplayName, setDisplayName, getAvatar, setAvatar, AVATAR_EMOJI_LIST } from '../displayName';

const ADMIN_CODE = '555555';
const ADMIN_PASS_KEY = 'gameHub_adminPass';

const SHOP_GAMES = [{ id: 'all', name: 'Все игры' }, { id: 'spy', name: 'Шпион' }, { id: 'mafia', name: 'Мафия' }, { id: 'elias', name: 'Элиас' }];
const SHOP_CATEGORIES = [{ id: 'all', name: 'Всё' }, { id: 'dictionaries', name: 'Словари' }, { id: 'modes', name: 'Режимы' }];

const SHOP_ITEMS = [
  { game: 'spy', category: 'dictionaries', id: 'spy_free', name: 'Базовый', description: 'Классические локации. Бесплатно.', emoji: '📍', free: true },
  { game: 'spy', category: 'dictionaries', id: 'spy_theme1', name: 'Детектив', description: 'Шпионы, агенты, шифры. Про.', emoji: '🕵️', free: false },
  { game: 'spy', category: 'dictionaries', id: 'spy_theme2', name: 'Пираты', description: 'Корабли, сокровища, острова. Про.', emoji: '🏴‍☠️', free: false },
  { game: 'spy', category: 'dictionaries', id: 'spy_travel', name: 'Путешествия', description: 'Аэропорт, отель, круиз. Про.', emoji: '✈️', free: false },
  { game: 'spy', category: 'dictionaries', id: 'spy_food', name: 'Еда', description: 'Ресторан, кафе, кухня. Про.', emoji: '🍽️', free: false },
  { game: 'spy', category: 'dictionaries', id: 'spy_sports', name: 'Спорт', description: 'Стадион, спортзал, бассейн. Про.', emoji: '⚽', free: false },
  { game: 'spy', category: 'dictionaries', id: 'spy_movies', name: 'Кино', description: 'Кинотеатр, премьера, Оскар. Про.', emoji: '🎬', free: false },
  { game: 'spy', category: 'dictionaries', id: 'spy_music', name: 'Музыка', description: 'Концерт, опера, студия. Про.', emoji: '🎵', free: false },
  { game: 'spy', category: 'dictionaries', id: 'spy_nature', name: 'Природа', description: 'Лес, море, парк. Про.', emoji: '🌲', free: false },
  { game: 'spy', category: 'dictionaries', id: 'spy_science', name: 'Наука', description: 'Лаборатория, обсерватория. Про.', emoji: '🔬', free: false },
  { game: 'spy', category: 'dictionaries', id: 'spy_history', name: 'История', description: 'Замок, музей, руины. Про.', emoji: '🏛️', free: false },
  { game: 'spy', category: 'dictionaries', id: 'spy_art', name: 'Искусство', description: 'Галерея, выставка. Про.', emoji: '🎨', free: false },
  { game: 'spy', category: 'dictionaries', id: 'spy_tech', name: 'Технологии', description: 'Офис, коворкинг, VR. Про.', emoji: '💻', free: false },
  { game: 'mafia', category: 'modes', id: 'mafia_extended', name: 'Расширенная Мафия', description: 'Дон, Комиссар, Доктор, Маньяк. Про.', emoji: '🌙', free: false },
  { game: 'elias', category: 'dictionaries', id: 'elias_basic', name: 'Базовый', description: 'Простые слова. Бесплатно.', emoji: '📦', free: true },
  { game: 'elias', category: 'dictionaries', id: 'elias_animals', name: 'Животные', description: 'Звери, птицы, рыбы. Бесплатно.', emoji: '🦁', free: true },
  { game: 'elias', category: 'dictionaries', id: 'elias_movies', name: 'Кино', description: 'Жанры, награды. Про.', emoji: '🎬', free: false },
  { game: 'elias', category: 'dictionaries', id: 'elias_science', name: 'Наука', description: 'Эксперименты, теории. Про.', emoji: '🔬', free: false },
  { game: 'elias', category: 'dictionaries', id: 'elias_sport', name: 'Спорт', description: 'Турниры, команды. Про.', emoji: '⚽', free: false },
];

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
  const [inv, setInv] = useState(getInventory);
  const [showSubStub, setShowSubStub] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [promoError, setPromoError] = useState('');
  const [showShopStub, setShowShopStub] = useState(false);
  const [shopGameFilter, setShopGameFilter] = useState('all');
  const [shopCategoryFilter, setShopCategoryFilter] = useState('all');
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [displayNameValue, setDisplayNameValue] = useState(getDisplayName() || '');
  const [displayNameState, setDisplayNameState] = useState(getDisplayName() || '');
  const [avatarState, setAvatarState] = useState(getAvatar() || '');
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
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
      {showShopStub && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, padding: 16 }} onClick={() => setShowShopStub(false)}>
          <div style={{ background: 'var(--tg-theme-bg-color, #1a1a1a)', padding: 20, borderRadius: 12, maxWidth: 360, maxHeight: '90vh', overflow: 'auto', display: 'flex', flexDirection: 'column' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0, marginBottom: 16 }}>Магазин</h3>
            <p style={{ fontSize: 13, marginBottom: 12 }}>Игра</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
              {SHOP_GAMES.map((g) => (
                <button key={g.id} type="button" onClick={() => setShopGameFilter(g.id)} style={{ ...btnStyle, width: 'auto', padding: '8px 12px', fontSize: 13, background: shopGameFilter === g.id ? 'var(--tg-theme-button-color, #3a7bd5)' : '#444' }}>{g.name}</button>
              ))}
            </div>
            <p style={{ fontSize: 13, marginBottom: 12 }}>Категория</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
              {SHOP_CATEGORIES.map((c) => (
                <button key={c.id} type="button" onClick={() => setShopCategoryFilter(c.id)} style={{ ...btnStyle, width: 'auto', padding: '8px 12px', fontSize: 13, background: shopCategoryFilter === c.id ? 'var(--tg-theme-button-color, #3a7bd5)' : '#444' }}>{c.name}</button>
              ))}
            </div>
            <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
              {SHOP_ITEMS.filter((item) => (shopGameFilter === 'all' || item.game === shopGameFilter) && (shopCategoryFilter === 'all' || item.category === shopCategoryFilter)).map((item) => {
                const locked = !item.free && !inv.hasPro;
                return (
                  <div key={item.id} style={{ marginBottom: 12, padding: 14, background: locked ? 'rgba(80,60,60,0.2)' : 'rgba(255,255,255,0.06)', borderRadius: 10, position: 'relative' }}>
                    {locked && <div style={{ position: 'absolute', top: 8, right: 8, fontSize: 18 }}>🔒</div>}
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                      <div style={{ width: 44, height: 44, borderRadius: 8, background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>{item.emoji}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, marginBottom: 4 }}>{item.name}{item.free && <span style={{ fontSize: 12, color: '#8f8', marginLeft: 6 }}>Бесплатно</span>}</div>
                        <div style={{ fontSize: 13, opacity: 0.9 }}>{item.description}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <p style={{ fontSize: 12, opacity: 0.8, marginTop: 12 }}>Покупка отдельных товаров пока не реализована. Оформите Премиум — откроются все словари и режимы.</p>
            <button type="button" onClick={() => setShowShopStub(false)} style={{ ...btnStyle, marginTop: 16 }}>Закрыть</button>
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
