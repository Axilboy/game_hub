import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ADMIN_PASSWORD = '1973';
/** Путь к файлу статистики. В продекшене задайте STATS_FILE в env (например /var/data/gamehub/stats.json), чтобы счётчики не сбрасывались при деплое. */
const STATS_FILE = process.env.STATS_FILE || join(__dirname, '..', 'data', 'stats.json');

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

let byDate = new Map();
let adImpressionsByDate = new Map();

function load() {
  try {
    if (existsSync(STATS_FILE)) {
      const data = JSON.parse(readFileSync(STATS_FILE, 'utf8'));
      byDate = new Map(Object.entries(data.players || {}).map(([k, arr]) => [k, new Set(arr)]));
      adImpressionsByDate = new Map(Object.entries(data.adImpressions || {}));
    }
  } catch (_) {}
}

function save() {
  try {
    const dir = dirname(STATS_FILE);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const data = {
      players: Object.fromEntries([...byDate.entries()].map(([k, set]) => [k, [...set]])),
      adImpressions: Object.fromEntries(adImpressionsByDate),
    };
    writeFileSync(STATS_FILE, JSON.stringify(data, null, 0));
  } catch (_) {}
}

load();

function ensureSet(dateKey) {
  if (!byDate.has(dateKey)) byDate.set(dateKey, new Set());
  return byDate.get(dateKey);
}

export function recordPlayer(playerId) {
  const key = todayKey();
  ensureSet(key).add(String(playerId));
  save();
}

/** Учёт показов рекламы: при каждом старте игры каждый игрок в комнате видит рекламу. playerCount = число игроков в комнате на момент старта. */
export function recordGameStart(playerCount) {
  const key = todayKey();
  const prev = adImpressionsByDate.get(key) || 0;
  adImpressionsByDate.set(key, prev + Math.max(0, playerCount));
  save();
}

export function getStats() {
  const now = new Date();
  const dayKey = todayKey();
  const daySet = byDate.get(dayKey) || new Set();

  let weekCount = 0;
  const weekSet = new Set();
  for (let i = 0; i < 7; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    for (const id of byDate.get(k) || []) weekSet.add(id);
  }
  weekCount = weekSet.size;

  let monthCount = 0;
  const monthSet = new Set();
  for (let i = 0; i < 30; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    for (const id of byDate.get(k) || []) monthSet.add(id);
  }
  monthCount = monthSet.size;

  let totalCount = 0;
  const totalSet = new Set();
  for (const set of byDate.values()) {
    for (const id of set) totalSet.add(id);
  }
  totalCount = totalSet.size;

  let adDay = adImpressionsByDate.get(dayKey) || 0;
  let adMonth = 0;
  for (let i = 0; i < 30; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    adMonth += adImpressionsByDate.get(k) || 0;
  }
  let adTotal = 0;
  for (const n of adImpressionsByDate.values()) adTotal += n;

  return {
    day: daySet.size,
    week: weekCount,
    month: monthCount,
    total: totalCount,
    adImpressionsDay: adDay,
    adImpressionsMonth: adMonth,
    adImpressionsTotal: adTotal,
  };
}

export function checkAdminPassword(password) {
  return password === ADMIN_PASSWORD;
}
