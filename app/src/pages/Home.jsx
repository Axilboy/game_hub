import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { canStartTrial, getInventory, getOrCreateReferralCode, redeemReferralCode, setPro, startTrialUnlock } from '../inventory';
import { api, getApiErrorMessage } from '../api';
import { getDisplayName, getAvatar, setAvatar, AVATAR_EMOJI_LIST, formatFriendListLine } from '../displayName';
import ShopModal from '../components/ShopModal';
import useSeo from '../hooks/useSeo';
import { showAdIfNeeded } from '../ads';
import { track } from '../analytics';
import { buildInviteLinks, shareInviteSmart } from '../invite';
import Modal from '../components/ui/Modal';
import JoinRoomModal from '../components/JoinRoomModal';
import PageLayout from '../components/layout/PageLayout';
import './homePage.css';
import AppHeaderRight from '../components/layout/AppHeaderRight';
import HomeLandingCarousel from '../components/HomeLandingCarousel';

const BASE_URL = import.meta.env.VITE_BASE_URL || (typeof window !== 'undefined' ? window.location.origin : '');
const HOME_SEO_BASE = (import.meta.env.VITE_BASE_URL || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/$/, '');
const HOME_OG_IMAGE = import.meta.env.VITE_OG_IMAGE || (HOME_SEO_BASE ? `${HOME_SEO_BASE}/og-share.svg` : undefined);
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

/** До `max`: сначала онлайн, затем офлайн. */
function buildFriendsPreview(friends, max) {
  const online = friends.filter((f) => f.online);
  const offline = friends.filter((f) => !f.online);
  const out = [];
  for (const f of online) {
    if (out.length >= max) break;
    out.push(f);
  }
  for (const f of offline) {
    if (out.length >= max) break;
    out.push(f);
  }
  return out;
}

function friendStatusLine(f) {
  if (!f.online) return 'Не в сети';
  if (f.location === 'playing') return 'В игре';
  if (f.location === 'home') return 'На главной';
  if (f.location === 'lobby') return 'В лобби';
  return '';
}

export default function Home({ user, onCreateRoom, onJoinByCode, onJoinByInvite, onResumeLastRoom }) {
  const navigate = useNavigate();
  useSeo({
    title: 'GameHub — Шпион, Элиас, Мафия и игры для компании онлайн',
    description:
      'GameHub: комната для друзей в Telegram и браузере. Шпион, Элиас (Alias), Мафия, Правда или действие, Бункер — создайте лобби и играйте по коду или ссылке.',
    canonical: HOME_SEO_BASE ? `${HOME_SEO_BASE}/` : undefined,
    robots: 'index, follow',
    ogImage: HOME_OG_IMAGE,
    siteName: 'GameHub',
    keywords:
      'GameHub, игры для компании онлайн, Шпион, Элиас, Alias, Мафия, Правда или действие, Бункер, Telegram, играть онлайн',
  });

  useEffect(() => {
    if (!HOME_SEO_BASE) return undefined;
    const scriptId = 'gh-home-ld-json';
    const json = {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebSite',
          name: 'GameHub',
          url: HOME_SEO_BASE,
          description:
            'Онлайн-комнаты для настольных и словесных игр: Шпион, Элиас, Мафия и другие режимы в Telegram и браузере.',
          inLanguage: 'ru-RU',
          publisher: {
            '@type': 'Organization',
            name: 'GameHub',
            url: HOME_SEO_BASE,
          },
        },
      ],
    };
    let s = document.getElementById(scriptId);
    if (!s) {
      s = document.createElement('script');
      s.id = scriptId;
      s.type = 'application/ld+json';
      document.head.appendChild(s);
    }
    s.text = JSON.stringify(json);
    return () => {
      const el = document.getElementById(scriptId);
      if (el?.parentNode) el.parentNode.removeChild(el);
    };
  }, []);
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
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackContact, setFeedbackContact] = useState('');
  const [feedbackSending, setFeedbackSending] = useState(false);
  const [feedbackDone, setFeedbackDone] = useState(false);
  /** @type {null | 'bug' | 'suggestion'} */
  const [feedbackCategory, setFeedbackCategory] = useState(null);
  const [showThanks, setShowThanks] = useState(false);
  const [adLoading, setAdLoading] = useState(false);
  const [hasRematchRoom, setHasRematchRoom] = useState(false);
  const [inviteIssue, setInviteIssue] = useState(false);
  const [homeQrJoinOpen, setHomeQrJoinOpen] = useState(false);
  const [friendsList, setFriendsList] = useState([]);
  const [friendLobbyJoining, setFriendLobbyJoining] = useState(null);
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
      setHasRematchRoom(Boolean(sessionStorage.getItem('gameHub_rematchRoomId')));
    } catch (_) {
      setHasRematchRoom(false);
    }
  }, []);

  useEffect(() => {
    try {
      if (!localStorage.getItem('gh_beta_thanks_v1')) {
        setShowThanks(true);
      }
    } catch (_) {
      setShowThanks(true);
    }
  }, []);
  const hasLastRoom = Boolean(safeSessionGet('gameHub_lastRoomId'));

  const myPlayerId = user?.id != null ? String(user.id) : '';

  const loadFriendsForHome = useCallback(async () => {
    if (!myPlayerId || String(myPlayerId).startsWith('web_')) {
      setFriendsList([]);
      return;
    }
    try {
      const r = await api.get(`/friends/list?playerId=${encodeURIComponent(myPlayerId)}`);
      const list = Array.isArray(r.friends) ? r.friends : [];
      setFriendsList(list);
    } catch (_) {
      setFriendsList([]);
    }
  }, [myPlayerId]);

  useEffect(() => {
    loadFriendsForHome();
  }, [loadFriendsForHome]);

  useEffect(() => {
    if (!myPlayerId) return undefined;
    const t = setInterval(loadFriendsForHome, 12_000);
    const onFocus = () => loadFriendsForHome();
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(t);
      window.removeEventListener('focus', onFocus);
    };
  }, [myPlayerId, loadFriendsForHome]);

  const handleJoinFriendLobby = async (f) => {
    if (!f?.joinInviteToken || !onJoinByInvite) return;
    setError('');
    setFriendLobbyJoining(String(f.id));
    setLoading(true);
    try {
      await onJoinByInvite(f.joinInviteToken);
      navigate('/lobby');
    } catch (e) {
      setError(getApiErrorMessage(e, 'Не удалось войти в комнату друга'));
    } finally {
      setFriendLobbyJoining(null);
      setLoading(false);
    }
  };

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

  const dismissThanks = () => {
    try {
      localStorage.setItem('gh_beta_thanks_v1', '1');
    } catch (_) {}
    setShowThanks(false);
  };

  const closeFeedback = useCallback(() => {
    setShowFeedback(false);
    setFeedbackCategory(null);
  }, []);

  const handleJoinFromQrModal = useCallback(
    async (payload) => {
      setError('');
      setInviteIssue(false);
      if (payload.kind === 'code' && payload.value.trim() === ADMIN_CODE) {
        setHomeQrJoinOpen(false);
        setShowAdminPassword(true);
        return;
      }
      try {
        if (payload.kind === 'invite') {
          await onJoinByInvite(payload.value);
        } else {
          await onJoinByCode(payload.value);
        }
        setHomeQrJoinOpen(false);
        navigate('/lobby');
      } catch (e) {
        if (payload.kind === 'invite' && isInviteExpiredError(e)) {
          setInviteIssue(true);
        }
        throw e;
      }
    },
    [navigate, onJoinByCode, onJoinByInvite],
  );

  const submitFeedback = async () => {
    const text = feedbackText.trim();
    if (text.length < 3) {
      setError('Напишите хотя бы пару слов.');
      return;
    }
    setError('');
    setFeedbackSending(true);
    setFeedbackDone(false);
    try {
      await api.post('/feedback', {
        message: text,
        contact: feedbackContact.trim(),
        playerId: user?.id != null ? String(user.id) : '',
        displayName: shownName,
        ...(feedbackCategory ? { category: feedbackCategory } : {}),
      });
      track('feedback_submit', { ok: true, len: text.length });
      setFeedbackDone(true);
      setFeedbackText('');
      setFeedbackContact('');
      setFeedbackCategory(null);
    } catch (e) {
      track('feedback_submit', { ok: false });
      setError(getApiErrorMessage(e, 'Не удалось отправить'));
    } finally {
      setFeedbackSending(false);
    }
  };

  return (
    <PageLayout title="GameHub" titleHref="/" right={<AppHeaderRight />}>
      <div className="home-page">
        <HomeLandingCarousel />

        {showAvatarPicker && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, padding: 24 }}>
            <div className="home-modal">
              <p className="home-panel__title" style={{ marginBottom: 12 }}>Выберите аватар</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 16 }}>
                {AVATAR_EMOJI_LIST.map((emoji) => (
                  <button key={emoji} type="button" onClick={() => pickAvatar(emoji)} style={{ fontSize: 28, padding: 8, background: avatarState === emoji ? 'rgba(34,197,94,0.35)' : 'transparent', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
                    {emoji}
                  </button>
                ))}
              </div>
              <button type="button" className="home-btn home-btn--ghost home-btn--mb" onClick={() => pickAvatar('')}>Фото из Telegram</button>
              <button type="button" className="home-btn home-btn--primary" onClick={() => setShowAvatarPicker(false)}>Закрыть</button>
            </div>
          </div>
        )}

        {error && <p role="alert" aria-live="assertive" style={{ color: '#f87171', marginBottom: 12 }}>{error}</p>}
        {inviteIssue && (
          <section className="home-alert gh-fade-in">
            <div className="home-alert__title">Приглашение больше не работает</div>
            <p className="home-alert__text">
              Комната могла закрыться или ссылка устарела. Быстрые варианты:
            </p>
            <div className="home-alert__row">
              <button
                type="button"
                className="home-btn home-btn--secondary home-btn--inline"
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
                className="home-btn home-btn--primary home-btn--inline"
                onClick={async () => {
                  track('invite_fallback_cta', { action: 'create_room' });
                  await handleCreate();
                }}
                disabled={loading}
              >
                НАЧНИ ИГРУ
              </button>
              {hasRematchRoom && (
                <button
                  type="button"
                  className="home-btn home-btn--secondary home-btn--inline"
                  onClick={handleRematchRejoin}
                  disabled={loading}
                >
                  Рематч
                </button>
              )}
            </div>
          </section>
        )}

        <div className="home-ctas">
          {hasLastRoom && (
            <button
              type="button"
              className="home-btn home-btn--ghost"
              onClick={handleResumeRoom}
              disabled={loading}
            >
              Вернуться в игру
            </button>
          )}
          <button
            type="button"
            className="home-btn home-btn--primary"
            onClick={handleCreate}
            disabled={loading}
            aria-label="Создать комнату и начать игру"
          >
            НАЧНИ ИГРУ
          </button>
        </div>

        <section className="home-panel home-join-compact">
          <div className="home-panel__title">Войти в комнату</div>
          <p className="home-panel__text" style={{ marginBottom: 10 }}>
            Введите шестизначный ID или нажмите «Войти по QR» — камера или ссылка/код вручную.
          </p>
          {showAdminPassword ? (
            <form onSubmit={handleAdminPassword} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input
                type="password"
                className="gh-input gh-input--full"
                placeholder="Пароль"
                value={adminPassword}
                onChange={(e) => { setAdminPassword(e.target.value); setError(''); }}
              />
              <button type="submit" className="home-btn home-btn--primary">Войти в админку</button>
              <button type="button" className="home-btn home-btn--secondary" onClick={() => { setShowAdminPassword(false); setAdminPassword(''); setError(''); }}>Отмена</button>
            </form>
          ) : (
            <>
              <form onSubmit={handleJoinByCode} className="home-join-row">
                <input
                  ref={codeInputRef}
                  type="text"
                  className="gh-input"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="ID"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  aria-label="ID комнаты, 6 цифр"
                  style={{ flex: 1, minWidth: 0 }}
                />
                <button type="submit" className="home-btn home-btn--primary home-btn--inline" disabled={loading}>
                  Войти
                </button>
              </form>
              <button
                type="button"
                className="home-btn home-btn--secondary"
                style={{ marginTop: 10, width: '100%' }}
                onClick={() => setHomeQrJoinOpen(true)}
              >
                Войти по QR
              </button>
            </>
          )}
        </section>

        {friendsList.length > 0 ? (
          <section className="home-panel home-friends">
            <div className="home-friends__header">
              <h2 className="home-panel__title home-friends__title">Друзья</h2>
              <button
                type="button"
                className="home-friends__allLink"
                onClick={() => navigate('/friends')}
              >
                Все друзья
              </button>
            </div>
            <ul className="home-friends__list">
              {buildFriendsPreview(friendsList, 3).map((f) => (
                <li key={f.id} className="home-friends__row">
                  <span
                    className={`home-friends__dot ${f.online ? 'home-friends__dot--on' : 'home-friends__dot--off'}`}
                    aria-hidden
                  />
                  <div className="home-friends__meta">
                    <div className="home-friends__name">{formatFriendListLine(f)}</div>
                    <div className="home-friends__sub">{friendStatusLine(f)}</div>
                  </div>
                  {f.joinInviteToken ? (
                    <button
                      type="button"
                      className="home-btn home-btn--primary home-btn--inline home-friends__joinBtn"
                      onClick={() => handleJoinFriendLobby(f)}
                      disabled={loading || friendLobbyJoining === String(f.id)}
                    >
                      {friendLobbyJoining === String(f.id) ? '…' : 'В лобби'}
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <JoinRoomModal
          open={homeQrJoinOpen}
          onClose={() => setHomeQrJoinOpen(false)}
          onJoin={handleJoinFromQrModal}
          title="Войти по QR"
          openWithScanner={homeQrJoinOpen}
        />

        {hasRematchRoom && (
          <section className="home-panel gh-fade-in">
            <div className="home-panel__title">Быстрый рематч</div>
            <p className="home-panel__text" style={{ marginBottom: 12 }}>
              Последний матч завершился. Вернитесь в лобби одним нажатием.
            </p>
            <button type="button" className="home-btn home-btn--primary" onClick={handleRematchRejoin} disabled={loading}>
              Вернуться на рематч
            </button>
          </section>
        )}

        {(miniAppLink || webInviteLink) && (
          <section className="home-panel">
            <div className="home-panel__title">Пригласить друзей</div>
            <p className="home-panel__text">Ссылка на текущее приглашение (после создания комнаты).</p>
            <button type="button" className="home-btn home-btn--secondary" onClick={copyInviteHint}>
              Поделиться ссылкой
            </button>
          </section>
        )}

        <section className="home-panel gh-fade-in">
          <div className="home-panel__title">Сценарий за 30 секунд</div>
          <ol className="home-scenario">
            <li className="home-scenario__item">Нажми «НАЧНИ ИГРУ» и создай комнату.</li>
            <li className="home-scenario__item">
              Поделись ссылкой · покажи QR · продиктуй ID комнаты друзьям.
            </li>
            <li className="home-scenario__item">Выбери и настрой игру в лобби.</li>
          </ol>
        </section>

        <section className="home-panel home-row" style={{ padding: 14 }}>
          <button type="button" className="home-btn home-btn--flex home-btn--primary" onClick={() => { track('paywall_open', { source: 'home' }); setShowSubStub(true); }}>
            Купить премиум
          </button>
          <button type="button" className="home-btn home-btn--flex home-btn--secondary" onClick={() => setShowShopStub(true)}>
            Магазин
          </button>
        </section>

        {showSubStub && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, padding: 24 }}>
            <div className="home-modal">
              <p style={{ marginBottom: 16, lineHeight: 1.5, fontSize: 14 }}>Премиум убирает рекламу перед стартом, открывает премиальные словари и режимы (например, расширенную Мафию) для <strong>всех</strong> в вашей комнате на время сессии.</p>
              <ul style={{ marginTop: 0, marginBottom: 12, paddingLeft: 18, fontSize: 13, opacity: 0.92, lineHeight: 1.45 }}>
                <li>Без рекламы перед стартом.</li>
                <li>Премиальные словари и режимы.</li>
                <li>Ценность на всю комнату в текущей сессии.</li>
              </ul>
              <button
                type="button"
                className="home-btn home-btn--primary home-btn--mb"
                onClick={() => {
                  setPro(Date.now() + 30 * 24 * 3600 * 1000);
                  track('paywall_buy_click', { source: 'home', plan: 'pro_30d' });
                  setInv(getInventory());
                  setShowSubStub(false);
                }}
              >
                Купить премиум
              </button>
              <button
                type="button"
                className="home-btn home-btn--ghost home-btn--mb"
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
                className="home-btn home-btn--ghost home-btn--mb"
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
              <p style={{ marginBottom: 6, fontSize: 14, fontWeight: 600 }}>Промокод</p>
              <div className="home-form-row" style={{ marginBottom: 12 }}>
                <input type="text" className="gh-input gh-input--grow" placeholder="Введите промокод" value={promoCode} onChange={(e) => { setPromoCode(e.target.value); setPromoError(''); }} />
                <button type="button" className="home-btn home-btn--primary home-btn--inline" onClick={applyPromoCode}>Применить</button>
              </div>
              {promoError && <p style={{ color: '#f87171', fontSize: 14, marginBottom: 12 }}>{promoError}</p>}
              <p style={{ marginBottom: 6, fontSize: 14, fontWeight: 600 }}>Реферальный код друга</p>
              <div className="home-form-row" style={{ marginBottom: 12 }}>
                <input
                  type="text"
                  className="gh-input gh-input--grow"
                  placeholder="GH-XXXXX"
                  value={referralCode}
                  onChange={(e) => { setReferralCode(e.target.value); setPromoError(''); }}
                />
                <button
                  type="button"
                  className="home-btn home-btn--primary home-btn--inline"
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
                Ваш код: <strong>{myReferralCode}</strong> (бонус +12ч Премиум для друга)
              </p>
              <button
                type="button"
                className="home-btn home-btn--secondary home-btn--mb"
                onClick={() => {
                  track('paywall_restore_click', { source: 'home' });
                  setInv(getInventory());
                }}
              >
                Восстановить покупки
              </button>
              <button type="button" className="home-btn home-btn--primary" onClick={() => setShowSubStub(false)}>Закрыть</button>
            </div>
          </div>
        )}
        <ShopModal open={showShopStub} onClose={() => setShowShopStub(false)} initialGameFilter="all" user={user} />

        <section className="home-panel" style={{ marginTop: 8 }}>
          <div className="home-panel__title">Поддержать проект</div>
          <p className="home-panel__text">
            Помочь можно просто: посмотреть короткую рекламу по кнопке ниже — так проект получает поддержку от площадки.
            Или напишите обратную связь: идеи, замечания или баги — нам важно знать, что улучшить.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button type="button" className="home-btn home-btn--primary" onClick={handleShowAd} disabled={adLoading}>
              {adLoading ? 'Загрузка…' : 'Показать рекламу'}
            </button>
            <button
              type="button"
              className="home-btn home-btn--secondary"
              onClick={() => {
                dismissThanks();
                setFeedbackCategory(null);
                setFeedbackDone(false);
                setShowFeedback(true);
              }}
              disabled={loading}
            >
              Обратная связь
            </button>
          </div>
        </section>

        <Modal
          open={showThanks}
          onClose={dismissThanks}
          title="Спасибо!"
          width={360}
        >
          <p style={{ marginBottom: 12, lineHeight: 1.55, fontSize: 14, opacity: 0.92 }}>
            Спасибо за поддержку и тестирование. У вас включён <strong>Премиум</strong>, чтобы можно было попробовать все режимы бесплатно.
            Будем благодарны, если поделитесь проектом с друзьями и заглянете в блок «Поддержать проект» — там можно посмотреть рекламу или написать отзыв.
          </p>
          <button type="button" className="home-btn home-btn--primary" onClick={dismissThanks}>
            Обязательно
          </button>
        </Modal>

        <Modal
          open={showFeedback}
          onClose={closeFeedback}
          title="Обратная связь"
          width={400}
        >
          <>
            <p style={{ marginTop: 0, fontSize: 13, opacity: 0.88, lineHeight: 1.45 }}>
              Сообщения сохраняются на сервере для команды проекта. Категория по желанию.
            </p>
            {feedbackDone ? (
              <p style={{ color: '#22c55e', fontSize: 14 }}>Спасибо! Сообщение отправлено.</p>
            ) : (
              <>
                <label style={{ display: 'block', fontSize: 13, marginBottom: 6 }}>
                  Сообщение
                </label>
                <textarea
                  className="gh-input gh-input--full"
                  rows={5}
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  placeholder="Например: не хватает кнопки… или нашёл ошибку в…"
                  style={{ resize: 'vertical', minHeight: 100, marginBottom: 12 }}
                />
                <div style={{ marginBottom: 12 }}>
                  <span style={{ display: 'block', fontSize: 12, opacity: 0.85, marginBottom: 6 }}>Категория (необязательно)</span>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className={`home-btn home-btn--inline ${feedbackCategory === 'bug' ? 'home-btn--primary' : 'home-btn--secondary'}`}
                      onClick={() => setFeedbackCategory((c) => (c === 'bug' ? null : 'bug'))}
                    >
                      Баг
                    </button>
                    <button
                      type="button"
                      className={`home-btn home-btn--inline ${feedbackCategory === 'suggestion' ? 'home-btn--primary' : 'home-btn--secondary'}`}
                      onClick={() => setFeedbackCategory((c) => (c === 'suggestion' ? null : 'suggestion'))}
                    >
                      Предложение
                    </button>
                  </div>
                </div>
                <label style={{ display: 'block', fontSize: 13, marginBottom: 6 }}>
                  Контакт (необязательно)
                </label>
                <input
                  type="text"
                  className="gh-input gh-input--full"
                  value={feedbackContact}
                  onChange={(e) => setFeedbackContact(e.target.value)}
                  placeholder="@username или email"
                  style={{ marginBottom: 12 }}
                />
                <button type="button" className="home-btn home-btn--primary home-btn--mb" onClick={submitFeedback} disabled={feedbackSending}>
                  {feedbackSending ? 'Отправка…' : 'Отправить'}
                </button>
              </>
            )}
            <div style={{ marginTop: 12 }}>
              <button type="button" className="home-btn home-btn--secondary" onClick={closeFeedback}>
                {feedbackDone ? 'Закрыть' : 'Отмена'}
              </button>
            </div>
          </>
        </Modal>
      </div>
    </PageLayout>
  );
}
