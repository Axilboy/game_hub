# SEO: Яндекс, Google, sitemap

## Переменные окружения

| Переменная | Где | Зачем |
|------------|-----|--------|
| **`SITEMAP_BASE_URL`** (опц.) | Сервер (`server`) | Принудительный абсолютный URL только для `robots.txt`/`sitemap.xml`. Если не задан, сервер берёт origin из текущего HTTP-запроса (`x-forwarded-*` / host). |
| **`VITE_BASE_URL`** | Фронт (`app`) | `canonical`, Open Graph, JSON-LD на лендингах и главной. |
| **`VITE_OG_IMAGE`** | Фронт (опционально) | Абсолютный URL картинки для `og:image` (по умолчанию `/og-share.svg` на вашем домене). |

После смены домена:

1. Обновите **`SITEMAP_BASE_URL`** (если используете принудительный домен) и **`VITE_BASE_URL`** на проде.
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

В `dist/` после сборки появляются **`robots.txt`** и **`sitemap.xml`**. Для production-сборки `VITE_BASE_URL` обязателен: при его отсутствии `vite build` завершится с ошибкой, чтобы не выпустить sitemap с неверным доменом.
