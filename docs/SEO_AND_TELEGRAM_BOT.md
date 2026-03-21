# SEO и настройка бота (GameHub)

## Переменные окружения (продакшен)

| Переменная | Где | Зачем |
|------------|-----|--------|
| `BASE_URL` | **сервер** | Канонический HTTPS-URL сайта для `robots.txt`, `sitemap.xml`, логов. Пример: `https://gamehubparty.ru` |
| `VITE_BASE_URL` | **сборка фронта** (`app/.env.production`) | Тот же публичный URL: canonical, Open Graph, ссылки «Поделиться». **Обязательно совпадать с реальным доменом.** |
| `VITE_API_URL` | сборка фронта | URL API (если отличается от origin). |
| `VITE_BOT_USERNAME` | сборка фронта | Имя бота **без** `@` — для ссылок `t.me/...`. |
| `VITE_OG_IMAGE` | опционально | Абсолютный URL картинки для OG/Twitter (если не задан — используется `/og-share.svg` на вашем домене). Рекомендуется **1200×630** PNG/JPG для лучшего превью. |

После смены домена пересоберите фронт (`npm run build`), чтобы подтянулся `VITE_*`.

## Что уже настроено в коде

- **`/robots.txt`** — отдаёт сервер; закрыты служебные маршруты (`/lobby`, игровые экраны, `/admin`, `/profile` и т.д.).
- **`/sitemap.xml`** — список публичных URL: `/seo`, `/games/*`, `/how-to-play`, `/privacy`, `/rules`.
- **Публичные страницы** (`/seo`, статьи игр, правила) — `useSeo`: title, description, **canonical**, **Open Graph**, **Twitter Card**, `index, follow`.
- **Экран входа и комнаты** — `noindex, nofollow` (не дублируем игровые сессии в поиске).
- **JSON-LD** на `/seo`: Organization, WebSite, Game, FAQPage.

## Проверка после деплоя

1. Откройте `https://ВАШ_ДОМЕН/robots.txt` и `https://ВАШ_ДОМЕН/sitemap.xml`.
2. [Google Rich Results Test](https://search.google.com/test/rich-results) — URL `/seo` или любой `/games/...`.
3. [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/) — превью по ссылке (кэш обновляется кнопкой «Scrape Again»).

## Вебмастеры

- **Google Search Console** — добавьте свойство «Домен» или «Префикс URL», подтвердите владение, укажите sitemap: `https://ВАШ_ДОМЕН/sitemap.xml`.
- **Яндекс Вебмастер** — то же, файл sitemap в разделе «Индексирование».

## Telegram / BotFather

1. **Mini App URL** — ваш **HTTPS** origin (корень сайта, где отдаётся SPA), без лишнего слэша в конце при вводе в BotFather (как требует форма).
2. **Домен** — включите домен для Web App в настройках бота (BotFather → Bot Settings → Domain), если используете кастомный домен.
3. Описание бота и картинка — для витрины в Telegram (не влияет на Google, но влияет на доверие пользователей).
4. Команды (опционально): `/start` — стандартно открывает чат; логику Mini App задаёт ваш фронт.

Токен бота (`BOT_TOKEN`) храните только на сервере, **не** в `VITE_*` и не в клиентском репозитории.

## Картинка для соцсетей

Положите в `app/public/` файл (например `og-cover.png` 1200×630) и задайте:

```env
VITE_OG_IMAGE=https://ВАШ_ДОМЕН/og-cover.png
```

Иначе используется векторный `og-share.svg` — не все сети одинаково хорошо его превьюят; для максимальной совместимости лучше PNG.
