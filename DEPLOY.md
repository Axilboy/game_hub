# Деплой на сервер (через Git)

## Что заливать

В **репозиторий Git** попадает **весь проект** (как есть), кроме того, что в `.gitignore`:

| Нужно в репо | Не коммитить (локально) |
|--------------|-------------------------|
| `app/`, `server/`, `bot/`, `seo/` | `.env`, `.env.*` |
| `Dockerfile.web`, `DEPLOY.md`, `README.md` | `node_modules/` |
| `app/public/` (иконки, `yandex_*.html` и т.д.) | `data/` |

После `git push` на сервере делаешь `git pull` — **отдельно «заливать только папку» не нужно**, если собираешь образ или билд из этого клона.

**Важно:** каталог **`seo/`** обязателен — из него берётся конфиг sitemap/robots и для Vite-сборки, и для Node-сервера.

---

## Переменные окружения на сервере

Создай файл окружения (не в Git!) по образцу `.env.example`:

| Переменная | Обязательно | Смысл |
|------------|-------------|--------|
| `BOT_TOKEN` | да (для бота) | Токен от @BotFather |
| `BASE_URL` | **да для продакшена** | Публичный URL сайта **без** слэша в конце, например `https://gamehubparty.ru` — для sitemap, роботов, CORS socket |
| `PORT` | обычно нет | Порт HTTP (по умолчанию `3000`) |
| `VITE_BASE_URL` | **желательно при сборке фронта** | Тот же URL, что `BASE_URL` — для canonical, OG, `dist/sitemap.xml` / `dist/robots.txt` |

Если фронт собираешь **на сервере** перед копированием в `server/public`, передай:

```bash
export VITE_BASE_URL=https://ТВОЙ_ДОМЕН.ru
# опционально:
# export VITE_BOT_USERNAME=имя_бота_без_@
cd app && npm ci && npm run build
```

Если используешь **Docker** (ниже), те же значения передаются `docker build --build-arg`.

---

## Вариант 1: Docker (рекомендуется)

Из **корня репозитория** (где лежит `Dockerfile.web`):

```bash
git pull
docker build -f Dockerfile.web \
  --build-arg VITE_BASE_URL=https://ТВОЙ_ДОМЕН.ru \
  --build-arg VITE_BOT_USERNAME=имя_бота \
  -t gamehub-web .
docker run -d --restart unless-stopped -p 3000:3000 \
  -e BOT_TOKEN=... \
  -e BASE_URL=https://ТВОЙ_ДОМЕН.ru \
  gamehub-web
```

Прокси (nginx/Caddy) снаружи терминирует HTTPS и проксирует на `127.0.0.1:3000`.

---

## Вариант 2: Без Docker (VPS)

```bash
cd /путь/к/клону
git pull

# 1) Фронт
cd app
npm ci
export VITE_BASE_URL=https://ТВОЙ_ДОМЕН.ru
npm run build
cd ..

# 2) Положить статику туда, откуда сервер отдаёт SPA
rm -rf server/public
mkdir -p server/public
cp -r app/dist/* server/public/

# 3) Бэкенд
cd server
npm ci --omit=dev
cd ..

# 4) Запуск (pm2/systemd — как настроишь)
cd server
BOT_TOKEN=... BASE_URL=https://ТВОЙ_ДОМЕН.ru node index.js
```

Бот (`bot/`) — отдельный процесс, см. `.env.example` и `npm run start:bot` из корня.

---

## Проверка после деплоя

- Открывается главная по `BASE_URL`.
- `https://ТВОЙ_ДОМЕН/sitemap.xml` и `/robots.txt` отдают контент.
- Файл верификации Яндекса: `https://ТВОЙ_ДОМЕН/yandex_....html` (лежит в `app/public/`).

---

## Кратко

1. **Пушишь в Git весь проект** (включая `seo/`).
2. На сервере **`git pull`**.
3. Задаёшь **`BASE_URL`** и **`BOT_TOKEN`**, собираешь фронт с **`VITE_BASE_URL`** или собираешь Docker с `--build-arg VITE_BASE_URL=...`.
4. Стартуешь **Node из `server/`** с готовой папкой **`server/public`** (результат `app/dist`).

Подробнее про SEO: [seo/README.md](seo/README.md).
