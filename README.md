# Игровой хаб

Telegram Mini App: комнаты по приглашению и коду, игра «Шпион» в первом релизе.

## Что нужно перед запуском

- **BOT_TOKEN** — создать бота в [@BotFather](https://t.me/BotFather), скопировать токен.
- Остальное см. в [SETUP.md](SETUP.md).

## Установка

```bash
# из корня проекта
npm install
cd server && npm install && cd ..
cd app && npm install && cd ..
cd bot && npm install && cd ..
```

## Запуск

1. Скопируй `.env.example` в `.env` и укажи `BOT_TOKEN`.
2. Запуск всего (бэкенд + фронт + бот):

```bash
npm run dev
```

Либо по отдельности в трёх терминалах:

```bash
# Терминал 1 — API и WebSocket
cd server && node index.js

# Терминал 2 — Mini App (Vite)
cd app && npm run dev

# Терминал 3 — бот
cd bot && node index.js
```

3. Для проверки Mini App в Telegram: настроить Web App URL в BotFather (нужен HTTPS или туннель вроде ngrok на `BASE_URL`).

## Структура

- `server/` — Fastify API, Socket.io, комнаты, логика «Шпион».
- `app/` — React Mini App (Vite): главная, лобби, раунд Шпиона.
- `bot/` — Telegraf: /start, кнопка «Играть» и инвайт-ссылка.

Вход в комнату: по **приглашению** (ссылка из хоста) или по **6-значному коду**.

## QA перед деплоем

- Smoke-regression чеклист: [QA_SMOKE_REGRESSION.md](QA_SMOKE_REGRESSION.md)
