import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import useSeo from '../../hooks/useSeo';
import BackArrow from '../BackArrow';
import SeoFooter from '../layout/SeoFooter';
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
  onBack,
  primaryCtaLabel = 'Играть в GameHub',
  showTelegramCta = true,
}) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const canonical = baseUrl ? `${baseUrl}${pathname}` : undefined;

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

  return (
    <article className={`gh-page gh-fade-in gpl gpl--${theme}`}>
      <div className="gpl__back">
        {onBack ? <BackArrow onClick={onBack} title="Назад" /> : null}
      </div>

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
        {sections.map((s, idx) => (
          <section key={idx}>
            <h2 className="gpl__section-title">{s.title}</h2>
            <div className="gpl__section-body">{s.body}</div>
          </section>
        ))}

        <div className="gpl__ctas">
          <button type="button" className="gpl__btn gpl__btn--primary" onClick={() => navigate('/')}>
            {primaryCtaLabel}
          </button>
          <button type="button" className="gpl__btn gpl__btn--secondary" onClick={() => navigate('/rules')}>
            Правила сервиса
          </button>
          {showTelegramCta && tgUrl ? (
            <a href={tgUrl} className="gpl__btn gpl__btn--ghost" target="_blank" rel="noopener noreferrer">
              Открыть в Telegram
            </a>
          ) : null}
        </div>

        <p className="gpl__hint">
          Одна комната — выберите игру в лобби. Реклама и поиск ведут на эту страницу: играйте с друзьями онлайн.
        </p>
        <p className="gpl__brand">GameHub</p>
      </div>

      <SeoFooter style={{ marginTop: 20 }} />
    </article>
  );
}
