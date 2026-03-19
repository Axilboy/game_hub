import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getInventory, setPro } from '../inventory';
import { api } from '../api';
import { getDisplayName, setDisplayName, getAvatar, setAvatar, AVATAR_EMOJI_LIST } from '../displayName';
import ShopModal from '../components/ShopModal';
import BackArrow from '../components/BackArrow';
import useSeo from '../hooks/useSeo';
import { showAdIfNeeded } from '../ads';
import { track } from '../analytics';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';

const BASE_URL = import.meta.env.VITE_BASE_URL || (typeof window !== 'undefined' ? window.location.origin : '');
const BOT_USERNAME = import.meta.env.VITE_BOT_USERNAME || '';

const ADMIN_CODE = '555555';
const ADMIN_PASS_KEY = 'gameHub_adminPass';

function safeSessionGet(key) {
  try {
    return sessionStorage.getItem(key);
  } catch (_) {
    return null;
  }
}

export default function Home({ user, onCreateRoom, onJoinByCode, onJoinByInvite, onResumeLastRoom }) {
  const navigate = useNavigate();
  useSeo({ robots: 'noindex, nofollow' });
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
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
  const [hasLastRoom, setHasLastRoom] = useState(false);
  const shownName = displayNameState || user?.first_name || 'Игрок';

  const inviteToken = safeSessionGet('inviteToken');
  const miniAppLink = BOT_USERNAME && inviteToken ? `https://t.me/${BOT_USERNAME}?start=${inviteToken}` : '';
  const webInviteLink = inviteToken ? `${BASE_URL.replace(/\/$/, '')}?invite=${inviteToken}` : '';

  useEffect(() => {
    try {
      setHasLastRoom(Boolean(sessionStorage.getItem('gameHub_lastRoomId')));
    } catch (_) {
      setHasLastRoom(false);
    }
  }, []);

  useEffect(() => {
    const pending = safeSessionGet('pendingInvite');
    if (pending) {
      try {
        sessionStorage.removeItem('pendingInvite');
      } catch (_) {}
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
      const { adSdkShown } = await showAdIfNeeded();
      track('ad_manual_home', { shown: Boolean(adSdkShown) });
      const uid = user?.id != null ? String(user.id) : '';
      if (adSdkShown && uid) {
        try {
          await api.post('/stats/ad-shown', { playerId: uid });
        } catch (_) {}
      }
    } finally {
      setAdLoading(false);
    }
  };

  const handleResumeRoom = async () => {
    setError('');
    setLoading(true);
    try {
      const r = await onResumeLastRoom?.();
      if (r) navigate('/lobby');
      else setError('Не удалось вернуться в комнату');
    } catch (_) {
      setError('Комната недоступна');
    } finally {
      setLoading(false);
    }
  };

  const copyInviteHint = async () => {
    const text = miniAppLink || webInviteLink;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      track('invite_copied', { source: 'home' });
    } catch (_) {
      setError('Не удалось скопировать ссылку');
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
    <div className="gh-page">
      <BackArrow onClick={() => window.history.back()} title="Назад" />
      <section className="gh-hero" style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 18, opacity: 0.9 }}>GAMEHUBPARTY - ИГРЫ ДЛЯ КОМПАНИИ ОНЛАЙН</div>
        <div style={{ fontSize: 20, fontWeight: 800, marginTop: 6, lineHeight: 1.2 }}>
          Играй с друзьями прямо в браузере
        </div>
        <div style={{ fontSize: 16, opacity: 0.85, marginTop: 6 }}>Без регистрации</div>
      </section>

      <header className="gh-card" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18, padding: 14 }}>
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

      <div style={{ marginBottom: 16 }}>
        <Button variant="secondary" fullWidth onClick={() => navigate('/profile')}>
          Профиль и достижения
        </Button>
      </div>

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
            <button type="button" className="gh-btn gh-btn--muted gh-btn--mb" onClick={() => pickAvatar('')}>Фото из Telegram</button>
            <button type="button" className="gh-btn gh-btn--block" onClick={() => setShowAvatarPicker(false)}>Закрыть</button>
          </div>
        </div>
      )}

      {error && <p style={{ color: '#f88' }}>{error}</p>}
      <section style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            className="gh-btn gh-btn--flex"
            onClick={handleCreate}
            disabled={loading}
          >
            Создать комнату
          </button>
          <button
            type="button"
            className="gh-btn gh-btn--flex"
            disabled
            aria-hidden="true"
            tabIndex={-1}
            style={{ visibility: 'hidden' }}
          >
            Войти
          </button>
        </div>
      </section>
      <section className="gh-card" style={{ marginBottom: 16, padding: 12 }}>
        <p style={{ marginBottom: 8 }}>Войти по коду</p>
        {showAdminPassword ? (
          <form onSubmit={handleAdminPassword} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input
              type="password"
              className="gh-input gh-input--full"
              placeholder="Пароль"
              value={adminPassword}
              onChange={(e) => { setAdminPassword(e.target.value); setError(''); }}
            />
            <button type="submit" className="gh-btn gh-btn--block">Войти в админку</button>
            <button type="button" className="gh-btn gh-btn--block gh-btn--muted" onClick={() => { setShowAdminPassword(false); setAdminPassword(''); setError(''); }}>Отмена</button>
          </form>
        ) : (
          <form onSubmit={handleJoinByCode} style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              className="gh-input gh-input--grow"
              inputMode="numeric"
              maxLength={6}
              placeholder="000000"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            />
            <button type="submit" className="gh-btn" disabled={loading}>
              Войти
            </button>
          </form>
        )}
      </section>

      {hasLastRoom && (
        <section className="gh-card gh-fade-in" style={{ marginBottom: 16, padding: 14 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Последняя комната</div>
          <p style={{ fontSize: 13, opacity: 0.88, margin: '0 0 10px', lineHeight: 1.4 }}>
            Вернуться в ту же сессию, если сервер ещё держит лобби.
          </p>
          <Button variant="primary" fullWidth onClick={handleResumeRoom} disabled={loading}>
            Продолжить игру
          </Button>
        </section>
      )}

      {(miniAppLink || webInviteLink) && (
        <section className="gh-card" style={{ marginBottom: 16, padding: 14 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Пригласить друзей</div>
          <p style={{ fontSize: 13, opacity: 0.88, margin: '0 0 10px' }}>Ссылка на текущее приглашение (после создания комнаты).</p>
          <Button variant="secondary" fullWidth onClick={copyInviteHint}>
            Копировать ссылку
          </Button>
        </section>
      )}

      <section className="gh-card gh-fade-in" style={{ marginBottom: 16, padding: 14 }}>
        <div style={{ fontWeight: 800, marginBottom: 10 }}>Как это работает</div>
        <ol style={{ margin: 0, paddingLeft: 18, lineHeight: 1.55, fontSize: 14, opacity: 0.92 }}>
          <li>Создайте комнату или введите код от друзей.</li>
          <li>Хост выбирает игру и настройки в лобби.</li>
          <li>После старта каждый видит свою роль или карточку.</li>
          <li>Действия ведущего синхронизируются у всех в реальном времени.</li>
        </ol>
      </section>

      <section style={{ marginBottom: 16 }}>
        <button
          type="button"
          className="gh-btn gh-btn--block gh-btn--muted"
          onClick={() => setShowInstruction(true)}
          disabled={loading}
        >
          Инструкция
        </button>
      </section>

      <section className="gh-card" style={{ display: 'flex', gap: 8, marginBottom: 16, padding: 10 }}>
        <button type="button" className="gh-btn gh-btn--flex gh-btn--green" onClick={() => setShowSubStub(true)}>
          Купить подписку
        </button>
        <button type="button" className="gh-btn gh-btn--flex gh-btn--purple" onClick={() => setShowShopStub(true)}>
          Магазин
        </button>
      </section>

      {showSubStub && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, padding: 24 }}>
          <div style={{ background: 'var(--tg-theme-bg-color, #1a1a1a)', padding: 24, borderRadius: 12, maxWidth: 320 }}>
            <p style={{ marginBottom: 16 }}>Про убирает рекламу перед стартом, открывает премиальные словари и режимы (например, расширенную Мафию) для <strong>всех</strong> в вашей комнате на время сессии.</p>
            <button type="button" className="gh-btn gh-btn--block gh-btn--green gh-btn--mb" onClick={() => { setPro(Date.now() + 30 * 24 * 3600 * 1000); setInv(getInventory()); setShowSubStub(false); }}>Купить подписку</button>
            <button
              type="button"
              className="gh-btn gh-btn--block gh-btn--charcoal gh-btn--mb"
              onClick={async () => {
                const t = 'Промокод GameHub — спроси у друзей или у хоста!';
                try {
                  await navigator.clipboard.writeText(t);
                } catch (_) {
                  setError('Не удалось скопировать');
                }
              }}
            >
              Текст для друга (копировать)
            </button>
            <p style={{ marginBottom: 6 }}>Промокод</p>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <input type="text" className="gh-input gh-input--grow" placeholder="Введите промокод" value={promoCode} onChange={(e) => { setPromoCode(e.target.value); setPromoError(''); }} />
              <button type="button" className="gh-btn gh-btn--inline" onClick={applyPromoCode}>Применить</button>
            </div>
            {promoError && <p style={{ color: '#f88', fontSize: 14, marginBottom: 12 }}>{promoError}</p>}
            <button type="button" className="gh-btn gh-btn--block" onClick={() => setShowSubStub(false)}>Закрыть</button>
          </div>
        </div>
      )}
      <ShopModal open={showShopStub} onClose={() => setShowShopStub(false)} initialGameFilter="all" />

      <section className="gh-card" style={{ marginTop: 16, padding: 14 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Поддержать проект</div>
        <p style={{ fontSize: 13, opacity: 0.88, margin: '0 0 12px', lineHeight: 1.45 }}>
          Реклама запускается по требованию. Перед игрой показ может быть чаще — это настраивается площадкой, не чаще нескольких раз подряд без паузы.
        </p>
        <Button variant="primary" fullWidth onClick={handleShowAd} disabled={adLoading}>
          {adLoading ? 'Загрузка…' : 'Показать рекламу'}
        </Button>
      </section>

      <section className="gh-card" style={{ marginTop: 12, padding: 12 }}>
        <div style={{ fontSize: 13, opacity: 0.85, marginBottom: 8 }}>SEO навигация</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <button type="button" className="gh-btn gh-btn--compact gh-btn--charcoal" onClick={() => navigate('/seo')}>SEO</button>
          <button type="button" className="gh-btn gh-btn--compact gh-btn--charcoal" onClick={() => navigate('/how-to-play')}>Как играть</button>
          <button type="button" className="gh-btn gh-btn--compact gh-btn--charcoal" onClick={() => navigate('/games/spy')}>Шпион</button>
          <button type="button" className="gh-btn gh-btn--compact gh-btn--charcoal" onClick={() => navigate('/games/elias')}>Элиас</button>
          <button type="button" className="gh-btn gh-btn--compact gh-btn--charcoal" onClick={() => navigate('/games/mafia')}>Мафия</button>
          <button type="button" className="gh-btn gh-btn--compact gh-btn--charcoal" onClick={() => navigate('/games/truth_dare')}>Правда/действие</button>
          <button type="button" className="gh-btn gh-btn--compact gh-btn--charcoal" onClick={() => navigate('/privacy')}>Приватность</button>
          <button type="button" className="gh-btn gh-btn--compact gh-btn--charcoal" onClick={() => navigate('/rules')}>Правила</button>
        </div>
      </section>

      <Modal
        open={showInstruction}
        onClose={() => setShowInstruction(false)}
        title="Инструкция"
        width={360}
      >
        <div style={{ lineHeight: 1.6, opacity: 0.92, fontSize: 14 }}>
          <div>1) Создай комнату и разошли друзьям код или приглашение.</div>
          <div style={{ marginTop: 6 }}>2) В лобби хост выбирает игру и нажимает «Начать».</div>
          <div style={{ marginTop: 6 }}>3) После старта каждый видит свою карточку/роль.</div>
          <div style={{ marginTop: 6 }}>4) Управление в игре только у ведущего (остальные угадывают/голосуют).</div>
          <div style={{ marginTop: 6 }}>5) Кнопка «Назад» сверху слева дублирует действие «Назад».</div>
        </div>
        <div style={{ marginTop: 16 }}>
          <Button variant="secondary" fullWidth onClick={() => setShowInstruction(false)}>
            Понятно
          </Button>
        </div>
      </Modal>
    </div>
  );
}
