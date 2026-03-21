# SEO: Яндекс, Google, sitemap

## Переменные окружения

| Переменная | Где | Зачем |
|------------|-----|--------|
| **`BASE_URL`** или **`VITE_BASE_URL`** | Сервер (`server`) | Абсолютный URL сайта в `robots.txt` → `Sitemap:` и в динамическом `sitemap.xml`. На Railway/хостинге задайте `https://ваш-домен.ru` без слэша в конце. |
| **`VITE_BASE_URL`** | Фронт (`app`) | `canonical`, Open Graph, JSON-LD на лендингах и главной. |
| **`VITE_OG_IMAGE`** | Фронт (опционально) | Абсолютный URL картинки для `og:image` (по умолчанию `/og-share.svg` на вашем домене). |

После смены домена:

1. Обновите **`BASE_URL` / `VITE_BASE_URL`** на проде.
2. Пересоберите фронт (`npm run build` в `app`), чтобы в **`dist/robots.txt`** и **`dist/sitemap.xml`** подставился верный домен (плагин в `vite.config.js`).
3. В Яндекс.Вебмастере: **Переобход** / отправка sitemap `https://ваш-домен.ru/sitemap.xml`.

## Файлы

- **`seo/sitemapConfig.mjs`** — список публичных URL, `Disallow` для служебных путей. Используется и сервером, и Vite.
- **Верификация Яндекса** — `app/public/yandex_*.html` в корне сайта после деплоя.

## Что индексируется

- `/` — главная (**index**)
- `/games/spy`, `/games/elias`, … — лендинги игр (**index**, keywords, schema.org `WebApplication` + `BreadcrumbList`)
- `/privacy`, `/rules` — (**index**)

## Что закрыто (`noindex` или `Disallow`)

- Лобби, активные игры (`/spy`, `/mafia`, …), профиль, админка — в **`robots.txt`** и мета-страницах.

## Статический хостинг без Node

В `dist/` после сборки появляются **`robots.txt`** и **`sitemap.xml`**. Если `VITE_BASE_URL` не задан при сборке, в файлах будет заглушка `https://example.com` — **задайте `VITE_BASE_URL` в CI** перед `vite build`.
