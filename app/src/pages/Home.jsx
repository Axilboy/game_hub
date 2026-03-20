import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { canStartTrial, getInventory, getOrCreateReferralCode, redeemReferralCode, setPro, startTrialUnlock } from '../inventory';
import { api, getApiErrorMessage } from '../api';
import { getDisplayName, getAvatar, setAvatar, AVATAR_EMOJI_LIST } from '../displayName';
import ShopModal from '../components/ShopModal';
import useSeo from '../hooks/useSeo';
import { showAdIfNeeded } from '../ads';
import { track } from '../analytics';
import { buildInviteLinks, shareInviteSmart } from '../invite';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import PageLayout from '../components/layout/PageLayout';

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

function inviteJoinErrorMessage(err) {
  const msg = getApiErrorMessage(err, '').toLowerCase();
  if (msg.includes('room not found') || msg.includes('комната не найдена')) {
    return 'Ссылка-приглашение устарела или комната уже закрыта.';
  }
  if (msg.includes('not in room')) {
    return 'Вы больше не состоите в этой комнате. Войдите по коду или создайте новую.';
  }
  return 'Не удалось войти по приглашению';
}

function isInviteExpiredError(err) {
  const msg = getApiErrorMessage(err, '').toLowerCase();
  return msg.includes('room not found') || msg.includes('комната не найдена') || msg.includes('not in room');
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
  const [referralCode, setReferralCode] = useState('');
  const [showShopStub, setShowShopStub] = useState(false);
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [displayNameState, setDisplayNameState] = useState(getDisplayName() || '');
  const [avatarState, setAvatarState] = useState(getAvatar() || '');
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [showInstruction, setShowInstruction] = useState(false);
  const [adLoading, setAdLoading] = useState(false);
  const [hasLastRoom, setHasLastRoom] = useState(false);
  const [hasRematchRoom, setHasRematchRoom] = useState(false);
  const [inviteIssue, setInviteIssue] = useState(false);
  const codeInputRef = useRef(null);
  const shownName = displayNameState || user?.first_name || 'Игрок';
  const myReferralCode = getOrCreateReferralCode();

  const inviteToken = safeSessionGet('inviteToken');
  const { miniAppLink, webLink: webInviteLink } = buildInviteLinks({
    inviteToken,
    baseUrl: BASE_URL,
    botUsername: BOT_USERNAME,
  });

  useEffect(() => {
    try {
      setHasLastRoom(Boolean(sessionStorage.getItem('gameHub_lastRoomId')));
      setHasRematchRoom(Boolean(sessionStorage.getItem('gameHub_rematchRoomId')));
    } catch (_) {
      setHasLastRoom(false);
      setHasRematchRoom(false);
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
        .then(() => {
          setInviteIssue(false);
          navigate('/lobby');
        })
        .catch((e) => {
          track('invite_expired_or_invalid', { reason: String(e?.message || 'unknown') });
          setInviteIssue(isInviteExpiredError(e));
          setError(inviteJoinErrorMessage(e));
        })
        .finally(() => setLoading(false));
    }
  }, []);

  const handleCreate = async () => {
    setError('');
    setInviteIssue(false);
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
    setInviteIssue(false);
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

  const handleRematchRejoin = async () => {
    setError('');
    setInviteIssue(false);
    setLoading(true);
    try {
      track('rematch_rejoin_click', { source: 'home' });
      const r = await onResumeLastRoom?.();
      if (r) {
        try {
          sessionStorage.removeItem('gameHub_rematchRoomId');
        } catch (_) {}
        setHasRematchRoom(false);
        navigate('/lobby');
      } else {
        setError('Рематч-комната уже недоступна');
      }
    } catch (_) {
      setError('Рематч-комната недоступна');
    } finally {
      setLoading(false);
    }
  };

  const copyInviteHint = async () => {
    const result = await shareInviteSmart({
      roomName: null,
      miniAppLink,
      webLink: webInviteLink,
      preferTelegram: true,
    });
    if (result.ok) {
      track('invite_share', { source: 'home', mode: result.mode || 'unknown' });
      return;
    }
    setError('Не удалось поделиться ссылкой');
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
        track('paywall_promocode_success', { source: 'home' });
        setInv(getInventory());
        setPromoCode('');
        setShowSubStub(false);
      }
    } catch (e) {
      track('paywall_promocode_fail', { source: 'home' });
      setPromoError('Неверный или использованный промокод');
    }
  };

  const pickAvatar = (emoji) => {
    setAvatar(emoji || '');
    setAvatarState(emoji || '');
    setShowAvatarPicker(false);
  };

  return (
    <PageLayout title="GameHub" onBack={() => window.history.back()}>
      <section className="gh-hero" style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 18, opacity: 0.9 }}>GAMEHUBPARTY - ИГРЫ ДЛЯ КОМПАНИИ ОНЛАЙН</div>
        <div style={{ fontSize: 20, fontWeight: 800, marginTop: 6, lineHeight: 1.2 }}>
          Играй с друзьями прямо в браузере
        </div>
        <div style={{ fontSize: 16, opacity: 0.85, marginTop: 6 }}>Без регистрации</div>
      </section>

      <header
        className="gh-card"
        style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18, padding: 14, cursor: 'pointer' }}
        onClick={() => navigate('/profile')}
        title="Открыть профиль и достижения"
      >
        <div style={{ flexShrink: 0 }}>
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
          <div style={{ fontWeight: 'bold', fontSize: 18 }}>{shownName}</div>
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
            <button type="button" className="gh-btn gh-btn--muted gh-btn--mb" onClick={() => pickAvatar('')}>Фото из Telegram</button>
            <button type="button" className="gh-btn gh-btn--block" onClick={() => setShowAvatarPicker(false)}>Закрыть</button>
          </div>
        </div>
      )}

      {error && <p role="alert" aria-live="assertive" style={{ color: '#f88' }}>{error}</p>}
      {inviteIssue && (
        <section className="gh-card gh-fade-in" style={{ marginBottom: 14, padding: 12, border: '1px solid rgba(255,120,120,0.35)' }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Приглашение больше не работает</div>
          <p style={{ fontSize: 13, opacity: 0.9, margin: '0 0 10px', lineHeight: 1.4 }}>
            Комната могла закрыться или ссылка устарела. Быстрые варианты:
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="gh-btn gh-btn--muted"
              onClick={() => {
                codeInputRef.current?.focus();
                setInviteIssue(false);
                track('invite_fallback_cta', { action: 'focus_code' });
              }}
            >
              Ввести код
            </button>
            <button
              type="button"
              className="gh-btn"
              onClick={async () => {
                track('invite_fallback_cta', { action: 'create_room' });
                await handleCreate();
              }}
              disabled={loading}
            >
              Создать комнату
            </button>
            {hasRematchRoom && (
              <button
                type="button"
                className="gh-btn gh-btn--muted"
                onClick={handleRematchRejoin}
                disabled={loading}
              >
                Рематч
              </button>
            )}
          </div>
        </section>
      )}
      <section style={{ marginBottom: 12 }}>
        <button
          type="button"
          className="gh-btn gh-btn--block"
          onClick={handleCreate}
          disabled={loading}
          aria-label="Начать игру и создать комнату"
        >
          Начать игру
        </button>
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
              ref={codeInputRef}
              type="text"
              className="gh-input gh-input--grow"
              inputMode="numeric"
              maxLength={6}
              placeholder="000000"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              aria-label="Код комнаты из 6 цифр"
            />
            <button type="submit" className="gh-btn" disabled={loading}>
              Войти
            </button>
          </form>
        )}
      </section>

      {hasRematchRoom && (
        <section className="gh-card gh-fade-in" style={{ marginBottom: 16, padding: 14 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Быстрый рематч</div>
          <p style={{ fontSize: 13, opacity: 0.88, margin: '0 0 10px', lineHeight: 1.4 }}>
            Последний матч завершился. Вернитесь в лобби одним нажатием.
          </p>
          <Button variant="primary" fullWidth onClick={handleRematchRejoin} disabled={loading}>
            Вернуться на рематч
          </Button>
        </section>
      )}

      {hasLastRoom && !hasRematchRoom && (
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
            Поделиться ссылкой
          </Button>
        </section>
      )}

      <section className="gh-card gh-fade-in" style={{ marginBottom: 16, padding: 14 }}>
        <div style={{ fontWeight: 800, marginBottom: 10 }}>Сценарий за 30 секунд</div>
        <ol style={{ margin: '0 0 12px', paddingLeft: 18, lineHeight: 1.5, fontSize: 13, opacity: 0.92 }}>
          <li>Нажмите «Создать комнату».</li>
          <li>Отправьте ссылку в чат (кнопка «Поделиться»).</li>
          <li>Выберите игру и нажмите «Начать».</li>
        </ol>
      </section>

      <section className="gh-card gh-fade-in" style={{ marginBottom: 16, padding: 14 }}>
        <div style={{ fontWeight: 800, marginBottom: 10 }}>3 шага до игры</div>
        <ol style={{ margin: 0, paddingLeft: 18, lineHeight: 1.55, fontSize: 14, opacity: 0.92 }}>
          <li>Создайте комнату или введите код от друзей.</li>
          <li>Хост выбирает игру и настройки в лобби.</li>
          <li>После старта каждый видит свою роль или карточку.</li>
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
        <button type="button" className="gh-btn gh-btn--flex gh-btn--green" onClick={() => { track('paywall_open', { source: 'home' }); setShowSubStub(true); }}>
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
            <ul style={{ marginTop: 0, marginBottom: 12, paddingLeft: 18, fontSize: 13, opacity: 0.92, lineHeight: 1.45 }}>
              <li>Без рекламы перед стартом.</li>
              <li>Премиальные словари и режимы.</li>
              <li>Ценность на всю комнату в текущей сессии.</li>
            </ul>
            <button
              type="button"
              className="gh-btn gh-btn--block gh-btn--green gh-btn--mb"
              onClick={() => {
                setPro(Date.now() + 30 * 24 * 3600 * 1000);
                track('paywall_buy_click', { source: 'home', plan: 'pro_30d' });
                setInv(getInventory());
                setShowSubStub(false);
              }}
            >
              Купить подписку
            </button>
            <button
              type="button"
              className="gh-btn gh-btn--block gh-btn--charcoal gh-btn--mb"
              onClick={() => {
                const started = startTrialUnlock();
                if (!started.ok) {
                  setPromoError('Пробный период уже активировался недавно. Попробуйте позже.');
                  track('paywall_trial_rejected', { source: 'home' });
                  return;
                }
                track('paywall_trial_unlock', { source: 'home', hours: 24 });
                setInv(started.inv || getInventory());
                setShowSubStub(false);
              }}
              disabled={!canStartTrial()}
            >
              Пробный unlock на 24ч
            </button>
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
            <p style={{ marginBottom: 6 }}>Реферальный код друга</p>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <input
                type="text"
                className="gh-input gh-input--grow"
                placeholder="GH-XXXXX"
                value={referralCode}
                onChange={(e) => { setReferralCode(e.target.value); setPromoError(''); }}
              />
              <button
                type="button"
                className="gh-btn gh-btn--inline"
                onClick={() => {
                  const r = redeemReferralCode(referralCode);
                  if (!r.ok) {
                    setPromoError(r.reason === 'self' ? 'Нельзя ввести собственный код' : 'Код не принят');
                    track('paywall_referral_fail', { source: 'home', reason: r.reason || 'unknown' });
                    return;
                  }
                  setReferralCode('');
                  setPromoError('');
                  setInv(getInventory());
                  track('paywall_referral_success', { source: 'home' });
                }}
              >
                Активировать
              </button>
            </div>
            <p style={{ margin: '0 0 12px', fontSize: 12, opacity: 0.82 }}>
              Ваш код: <strong>{myReferralCode}</strong> (бонус +12ч Про для друга)
            </p>
            <button
              type="button"
              className="gh-btn gh-btn--block gh-btn--muted gh-btn--mb"
              onClick={() => {
                track('paywall_restore_click', { source: 'home' });
                setInv(getInventory());
              }}
            >
              Восстановить покупки
            </button>
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

      <details className="gh-card" style={{ marginTop: 12, padding: 12 }}>
        <summary style={{ cursor: 'pointer', fontSize: 13, opacity: 0.85 }}>Дополнительные страницы</summary>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 }}>
          <button type="button" className="gh-btn gh-btn--compact gh-btn--charcoal" onClick={() => navigate('/seo')}>SEO</button>
          <button type="button" className="gh-btn gh-btn--compact gh-btn--charcoal" onClick={() => navigate('/how-to-play')}>Как играть</button>
          <button type="button" className="gh-btn gh-btn--compact gh-btn--charcoal" onClick={() => navigate('/games/spy')}>Шпион</button>
          <button type="button" className="gh-btn gh-btn--compact gh-btn--charcoal" onClick={() => navigate('/games/elias')}>Элиас</button>
          <button type="button" className="gh-btn gh-btn--compact gh-btn--charcoal" onClick={() => navigate('/games/mafia')}>Мафия</button>
          <button type="button" className="gh-btn gh-btn--compact gh-btn--charcoal" onClick={() => navigate('/games/truth_dare')}>Правда/действие</button>
          <button type="button" className="gh-btn gh-btn--compact gh-btn--charcoal" onClick={() => navigate('/privacy')}>Приватность</button>
          <button type="button" className="gh-btn gh-btn--compact gh-btn--charcoal" onClick={() => navigate('/rules')}>Правила</button>
        </div>
      </details>

      <Modal
        open={showInstruction}
        onClose={() => setShowInstruction(false)}
        title="Инструкция"
        width={360}
      >
        <div style={{ lineHeight: 1.6, opacity: 0.92, fontSize: 14 }}>
          <div>1) Нажмите «Начать игру», чтобы создать комнату.</div>
          <div style={{ marginTop: 6 }}>2) Поделитесь ссылкой или дайте друзьям код из блока «Войти по коду».</div>
          <div style={{ marginTop: 6 }}>3) В лобби выберите игру и настройте параметры.</div>
          <div style={{ marginTop: 6 }}>4) Профиль открывается нажатием на карточку с аватаром и именем.</div>
          <div style={{ marginTop: 6 }}>5) Магазин открывается с главной, покупки сохраняются локально.</div>
        </div>
        <div style={{ marginTop: 16 }}>
          <Button variant="secondary" fullWidth onClick={() => setShowInstruction(false)}>
            Понятно
          </Button>
        </div>
      </Modal>
    </PageLayout>
  );
}
