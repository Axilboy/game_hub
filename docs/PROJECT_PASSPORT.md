# Паспорт и архив проекта Game Hub (GameHubParty)

**Назначение:** единая точка правды для людей и ИИ-агентов: что это за проект, как устроен, где что лежит, какие ключевые алгоритмы и договорённости.  
**Обновление:** при существенных изменениях в коде или поведении — дополняйте раздел **«Журнал изменений»** в конце и при необходимости соответствующие главы.

---

## 1. Что это за продукт

- **Telegram Mini App** + веб: комнаты по **коду** и **инвайт-ссылке**, несколько игр в одном хабе.
- **Клиент:** React (Vite), PWA. **Сервер:** Node.js, Fastify, Socket.io. **Бот:** Telegraf (приглашения, кнопка «Играть»).
- Игры (по состоянию кодовой базы): **Шпион (spy)**, **Мафия**, **Элиас (elias)**, **Правда или действие (truth_dare)**, **Бункер (bunker)**.

Корневые документы: `README.md`, `SETUP.md`, `DEPLOY.md`, `QA_SMOKE_REGRESSION.md`, `RELEASE_RUNBOOK.md`.

---

## 2. Стек и запуск

| Часть | Технологии |
|-------|------------|
| Фронт | React 18, React Router, Vite, socket.io-client, PWA (vite-plugin-pwa) |
| Бэкенд | Fastify, @fastify/cors, @fastify/static, socket.io |
| Бот | Telegraf |
| Корень | `concurrently` для `npm run dev` |

**Скрипты (корень `package.json`):**

- `npm run dev` — сервер + фронт + бот.
- `npm run dev:server` / `dev:app` / `dev:bot` — по отдельности.
- `npm run build` — сборка только фронта (`app`).

---

## 3. Структура репозитория

```
GAME_HUB/
├── app/                 # React Mini App (Vite)
│   └── src/
│       ├── App.jsx      # Маршруты, комната, socket, leaveRoom, heartbeat друзей
│       ├── usePresenceHeartbeat.js
│       ├── api.js       # fetch JSON к /api
│       ├── socket.js
│       ├── useTelegram.js   # Telegram WebApp user ИЛИ web-идентичность (localStorage)
│       ├── pages/       # Home, Lobby, *Round, SEO-страницы
│       └── components/
├── server/
│   ├── index.js         # точка входа Fastify + Socket.io
│   ├── rooms.js         # основная масса HTTP API комнат и игр
│   ├── mafia.js         # логика фаз мафии, роли, голосование
│   ├── roomManager.js   # комнаты, коды, игроки, syncPartyTeams
│   ├── partyTeamAssign.js  # раскладка игроков по командам (лобби Элиас/ПдД)
│   ├── eliasWords.js, eliasWordsExtra.js
│   ├── friendsStore.js, presenceStore.js, friendsRoutes.js  # друзья + heartbeat присутствия
│   └── …
├── bot/                 # Telegram-бот
├── tools/
│   └── multiplayer-sandbox/  # см. §11 — НЕ часть прод-сборки
├── docs/
│   └── PROJECT_PASSPORT.md   # этот файл
└── README.md, DEPLOY.md, …
```

---

## 4. Идентичность пользователя (важно для отладки)

**Файл:** `app/src/useTelegram.js`

- В **Telegram WebApp** берётся `window.Telegram.WebApp.initDataUnsafe.user`.
- **В браузере без Telegram** создаётся «web»-пользователь:
  - `localStorage.gameHub_webPlayerId` — строка вида `web_xxxxxxx`
  - `localStorage.gameHub_webDisplayName` — случайное смешное имя из списка

Все API передают `playerId` из `user.id`. На сервере сравнение id обычно через `String(a) === String(b)`.

---

## 5. Комнаты и сокеты (общая модель)

**Файл:** `server/roomManager.js`

- Комнаты в `Map`, привязка **6-значного кода** к `roomId`, инвайт-токены.
- Состояние комнаты: `lobby` | `playing` и т.д.; поле `game`, `gameState`, `gameSettings`.
- **Socket.io:** события вроде `room_updated`, `player_joined`, `player_left`, `game_start`, `game_ended`, плюс игровые (`elias_update`, …).

**Клиент** (`App.jsx`): при наличии `roomId` держит `room` через REST refresh и socket; маршруты `/spy`, `/elias`, … проверяют `room.state === 'playing'` и `room.game`.

---

## 6. Лобби и команды (Элиас / Правда или действие)

**Файлы:** `server/roomManager.js`, `server/partyTeamAssign.js`, `server/rooms.js` (PATCH лобби, assign-team).

### Алгоритм `assignPlayerIdsToTeams(playerIds, teamCount)` (`partyTeamAssign.js`)

- Нормализует список уникальных id игроков.
- **2 команды:** дуэль / 2+1 / по очереди в зависимости от числа игроков.
- **3+ команд:** равномерное распределение по кругу.

### `syncPartyTeams(room)` (`roomManager.js`)

- Только **Элиас**: заполняет `gameSettings.eliasTeams` (`playerIds`), подстраивает `eliasLobbyWins`.

### `syncTruthDareTurnOrder(room)` (`roomManager.js`)

- Только **Правда или действие** в лобби: поддерживает `gameSettings.truthDareTurnOrder` (id игроков) — убирает вышедших, новых добавляет в конец. Команд в П/Д нет.

### `maybeSyncPartyTeamsAfterLobbyPatch(room)`

- **Элиас:** пересинхронизация команд с `room.players` при рассинхроне (как раньше).
- **П/Д:** вызывает `syncTruthDareTurnOrder`.

### Ручная смена команды

**`POST /rooms/:roomId/lobby/assign-team`** — только **Элиас**; тело: `actorId`, `targetPlayerId`, `teamIndex`.  
Хост — любому; не-хост — только себе (`actorId === targetPlayerId`).

### Правда или действие — очередь ходов

- В лобби: `truthDareOrderMode`: `host` (по списку `truthDareTurnOrder`, ведущий переставляет в UI) или `random` (каждый ход случайный игрок, кроме текущего при 2+ игроках).
- Старт матча: `buildTruthDarePlayerOrder` + `createTruthDareState(..., { playerOrder, orderMode })`.
- **`GET .../truth_dare/state`:** поле `turnOrderMode`: `host` | `random`.

---

## 7. Игра «Элиас» (сервер)

**Ключевые файлы:** `server/rooms.js` (маршруты `/rooms/elias/*`, `GET .../elias/state`), `server/eliasWords.js`, логика слов.

### Старт матча

**`POST /rooms/elias/start`** — хост передаёт настройки (таймер, словари, команды, `teams` или `team1Ids`/`team2Ids`).  
Создаётся `gameState` с полями вроде `teams`, `currentTeamIndex`, `currentExplainerIndex`, `awaitingExplainerStart`, `dictionaryIds`, `roundPhase`, `eliasPreRoundReady`, и т.д.

### Фаза «Готов» перед раундом (только текущий объясняющий)

- **`POST /rooms/:roomId/elias/ready-pre-round`** — принимает нажатие **только от текущего объясняющего** (игрок из `teams[currentTeamIndex].players[currentExplainerIndex % len]`); иначе **403**.
- В `eliasPreRoundReady` попадает только этот id; сразу вызывается **`eliasBeginRoundInternal`** (слово, таймер, `roundPhase = 'playing'`, сброс `eliasPreRoundReady`).
- Остальные игроки не жмут «Готов» — им показывается ожидание объясняющего (см. клиент).
- Старый **`/elias/begin-round`** удалён в пользу этого механизма.

### Игровой раунд

- **`guessed` / `skip`: только текущий объясняющий** (игрок из `teams[currentTeamIndex].players[currentExplainerIndex % len]`).
- **`timer-ended`** — после истечения таймера переводит в фазу `last_word` (если ещё не обработано).
- **`last-word-assign`** — только объясняющий; начисление бонуса последнему слову и переход в `review`.
- **`finalize-round`** — только объясняющий; применяет отредактированный `roundLog`, затем `eliasNextTurn` или победа.

### Выдача состояния клиенту

**`GET /rooms/:roomId/elias/state?playerId=...`**

- Заголовки **`Cache-Control: no-store`** (чтобы WebView не кэшировал).
- **`word`:** в `playing` — только если запросивший **`playerId` === id текущего объясняющего**; в `last_word` — слово **только объясняющему**; в `review` не отдаётся как текущее слово отдельно (лог в `roundLog`).
- В ответе: `teams`, `explainerName`, `isExplainer`, **`isCurrentExplainer`** (серверный флаг), **`currentExplainerId`**, `preRoundReadyIds`, **`preRoundRequiredCount`** (`1` при `awaitingExplainerStart`, иначе `null`), `roomPlayersCount`, `roundPhase`, и т.д.

---

## 8. Игра «Элиас» (клиент)

**Файл:** `app/src/pages/EliasRound.jsx`, стили `app/src/pages/eliasRound.css`, оболочка `GameplayScreen`, `GameLayout`.

### Надёжное определение «кто объясняет» (клиент)

Чтобы не зависеть от кэша и рассинхрона полей API:

- **`getExplainerPlayerIdFromState(state)`** — берёт `state.teams[currentTeamIndex].playerIds[currentExplainerIndex]`.
- **`resolveExplainerDisplayName(state, room)`** — имя из `room.players` по этому id, иначе fallback на `state.explainerName`.
- **`isMeExplainer`** — `String(myId) === String(explainerPidResolved)`.
- **`wordForMe`** — `isMeExplainer ? state.word : null` (слова не показываются отгадывающему даже при старом поле в JSON).

### UI

- **Модалка выхода** по стрелке назад: подтверждение → `onLeave()` + переход на `/`.
- **Подготовка к раунду:** модалка с кнопкой **«Готов» только у текущего объясняющего**; остальным — текст ожидания и счётчик «готовы N из `preRoundRequiredCount`» (обычно 1 из 1).
- **Таймер и счёт** — компактный блок в **шапке** карточки «Текущий раунд», не отдельный крупный HUD.
- **Отгадывающий в команде объясняющей:** без карточки слова и без кнопок да/нет; только информация и таймер/счёт в шапке.
- **Промо-стиль:** glass-панели, скругления — в `eliasRound.css`.

### Запросы

- К **`elias/state`** добавляется **`&_=${Date.now()}`** против кэша.

---

## 9. Игра «Мафия» (сервер и клиент)

**Сервер:** `server/mafia.js`, интеграция в `server/rooms.js` (старт, фазы, голоса, таймеры).

### Состав стола и старт

- **Минимум 6 игроков в пуле** (ведущий не входит в этот счёт). Расширенный режим — те же ограничения (`MIN_MAFIA_PLAYERS_*` в `server/mafia.js`).
- **Состав ролей:** команда мафии (дон + «рядовые») = **⌈n/4⌉**, комиссар ×1, мирные — остаток; расширение — доктор и путана вместо двух мирных (как в распространённых правилах / приложениях).
- После раздачи ролей партия начинается с **подготовительных фаз**, а не сразу с «убийственной» ночи.

### Фазы до основной игры

- **`prep_day_1`** — первый день без игровых действий (подготовка).
- **`night_meet`** — первая ночь: без убийств и без проверок комиссара; мафия «знакомится» (ведущий ведёт стол). Флаг **`killNightEnabled: false`**.
- **`prep_day_2`** — второй день без действий.
- Далее обычные **`night_mafia`** / день / голосование. **Со второй «ночи мафии»** разрешены убийство мафией и проверка комиссара (`killNightEnabled: true` после выхода из подготовки).

Таймеры фаз: в **`phaseTimers`** помимо `roleSetup`, `nightMafia`, `nightCommissioner`, `day`, `voting` используются **`prepDay`** и **`nightMeet`** (дефолты в `lobbyPresets.js` и при старте из лобби).

### Клиент

**Файлы:** `app/src/pages/MafiaRound.jsx`, `mafiaRound.css`, оболочка **`GameplayScreen`**.

- Подсказки и UI под фазы `prep_day_1`, `night_meet`, `prep_day_2`; убийства только когда сервер разрешает (`killNightEnabled` и фаза `night_mafia`).
- У игроков в списках рядом с именем показывается **личное примечание из друзей** (загрузка `GET /friends/list`, карта `friendId → note`).
- **Шапка игры:** кнопка **«На главную»** (`navigate('/')`), **«Назад»** — в лобби; у заголовка шапки `pointer-events: none`, чтобы не перехватывать клики по кнопкам.

---

## 10. Маршруты фронта (кратко)

**Файл:** `app/src/App.jsx`

| Путь | Назначение |
|------|------------|
| `/` | Home |
| `/lobby` | Лобби (нужны roomId + room) |
| `/elias`, `/spy`, `/mafia`, `/truth_dare`, `/bunker` | Раунды при `playing` и нужной `game` |
| `/games/*`, `/privacy`, `/rules` | SEO и статика |
| `/friends` | Список друзей, **редактирование примечания**, удаление, вход в лобби друга по инвайту |
| `/profile`, `/admin` | Профиль и админка |

### Система «Друзья»

**Сервер:** `server/friendsStore.js` — граф дружбы, **очередь заявок** `pending`, **заметки** `notes[viewerId][friendId]` (как зовут в жизни), глобальные имена в `names`; файл `data/friends.json`. `server/presenceStore.js` — последний heartbeat. `server/friendsRoutes.js` — префикс `/api`.

| Метод | Путь | Назначение |
|-------|------|------------|
| POST | `/presence/heartbeat` | `playerId`, `displayName`, `location`, при лобби — `roomId`, `inviteToken`, `roomCode` |
| POST | `/friends/request` | Заявка: `playerId`, `targetId`, `requesterName` |
| POST | `/friends/accept` | Принять: `playerId` (кто принимает), `fromId`, опц. `note`, `acceptorDisplayName` |
| POST | `/friends/reject` | `playerId`, `fromId` |
| POST | `/friends/add` | Устар.: мгновенное добавление (совместимость) |
| POST | `/friends/note` | Изменить примечание к другу: `playerId`, `friendId`, `note` (только для пары друзей) |
| POST | `/friends/remove` | `playerId`, `friendId` |
| GET | `/friends/list?playerId=` | `friends` (с полем `note`), `incomingRequests`, `outgoingPendingIds`, плюс онлайн/лобби |

**Клиент:** `resolvePublicDisplayName`, `formatFriendListLine`, **`friendDisplayNameOnly`** в `displayName.js`. На странице **`/friends`** имя и примечание разнесены (примечание справа / в форме); **редактирование примечания** — развёрнутая карточка → `POST /friends/note`. На главной виджет друзей может по-прежнему использовать строку «Имя (заметка)». `usePresenceHeartbeat` передаёт `user` для корректного имени в heartbeat. `FriendsIncomingModal` — входящие заявки (принять / отклонить, поле заметки при принятии). Лобби: **«Добавить в друзья»** шлёт заявку; **«Заявка отправлена»** при исходящем pending.

---

## 11. Инструменты разработки (не прод)

**Папка:** `tools/multiplayer-sandbox/`

- Отдельный `package.json`, зависимость **Playwright**.
- Скрипт **`open-players.mjs`** открывает несколько окон Chromium с **разным** `localStorage` (`gameHub_webPlayerId`, `gameHub_webDisplayName`) — несколько «игроков» без правок основного кода.
- См. `tools/multiplayer-sandbox/README.md`.

---

## 12. Связанные документы

| Файл | Содержание |
|------|------------|
| `README.md` | Быстрый старт |
| `SETUP.md` | Переменные окружения |
| `DEPLOY.md` | Git, сервер, Docker |
| `QA_SMOKE_REGRESSION.md` | Регрессия |
| `docs/PROJECT_PASSPORT.md` | Этот паспорт |

---

## 13. Журнал изменений (архив правок по сессиям)

Добавляйте строки **от новых к старым**.

| Дата | Что сделано |
|------|-------------|
| 2026-03-17 | **Мафия:** состав как у конкурентов — **⌈n/4⌉** «чёрных» (дон + мафии), комиссар, мирные; минимум **6** за столом (`MIN_MAFIA_PLAYERS_*`, лобби `MIN_PLAYERS.mafia`). |
| 2026-03-17 | **Мафия:** минимум игроков за столом снижен до **5** (сервер `MIN_MAFIA_PLAYERS_CLASSIC` / `EXTENDED`, `rooms.js` `/mafia/start`, лобби `MIN_PLAYERS.mafia`). |
| 2026-03-17 | **Мафия:** минимум **6** игроков за столом (без ведущего); фазы подготовки `prep_day_1` → `night_meet` → `prep_day_2`, затем обычная игра; первая ночь мафии без убийств (`killNightEnabled`); таймеры `prepDay` / `nightMeet` в лобби и старте; клиент `MafiaRound.jsx`, примечания друзей у имён; шапка `GameplayScreen`: «На главную», фикс кликов «Назад». **Друзья:** `POST /friends/note`, страница `/friends` — смена примечания; `friendDisplayNameOnly`. Паспорт: §9, обновлена таблица API в §10. |
| 2026-03-17 | **Правда или действие:** убраны команды; очередь ходов — `truthDareTurnOrder` + режим `truthDareOrderMode` (`host` / `random`); лобби вкладка «Очередь» с drag-and-drop для ведущего; `assign-team` только для Элиаса; `syncTruthDareTurnOrder` в `roomManager`. |
| 2026-03-17 | **Конец матча:** при `endGame` комната переходила в лобби → маршрут `/spy`, `/elias` и др. сбрасывался на `/lobby` и экран победы исчезал. Исправление: `lastGameResult` на сервере (шпион, элиас, мафия, бункер; П/Д уже было), `allowGameRoundRoute` в `App.jsx`, `game_ended` не редиректит с игровых путей; клиенты читают итог из `room.lastGameResult`. |
| 2026-03-17 | **Элиас:** `useSwipeGesturesEnabled` — свайп только при `maxTouchPoints` или `(pointer: coarse)`; на ПК только кнопки (нет ложных срабатываний мышью). |
| 2026-03-17 | **Элиас (ПК/Chrome):** цепочка flex для `.gameplay__inner` + `GameLayout` (`elias-round__layout`), центрирование колонки с картой, `transform` свайпа через inline вместо CSS-переменных; правки `eliasRound.css`. |
| 2026-03-17 | Друзья: **заявки** (request/accept/reject), заметка при принятии, отображение «Имя (заметка)»; имя для Telegram через `resolvePublicDisplayName` в heartbeat и заявках; `FriendsIncomingModal`. |
| 2026-03-17 | Система **Друзья**: `friendsStore`/`presenceStore`/`friendsRoutes`, heartbeat в `App`, блок на главной (до 3), страница `/friends`, лобби — добавить в друзья; паспорт (тогда §9 — маршруты). |
| 2026-03-17 | `SETUP.md`: подсказка при ошибке `Cannot find package 'vite-plugin-pwa'` — выполнить `npm install` в `app/`. |
| 2026-03-17 | `tools/multiplayer-sandbox/open-players.mjs`: обработка ошибки `page.goto`, ожидание выхода без TTY (Ctrl+C вместо мгновенного закрытия окон); README — типичные причины «окна сразу закрылись». |
| 2026-03-17 | Создан `docs/PROJECT_PASSPORT.md`; добавлено правило Cursor (`.cursor/rules/project-passport.mdc`); ссылка в `README.md`; описаны лобби/команды Элиас, Элиас (ready-pre-round, слово только объясняющему), клиент (isMeExplainer, wordForMe), песочница `tools/multiplayer-sandbox`. |
| 2026-03-17 | Элиас: перед раундом «Готов» только у объясняющего; в state — `preRoundRequiredCount`; клиент `EliasRound.jsx` — кнопка только при `isMeExplainer`. |
| Ранее (сессии) | Автораспределение команд в лобби (`syncPartyTeams`, `partyTeamAssign`), ручная смена команды (`assign-team`), редизайн UI Элиаса (glass), модалка выхода, исправления UX Элиаса (кто объясняет, отгадывающий без слова, компактный таймер). |

---

## 14. Инструкция для агента / разработчика

1. Перед крупной задачей **прочитайте этот файл** и затронутые модули в `server/` и `app/`.
2. После изменения логики комнат, **мафии**, Элиаса, лобби или структуры API — **обновите соответствующий раздел** и **строку в журнале**.
3. Не дублируйте сюда весь код — только **контракты, имена файлов, алгоритмы и причины решений**.
