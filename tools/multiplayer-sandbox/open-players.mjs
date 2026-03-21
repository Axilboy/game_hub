/**
 * Открывает N окон Chromium. В каждом — свой web-игрок (localStorage),
 * как в useTelegram.js: gameHub_webPlayerId, gameHub_webDisplayName.
 * Основной код приложения не меняется.
 *
 * Перед запуском: поднять API и фронт (например localhost:5173).
 */

import { chromium } from 'playwright';
import readline from 'readline';

/** Совпадает с app/src/useTelegram.js */
const WEB_PLAYER_ID_KEY = 'gameHub_webPlayerId';
const WEB_NAME_KEY = 'gameHub_webDisplayName';

const DEFAULT_PLAYERS = [
  { id: 'web_mptest_denis', name: 'Денис' },
  { id: 'web_mptest_nastya', name: 'Настя' },
  { id: 'web_mptest_p3', name: 'Игрок 3' },
  { id: 'web_mptest_p4', name: 'Игрок 4' },
];

function parsePlayers() {
  const raw = process.env.PLAYERS_JSON;
  if (raw) {
    try {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr) && arr.length) {
        return arr.map((p, i) => ({
          id: String(p.id || `web_mptest_${i + 1}`),
          name: String(p.name || `Игрок ${i + 1}`),
        }));
      }
    } catch (e) {
      console.warn('PLAYERS_JSON невалиден, используем список по умолчанию:', e.message);
    }
  }
  const n = Math.min(8, Math.max(1, parseInt(process.env.COUNT || '3', 10) || 3));
  return DEFAULT_PLAYERS.slice(0, n);
}

const APP_URL = (process.env.APP_URL || 'http://localhost:5173').replace(/\/$/, '');
const players = parsePlayers();

const browser = await chromium.launch({
  headless: false,
  args: ['--window-size=480,920'],
});

const contexts = [];

for (let i = 0; i < players.length; i++) {
  const p = players[i];
  const ctx = await browser.newContext({
    viewport: { width: 420, height: 880 },
    locale: 'ru-RU',
  });
  await ctx.addInitScript(
    ({ id, name, kId, kName }) => {
      localStorage.setItem(kId, id);
      localStorage.setItem(kName, name);
    },
    { id: p.id, name: p.name, kId: WEB_PLAYER_ID_KEY, kName: WEB_NAME_KEY },
  );
  const page = await ctx.newPage();
  try {
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  } catch (e) {
    console.error(`\n[${i + 1}] Не удалось открыть ${APP_URL} для «${p.name}»:`, e.message);
    console.error('Сначала запусти фронт и сервер в корне проекта: npm run dev (или отдельно app на :5173).\n');
    await ctx.close().catch(() => {});
    await browser.close().catch(() => {});
    process.exit(1);
  }
  contexts.push({ ctx, page, name: p.name });
  console.log(`[${i + 1}] открыто: ${p.name} (${p.id})`);
}

console.log('');
console.log(`Готово: ${players.length} окон. URL: ${APP_URL}`);
console.log('Создай комнату в одном окне, остальные зайдут по приглашению / коду.');
console.log('');

// Без интерактивного stdin (двойной клик, некоторые оболочки) readline сразу «отвечает» — окна мгновенно закрывались.
if (process.stdin.isTTY) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  await new Promise((resolve) => {
    rl.question('Enter — закрыть все окна и выйти\n', () => resolve());
  });
  rl.close();
} else {
  console.log('Интерактивный ввод недоступен. Закрой окна вручную или нажми Ctrl+C здесь — тогда скрипт завершится.');
  await new Promise((resolve) => {
    process.once('SIGINT', resolve);
    process.once('SIGTERM', resolve);
  });
}

for (const { ctx } of contexts) {
  await ctx.close().catch(() => {});
}
await browser.close();
process.exit(0);
