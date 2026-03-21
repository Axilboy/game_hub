import { useEffect } from 'react';

function upsertMeta(selector, create, value) {
  const el = document.head.querySelector(selector);
  if (el) {
    el.setAttribute('content', value);
    return;
  }
  document.head.appendChild(create(value));
}

function upsertPropertyMeta(property, content) {
  const sel = `meta[property="${property}"]`;
  const el = document.head.querySelector(sel);
  if (el) {
    el.setAttribute('content', content);
    return;
  }
  const m = document.createElement('meta');
  m.setAttribute('property', property);
  m.setAttribute('content', content);
  document.head.appendChild(m);
}

function upsertNameMeta(name, content) {
  upsertMeta(
    `meta[name="${name}"]`,
    (v) => {
      const m = document.createElement('meta');
      m.setAttribute('name', name);
      m.setAttribute('content', v);
      return m;
    },
    content
  );
}

/**
 * SEO для SPA: обновляет title, description, canonical, robots, Open Graph и Twitter Card.
 * Для индексируемых страниц задавайте canonical (абсолютный URL) и og:image (абсолютный).
 */
export default function useSeo({
  title,
  description,
  canonical,
  robots,
  ogImage,
  ogType = 'website',
  siteName = 'GameHub',
  locale = 'ru_RU',
  twitterCard = 'summary_large_image',
}) {
  useEffect(() => {
    if (title) document.title = title;

    if (description) {
      upsertMeta(
        'meta[name="description"]',
        (v) => {
          const m = document.createElement('meta');
          m.setAttribute('name', 'description');
          m.setAttribute('content', v);
          return m;
        },
        description
      );
    }

    if (title) {
      upsertMeta(
        'meta[property="og:title"]',
        (v) => {
          const m = document.createElement('meta');
          m.setAttribute('property', 'og:title');
          m.setAttribute('content', v);
          return m;
        },
        title
      );
    }
    if (description) {
      upsertMeta(
        'meta[property="og:description"]',
        (v) => {
          const m = document.createElement('meta');
          m.setAttribute('property', 'og:description');
          m.setAttribute('content', v);
          return m;
        },
        description
      );
    }

    if (siteName) {
      upsertPropertyMeta('og:site_name', siteName);
    }
    if (locale) {
      upsertPropertyMeta('og:locale', locale);
    }

    if (canonical) {
      const existing = document.head.querySelector('link[rel="canonical"]');
      if (existing) {
        existing.setAttribute('href', canonical);
      } else {
        const link = document.createElement('link');
        link.setAttribute('rel', 'canonical');
        link.setAttribute('href', canonical);
        document.head.appendChild(link);
      }
      upsertPropertyMeta('og:url', canonical);
    }

    if (ogImage) {
      upsertPropertyMeta('og:image', ogImage);
    }
    if (ogType) {
      upsertPropertyMeta('og:type', ogType);
    }

    // Twitter / X (карточки при шаринге)
    if (twitterCard) {
      upsertNameMeta('twitter:card', twitterCard);
    }
    if (title) {
      upsertNameMeta('twitter:title', title);
    }
    if (description) {
      upsertNameMeta('twitter:description', description);
    }
    if (ogImage) {
      upsertNameMeta('twitter:image', ogImage);
    }

    if (robots) {
      upsertMeta(
        'meta[name="robots"]',
        (v) => {
          const m = document.createElement('meta');
          m.setAttribute('name', 'robots');
          m.setAttribute('content', v);
          return m;
        },
        robots
      );
    }
  }, [title, description, canonical, robots, ogImage, ogType, siteName, locale, twitterCard]);
}

