import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { getGameHubDataDir } from './dataPaths.js';

const DEV_ADMIN_PASSWORD = '1973';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || DEV_ADMIN_PASSWORD;
if (process.env.NODE_ENV === 'production' && (!process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD === DEV_ADMIN_PASSWORD)) {
  throw new Error('ADMIN_PASSWORD is required in production and must not use default value');
}
const DATA_DIR = getGameHubDataDir();
/** Явный путь к stats.json (перекрывает расположение по GAMEHUB_DATA_DIR) */
const STATS_FILE = process.env.STATS_FILE || join(DATA_DIR, 'stats.json');

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

let byDate = new Map();
let adImpressionsByDate = new Map();
let gamesStartedByDate = new Map();
/** Сколько раз начата игра по типу (за всё время, накопительно) */
let gamesByGameTotal = new Map();
/** Веб-аналитика по трафику/воронке */
let siteVisitorsByDate = new Map();
let siteSessionsByDate = new Map();
let pageViewsByDate = new Map();
let pageViewsByPath = new Map();
let entryPages = new Map();
let pageDwellByPath = new Map(); // path -> { totalMs, count }
let sourceByType = new Map(); // direct/referral/organic/utm
let sourceByName = new Map(); // google/yandex/telegram/direct/...
let utmCampaigns = new Map();
let saveTimer = null;
let saveInFlight = false;
let pendingSave = false;
const DAILY_RETENTION_DAYS = 180;
const MAX_TOP_KEYS = 500;

function load() {
  try {
    if (existsSync(STATS_FILE)) {
      const data = JSON.parse(readFileSync(STATS_FILE, 'utf8'));
      byDate = new Map(Object.entries(data.players || {}).map(([k, arr]) => [k, new Set(arr)]));
      adImpressionsByDate = new Map(Object.entries(data.adImpressions || {}));
      gamesStartedByDate = new Map(Object.entries(data.gamesStarted || {}));
      gamesByGameTotal = new Map(Object.entries(data.gamesByGame || {}));
      siteVisitorsByDate = new Map(Object.entries(data.siteVisitorsByDate || {}).map(([k, arr]) => [k, new Set(arr)]));
      siteSessionsByDate = new Map(Object.entries(data.siteSessionsByDate || {}));
      pageViewsByDate = new Map(Object.entries(data.pageViewsByDate || {}));
      pageViewsByPath = new Map(Object.entries(data.pageViewsByPath || {}));
      entryPages = new Map(Object.entries(data.entryPages || {}));
      pageDwellByPath = new Map(Object.entries(data.pageDwellByPath || {}));
      sourceByType = new Map(Object.entries(data.sourceByType || {}));
      sourceByName = new Map(Object.entries(data.sourceByName || {}));
      utmCampaigns = new Map(Object.entries(data.utmCampaigns || {}));
    }
  } catch (_) {}
}

function writeNow() {
  try {
    pruneStatsStorage();
    const dir = dirname(STATS_FILE);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const data = {
      players: Object.fromEntries([...byDate.entries()].map(([k, set]) => [k, [...set]])),
      adImpressions: Object.fromEntries(adImpressionsByDate),
      gamesStarted: Object.fromEntries(gamesStartedByDate),
      gamesByGame: Object.fromEntries(gamesByGameTotal),
      siteVisitorsByDate: Object.fromEntries([...siteVisitorsByDate.entries()].map(([k, set]) => [k, [...set]])),
      siteSessionsByDate: Object.fromEntries(siteSessionsByDate),
      pageViewsByDate: Object.fromEntries(pageViewsByDate),
      pageViewsByPath: Object.fromEntries(pageViewsByPath),
      entryPages: Object.fromEntries(entryPages),
      pageDwellByPath: Object.fromEntries(pageDwellByPath),
      sourceByType: Object.fromEntries(sourceByType),
      sourceByName: Object.fromEntries(sourceByName),
      utmCampaigns: Object.fromEntries(utmCampaigns),
    };
    writeFileSync(STATS_FILE, JSON.stringify(data, null, 0));
  } catch (_) {}
}

function save() {
  pendingSave = true;
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    if (saveInFlight || !pendingSave) return;
    saveInFlight = true;
    pendingSave = false;
    try {
      writeNow();
    } finally {
      saveInFlight = false;
      if (pendingSave) save();
    }
  }, 500);
}

load();

function ensureSet(dateKey) {
  if (!byDate.has(dateKey)) byDate.set(dateKey, new Set());
  return byDate.get(dateKey);
}

function ensureSiteVisitorSet(dateKey) {
  if (!siteVisitorsByDate.has(dateKey)) siteVisitorsByDate.set(dateKey, new Set());
  return siteVisitorsByDate.get(dateKey);
}

function incr(map, key, by = 1) {
  map.set(key, (map.get(key) || 0) + by);
}

function makeDayKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function pruneDailyMap(map, keepDays = DAILY_RETENTION_DAYS) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - keepDays);
  const cutoffKey = makeDayKey(cutoff);
  for (const key of map.keys()) {
    if (String(key) < cutoffKey) map.delete(key);
  }
}

function capTopMap(map, limit = MAX_TOP_KEYS) {
  if (map.size <= limit) return;
  const sorted = [...map.entries()].sort((a, b) => (Number(b[1]) || 0) - (Number(a[1]) || 0));
  map.clear();
  for (const [k, v] of sorted.slice(0, limit)) map.set(k, v);
}

function capDwellMap(map, limit = MAX_TOP_KEYS) {
  if (map.size <= limit) return;
  const score = (row) => Number(row?.totalMs || 0);
  const sorted = [...map.entries()].sort((a, b) => score(b[1]) - score(a[1]));
  map.clear();
  for (const [k, v] of sorted.slice(0, limit)) map.set(k, v);
}

function pruneStatsStorage() {
  pruneDailyMap(byDate);
  pruneDailyMap(siteVisitorsByDate);
  pruneDailyMap(siteSessionsByDate);
  pruneDailyMap(pageViewsByDate);
  pruneDailyMap(adImpressionsByDate);
  pruneDailyMap(gamesStartedByDate);
  capTopMap(pageViewsByPath);
  capTopMap(entryPages);
  capTopMap(sourceByName);
  capTopMap(sourceByType, 32);
  capTopMap(utmCampaigns);
  capDwellMap(pageDwellByPath);
}

function normPath(p) {
  const s = String(p || '').trim();
  if (!s) return '/';
  return s.startsWith('/') ? s.slice(0, 120) : `/${s.slice(0, 120)}`;
}

function normName(v, fallback = 'unknown', max = 64) {
  const s = String(v || '').trim().toLowerCase();
  return s ? s.slice(0, max) : fallback;
}

export function recordPlayer(playerId) {
  const key = todayKey();
  ensureSet(key).add(String(playerId));
  save();
}

/**
 * Старт игры в комнате.
 * @param {string} [gameId] — spy | mafia | elias | truth_dare | bunker
 */
export function recordGameSession(gameId) {
  const key = todayKey();
  gamesStartedByDate.set(key, (gamesStartedByDate.get(key) || 0) + 1);
  const g = String(gameId || 'unknown').slice(0, 32);
  gamesByGameTotal.set(g, (gamesByGameTotal.get(g) || 0) + 1);
  save();
}

export function recordAdImpression() {
  const key = todayKey();
  adImpressionsByDate.set(key, (adImpressionsByDate.get(key) || 0) + 1);
  save();
}

/**
 * Сбор веб-аналитики (минимум, без персональных данных): сессии, источники, страницы, время на странице.
 * @param {{
 *   type: 'session_start'|'page_view'|'page_dwell',
 *   visitorId?: string,
 *   path?: string,
 *   dwellMs?: number,
 *   sourceType?: string,
 *   sourceName?: string,
 *   utmCampaign?: string
 * }} ev
 */
export function recordWebAnalytics(ev) {
  const type = String(ev?.type || '');
  const dayKey = todayKey();
  const visitorId = String(ev?.visitorId || '').slice(0, 64);
  const path = normPath(ev?.path);

  if (type === 'session_start') {
    if (visitorId) ensureSiteVisitorSet(dayKey).add(visitorId);
    incr(siteSessionsByDate, dayKey, 1);
    incr(entryPages, path, 1);
    incr(sourceByType, normName(ev?.sourceType, 'direct'), 1);
    incr(sourceByName, normName(ev?.sourceName, 'direct'), 1);
    const campaign = normName(ev?.utmCampaign, '', 80);
    if (campaign) incr(utmCampaigns, campaign, 1);
    save();
    return;
  }

  if (type === 'page_view') {
    incr(pageViewsByDate, dayKey, 1);
    incr(pageViewsByPath, path, 1);
    save();
    return;
  }

  if (type === 'page_dwell') {
    const dwellMs = Math.max(0, Math.min(30 * 60 * 1000, Number(ev?.dwellMs) || 0));
    if (dwellMs < 1000) return;
    const row = pageDwellByPath.get(path) || { totalMs: 0, count: 0 };
    row.totalMs += dwellMs;
    row.count += 1;
    pageDwellByPath.set(path, row);
    save();
  }
}

function sumLastDays(map, days) {
  const now = new Date();
  let sum = 0;
  for (let i = 0; i < days; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    sum += Number(map.get(k) || 0);
  }
  return sum;
}

function uniqueLastDays(setsMap, days) {
  const now = new Date();
  const agg = new Set();
  for (let i = 0; i < days; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    for (const id of setsMap.get(k) || []) agg.add(id);
  }
  return agg.size;
}

function topEntries(map, limit = 10) {
  return [...map.entries()]
    .sort((a, b) => (Number(b[1]) || 0) - (Number(a[1]) || 0))
    .slice(0, limit)
    .map(([key, value]) => ({ key, value: Number(value) || 0 }));
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

  let gamesDay = gamesStartedByDate.get(dayKey) || 0;
  let gamesMonth = 0;
  for (let i = 0; i < 30; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    gamesMonth += gamesStartedByDate.get(k) || 0;
  }

  let gamesStartedLifetime = 0;
  for (const n of gamesByGameTotal.values()) gamesStartedLifetime += n;

  const siteVisitorsToday = (siteVisitorsByDate.get(dayKey) || new Set()).size;
  const siteVisitorsWeek = uniqueLastDays(siteVisitorsByDate, 7);
  const siteVisitorsMonth = uniqueLastDays(siteVisitorsByDate, 30);
  const siteVisitorsTotal = (() => {
    const all = new Set();
    for (const set of siteVisitorsByDate.values()) {
      for (const id of set) all.add(id);
    }
    return all.size;
  })();
  const siteSessionsToday = Number(siteSessionsByDate.get(dayKey) || 0);
  const siteSessionsWeek = sumLastDays(siteSessionsByDate, 7);
  const siteSessionsMonth = sumLastDays(siteSessionsByDate, 30);
  const siteSessionsTotal = [...siteSessionsByDate.values()].reduce((acc, n) => acc + (Number(n) || 0), 0);
  const pageViewsToday = Number(pageViewsByDate.get(dayKey) || 0);
  const pageViewsWeek = sumLastDays(pageViewsByDate, 7);
  const pageViewsMonth = sumLastDays(pageViewsByDate, 30);
  const avgSessionsPerVisitor = siteVisitorsTotal > 0 ? Math.round((siteSessionsTotal / siteVisitorsTotal) * 100) / 100 : 0;

  return {
    day: daySet.size,
    week: weekCount,
    month: monthCount,
    total: totalCount,
    adImpressionsDay: adDay,
    adImpressionsMonth: adMonth,
    adImpressionsTotal: adTotal,
    gamesStartedDay: gamesDay,
    gamesStartedMonth: gamesMonth,
    gamesStartedLifetime,
    gamesByGame: Object.fromEntries(gamesByGameTotal),
    siteVisitorsToday,
    siteVisitorsWeek,
    siteVisitorsMonth,
    siteVisitorsTotal,
    siteSessionsToday,
    siteSessionsWeek,
    siteSessionsMonth,
    siteSessionsTotal,
    pageViewsToday,
    pageViewsWeek,
    pageViewsMonth,
    avgSessionsPerVisitor,
    topPages: topEntries(pageViewsByPath, 15),
    topEntryPages: topEntries(entryPages, 10),
    topSourceTypes: topEntries(sourceByType, 8),
    topSourceNames: topEntries(sourceByName, 12),
    topCampaigns: topEntries(utmCampaigns, 12),
    topPageDwell: topEntries(
      new Map(
        [...pageDwellByPath.entries()].map(([path, row]) => {
          const avg = row?.count > 0 ? Math.round((Number(row.totalMs) / Number(row.count)) / 1000) : 0;
          return [path, avg];
        }),
      ),
      15,
    ),
  };
}

export function getPublicStats() {
  const s = getStats();
  return {
    playersToday: s.day,
    playersWeek: s.week,
    gamesStartedToday: s.gamesStartedDay,
    gamesStartedMonth: s.gamesStartedMonth,
    adCompletedToday: s.adImpressionsDay,
  };
}

export function checkAdminPassword(password) {
  return password === ADMIN_PASSWORD;
}

process.on('exit', () => {
  if (saveTimer) clearTimeout(saveTimer);
  if (pendingSave) {
    try {
      writeNow();
    } catch (_) {}
  }
});
