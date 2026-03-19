import { useEffect } from 'react';
import useSeo from '../hooks/useSeo';
import BackArrow from '../components/BackArrow';

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

const baseUrl = (import.meta.env.VITE_BASE_URL || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/$/, '');

export default function SeoLanding({ navigateToApp, onNavigate }) {
  const nav = onNavigate || (() => {});
  const canonical = baseUrl ? `${baseUrl}/seo` : undefined;
  const ogImage = baseUrl ? `${baseUrl}/og-share.svg` : undefined;

  useSeo({
    title: 'GameHub — мини-игры в Telegram',
    description: 'Собирайте друзей в одной комнате и играйте в «Шпион», «Элиас», «Мафию» и другие мини-игры прямо в Telegram или браузере.',
    canonical,
    robots: 'index, follow',
    ogImage,
    ogType: 'website',
  });

  useEffect(() => {
    const scriptId = 'gh-ld-json-landing';
    const org = {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'GameHub',
      description: 'Игровой хаб: Шпион, Элиас, Мафия для компании онлайн.',
      url: baseUrl || undefined,
    };
    const game = {
      '@context': 'https://schema.org',
      '@type': 'Game',
      name: 'GameHub — набор мини-игр',
      gameItem: [
        { '@type': 'Thing', name: 'Шпион', url: baseUrl ? `${baseUrl}/games/spy` : undefined },
        { '@type': 'Thing', name: 'Элиас', url: baseUrl ? `${baseUrl}/games/elias` : undefined },
        { '@type': 'Thing', name: 'Мафия', url: baseUrl ? `${baseUrl}/games/mafia` : undefined },
      ],
    };
    const faq = {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: [
        {
          '@type': 'Question',
          name: 'Нужна ли регистрация?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Нет: достаточно открыть мини-приложение или страницу и ввести код комнаты.',
          },
        },
        {
          '@type': 'Question',
          name: 'Что даёт подписка Про?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Расширенные словари, режимы вроде расширенной Мафии и отсутствие рекламы перед стартом для вашей сессии.',
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
    s.text = JSON.stringify([org, game, faq]);
    return () => {
      const el = document.getElementById(scriptId);
      if (el?.parentNode) el.parentNode.removeChild(el);
    };
  }, []);

  return (
    <div className="gh-page gh-fade-in" style={{ maxWidth: 560 }}>
      {navigateToApp ? <BackArrow onClick={navigateToApp} title="Назад" /> : null}
      <h1 style={{ marginTop: 0 }}>Игровой хаб в Telegram</h1>
      <p style={{ opacity: 0.9, lineHeight: 1.5 }}>
        Нажмите «Открыть приложение», чтобы перейти в GameHub и начать игру в одной комнате с друзьями.
      </p>

      <div style={{ marginTop: 18 }}>
        <button type="button" onClick={() => navigateToApp?.()} style={btnStyle} disabled={!navigateToApp}>
          Открыть приложение
        </button>
      </div>

      <section style={{ marginTop: 22 }}>
        <h2 style={{ fontSize: 18, marginBottom: 10 }}>Доступно сейчас</h2>
        <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.65 }}>
          <li>
            <a href="/games/spy" onClick={(e) => { e.preventDefault(); nav('/games/spy'); }} style={{ color: '#7ab' }}>Шпион</a> — локации и слово, кроме шпиона
          </li>
          <li>
            <a href="/games/elias" onClick={(e) => { e.preventDefault(); nav('/games/elias'); }} style={{ color: '#7ab' }}>Элиас</a> — объясни слово своей команде
          </li>
          <li>
            <a href="/games/mafia" onClick={(e) => { e.preventDefault(); nav('/games/mafia'); }} style={{ color: '#7ab' }}>Мафия</a> — классика для компании
          </li>
        </ul>
      </section>

      <section style={{ marginTop: 22 }}>
        <h2 style={{ fontSize: 18, marginBottom: 10 }}>FAQ</h2>
        <dl style={{ margin: 0, lineHeight: 1.55 }}>
          <dt style={{ fontWeight: 700, marginTop: 10 }}>Как зайти в комнату?</dt>
          <dd style={{ margin: '6px 0 0', opacity: 0.9 }}>Создайте комнату или введите шестизначный код, который показал хост.</dd>
          <dt style={{ fontWeight: 700, marginTop: 10 }}>Работает ли в браузере?</dt>
          <dd style={{ margin: '6px 0 0', opacity: 0.9 }}>Да, можно делиться веб-ссылкой с параметром приглашения.</dd>
        </dl>
      </section>

      <section style={{ marginTop: 22, fontSize: 14, opacity: 0.88 }}>
        <a href="/how-to-play" onClick={(e) => { e.preventDefault(); nav('/how-to-play'); }} style={{ color: '#7ab' }}>
          Как играть
        </a>
        {' · '}
        <a href="/privacy" onClick={(e) => { e.preventDefault(); nav('/privacy'); }} style={{ color: '#7ab' }}>
          Приватность
        </a>
        {' · '}
        <a href="/rules" onClick={(e) => { e.preventDefault(); nav('/rules'); }} style={{ color: '#7ab' }}>
          Правила
        </a>
      </section>
    </div>
  );
}
