/**
 * Единая конфигурация для robots.txt и sitemap.xml (Node-сервер + Vite-сборка).
 * Задайте BASE_URL / VITE_BASE_URL на проде — абсолютный URL в Sitemap обязателен.
 */

/** Пути приложения, которые не нужно индексировать */
export const ROBOTS_DISALLOW_PREFIXES = [
  '/admin',
  '/lobby',
  '/spy',
  '/mafia',
  '/elias',
  '/truth_dare',
  '/bunker',
  '/friends',
  '/profile',
  '/app',
];

/**
 * Публичные URL для Яндекса и Google.
 * Главная и лендинги игр — приоритет выше.
 */
export const SITEMAP_ENTRIES = [
  { path: '/', changefreq: 'weekly', priority: 1.0 },
  { path: '/games/spy', changefreq: 'weekly', priority: 0.9 },
  { path: '/games/elias', changefreq: 'weekly', priority: 0.9 },
  { path: '/games/mafia', changefreq: 'weekly', priority: 0.9 },
  { path: '/games/truth_dare', changefreq: 'weekly', priority: 0.85 },
  { path: '/games/bunker', changefreq: 'weekly', priority: 0.85 },
  { path: '/privacy', changefreq: 'yearly', priority: 0.4 },
  { path: '/rules', changefreq: 'yearly', priority: 0.4 },
];

function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * @param {string} baseOrigin - без завершающего слэша
 * @param {string} [lastmodYmd] - YYYY-MM-DD для lastmod (опционально)
 */
export function buildSitemapXml(baseOrigin, lastmodYmd) {
  const base = baseOrigin.replace(/\/$/, '');
  const parts = SITEMAP_ENTRIES.map((e) => {
    const loc = escapeXml(`${base}${e.path}`);
    const lm = lastmodYmd
      ? `\n    <lastmod>${escapeXml(lastmodYmd)}</lastmod>`
      : '';
    return `  <url>
    <loc>${loc}</loc>${lm}
    <changefreq>${e.changefreq}</changefreq>
    <priority>${e.priority}</priority>
  </url>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${parts.join('\n')}
</urlset>`;
}

export function buildRobotsTxt(baseOrigin) {
  const base = baseOrigin.replace(/\/$/, '');
  const lines = [
    'User-agent: *',
    ...ROBOTS_DISALLOW_PREFIXES.map((p) => `Disallow: ${p}`),
    '',
    '# Индексируем: главная /, лендинги /games/*, /privacy, /rules',
    '# Закрыто: лобби, активные игры, профиль, админка',
    `Sitemap: ${base}/sitemap.xml`,
    '',
  ];
  return lines.join('\n');
}
