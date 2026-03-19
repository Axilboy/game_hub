import { useEffect } from 'react';

function upsertMeta(selector, create, value) {
  const el = document.head.querySelector(selector);
  if (el) {
    el.setAttribute('content', value);
    return;
  }
  document.head.appendChild(create(value));
}

export default function useSeo({ title, description, canonical, robots }) {
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

    // Basic OG tags (helps when sharing links).
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
    }

    // Optional robots directive.
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
  }, [title, description, canonical, robots]);
}

