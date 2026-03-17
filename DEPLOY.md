# Деплой на сервер по IP

Сервер отдаёт приложение и API с одного порта **3000**. Бот работает отдельным контейнером.

## Требования

- Сервер с **Ubuntu 22.04** (или другим Linux с Docker).
- Открытый порт **3000** (в панели «Сеть» / firewall).

## 1. Подключение к серверу

По SSH (логин обычно `root`, пароль из панели «Доступ»):

```bash
ssh root@ТВОЙ_IP
```

## 2. Установка Docker (если ещё нет)

```bash
apt-get update && apt-get install -y ca-certificates curl
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
apt-get update && apt-get install -y docker-ce docker-ce-cli docker-compose-plugin
```

## 3. Проект на сервере

С сервера (или с твоего ПК через `scp`):

- Либо клонируй репозиторий: `git clone ... && cd GAME_HUB`
- Либо залей архив проекта в папку, например `/root/game-hub`, и перейди в неё: `cd /root/game-hub`

## 4. Файл .env на сервере

В папке проекта создай `.env` (скопируй с `.env.example` и заполни):

```env
BOT_TOKEN=твой_токен_от_BotFather
BASE_URL=http://ТВОЙ_IP:3000
API_URL=http://ТВОЙ_IP:3000
PORT=3000
```

Замени **ТВОЙ_IP** на реальный IP сервера (например `123.45.67.89`).

## 5. Запуск

В папке проекта (где лежат `docker-compose.yml` и `Dockerfile.web`):

```bash
docker compose build
docker compose up -d
```

Проверка:

```bash
docker compose ps
curl http://127.0.0.1:3000
```

Должна открыться главная страница приложения.

## 6. Открытие по IP

- В браузере: **http://ТВОЙ_IP:3000**
- Бот в Telegram уже знает `BASE_URL`, кнопка «Играть» откроет эту ссылку.

## 7. Важно про Telegram Mini App по IP

Telegram **требует HTTPS** для Mini App, когда пользователь открывает игру из клиента Telegram. По **http://IP:3000** приложение будет работать только если открыть ссылку **в браузере** (например с телефона или ПК).

Чтобы открывать игру **прямо из Telegram** (кнопка «Играть» в боте), позже понадобится:

- **Домен**, привязанный к этому серверу (например `gamehub.example.com`);
- **HTTPS** (например Let's Encrypt);
- В BotFather указать URL Mini App: `https://gamehub.example.com`.

Пока по IP можно спокойно тестировать: заходить в браузере по `http://IP:3000`, создавать комнаты, заходить по коду, проверять игру «Шпион» и бота (бот будет присылать кнопку с этой ссылкой).

## 8. Полезные команды

- Логи: `docker compose logs -f`
- Остановить: `docker compose down`
- Пересобрать после изменений: `docker compose build --no-cache && docker compose up -d`
