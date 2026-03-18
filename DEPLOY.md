# Деплой GAME_HUB

## В Git Bash (на своём компьютере)

### Разработка
```bash
cd "c:/Users/axilb/OneDrive/Рабочий стол/PROGS/GAME_HUB"
npm run dev
```
Запустятся сервер (порт 3000), фронт (Vite, порт 5173) и бот.

### Сборка перед выкладкой на сервер
```bash
cd "c:/Users/axilb/OneDrive/Рабочий стол/PROGS/GAME_HUB"

# Установить зависимости (если ещё не ставили)
npm install
cd app && npm install && cd ..

# Собрать фронт
npm run build

# Скопировать собранный фронт в папку сервера (чтобы сервер раздавал статику)
# Windows (PowerShell или Git Bash):
cp -r app/dist/* server/public/
# Если server/public нет — создать: mkdir -p server/public и повторить cp
```

### Отправить код на сервер (через Git или вручную)
- Через Git: `git add .`, `git commit -m "..."`, `git push`; на сервере — `git pull`.
- Или скопировать папку проекта на сервер (SCP, SFTP, архив).

---

## На сервере

### Установка (один раз)
```bash
cd /путь/к/GAME_HUB
npm install
cd app && npm install && cd ..
npm run build
cp -r app/dist/* server/public/
```

### Запуск
```bash
cd /путь/к/GAME_HUB

# Только сервер (API + статика + WebSocket)
PORT=3000 node server/index.js
# или
npm run start

# Бот (если нужен) — в отдельном терминале или через pm2
node bot/index.js
# или
npm run start:bot
```

### Переменные окружения (по желанию)
- `PORT` — порт сервера (по умолчанию 3000).
- `BASE_URL` — URL, с которого открывают приложение (для CORS/WebSocket).

### Держать сервер всегда запущенным (pm2)
```bash
npm install -g pm2
pm2 start server/index.js --name game-hub
pm2 start bot/index.js --name game-hub-bot
pm2 save && pm2 startup
```

---

## Кратко

| Где        | Действие |
|-----------|----------|
| **Git Bash** | `npm run dev` — разработка; `npm run build` и копирование `app/dist/*` в `server/public` — сборка перед деплоем. |
| **Сервер**   | `npm install`, сборка, `npm run start` (и при необходимости `npm run start:bot` или pm2). |
