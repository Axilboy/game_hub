import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import useSeo from '../../hooks/useSeo';
import PageLayout from '../layout/PageLayout';
import AppHeaderRight from '../layout/AppHeaderRight';
import JoinRoomModal from '../JoinRoomModal';
import { useTelegram } from '../../useTelegram';
import { track } from '../../analytics';
import './gamePromoLanding.css';

const baseUrl = (import.meta.env.VITE_BASE_URL || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/$/, '');
const defaultOgImage = import.meta.env.VITE_OG_IMAGE || (baseUrl ? `${baseUrl}/og-share.svg` : undefined);
const BOT_USERNAME = import.meta.env.VITE_BOT_USERNAME || '';

/**
 * Промо-лендинг одной игры: отдельная визуальная тема + SEO для точечной рекламы.
 */
export default function GamePromoLanding({
  theme,
  seoTitle,
  seoDescription,
  eyebrow,
  mascotEmoji = '🎮',
  heroTitle,
  heroSubtitle,
  steps = [],
  sections = [],
  /** id игры для автолобби (spy, mafia, elias, truth_dare, bunker) */
  presetGameId,
  /** async ({ kind: 'code'|'invite', value }) — из App: join + navigate lobby */
  onJoin,
  primaryCtaLabel = 'Начать игру',
  showTelegramCta = true,
  /** Заголовок в общей шапке (как на главной) */
  headerTitle = 'GameHub',
}) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { user } = useTelegram();
  const canonical = baseUrl ? `${baseUrl}${pathname}` : undefined;
  const [joinOpen, setJoinOpen] = useState(false);

  useSeo({
    title: seoTitle,
    description: seoDescription,
    canonical,
    robots: 'index, follow',
    ogImage: defaultOgImage,
    ogType: 'website',
    siteName: 'GameHub',
  });

  useEffect(() => {
    const scriptId = `gpl-ld-${theme}`;
    const json = {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: seoTitle.split('|')[0]?.trim() || heroTitle,
      description: seoDescription,
      url: canonical,
      applicationCategory: 'GameApplication',
      operatingSystem: 'Web, Telegram',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'RUB' },
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
  }, [theme, seoTitle, seoDescription, canonical, heroTitle]);

  const tgUrl = BOT_USERNAME ? `https://t.me/${BOT_USERNAME}` : null;

  const handleStartGame = () => {
    if (!presetGameId) {
      navigate('/');
      return;
    }
    try {
      sessionStorage.setItem('gh_create_lobby_preset', presetGameId);
    } catch (_) {}
    track('landing_start_game', { game: presetGameId, path: pathname });
    navigate('/');
  };

  return (
    <PageLayout
      title={headerTitle}
      titleHref="/"
      right={<AppHeaderRight user={user} />}
    >
      <article className={`gh-fade-in gpl gpl--${theme}`}>
        <header className="gpl__hero">
          {eyebrow ? <p className="gpl__eyebrow">{eyebrow}</p> : null}
          <div className="gpl__mascot" aria-hidden="true">
            {mascotEmoji}
          </div>
          <h1 className="gpl__title">{heroTitle}</h1>
          {heroSubtitle ? <p className="gpl__subtitle">{heroSubtitle}</p> : null}
        </header>

        {steps.length > 0 ? (
          <ul className="gpl__steps" aria-label="Коротко о игре">
            {steps.map((text, i) => (
              <li key={i} className="gpl__step">
                {text}
              </li>
            ))}
          </ul>
        ) : null}

        <div className="gpl__panel">
          <div className="gpl__ctas gpl__ctas--top">
            <button type="button" className="gpl__btn gpl__btn--primary" onClick={handleStartGame}>
              {primaryCtaLabel}
            </button>
            <button
              type="button"
              className="gpl__btn gpl__btn--secondary"
              onClick={() => {
                track('landing_join_open', { game: presetGameId || '', path: pathname });
                setJoinOpen(true);
              }}
            >
              Присоединиться к игре
            </button>
            {showTelegramCta && tgUrl ? (
              <a href={tgUrl} className="gpl__btn gpl__btn--ghost" target="_blank" rel="noopener noreferrer">
                Открыть в Telegram
              </a>
            ) : null}
          </div>

          {sections.map((s, idx) => (
            <section key={idx}>
              <h2 className="gpl__section-title">{s.title}</h2>
              <div className="gpl__section-body">{s.body}</div>
            </section>
          ))}

          <p className="gpl__hint">
            Одна комната — настройки можно поменять в лобби.{' '}
            <button
              type="button"
              className="gpl__inline-link"
              onClick={() => navigate('/rules')}
            >
              Правила сервиса
            </button>
          </p>
          <p className="gpl__brand">GameHub</p>
        </div>
      </article>

      {onJoin ? (
        <JoinRoomModal
          open={joinOpen}
          onClose={() => setJoinOpen(false)}
          onJoin={async (payload) => {
            await onJoin(payload);
            setJoinOpen(false);
            track('landing_join_ok', { kind: payload.kind, game: presetGameId || '' });
          }}
        />
      ) : null}
    </PageLayout>
  );
}
