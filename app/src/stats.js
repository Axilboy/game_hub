const STATS_KEY = 'gameHub_stats';

export function getStats() {
  try {
    const s = JSON.parse(localStorage.getItem(STATS_KEY) || '{}');
    return {
      firstVisitAt: s.firstVisitAt || null,
      totalTimeSpent: s.totalTimeSpent || 0,
      lastVisitAt: s.lastVisitAt || null,
      gamesPlayed: s.gamesPlayed || 0,
      gamesStarted: s.gamesStarted || 0,
      gamesByType: s.gamesByType && typeof s.gamesByType === 'object' ? s.gamesByType : {},
      lastPlayedGame: s.lastPlayedGame || null,
      dailyVisits: s.dailyVisits && typeof s.dailyVisits === 'object' ? s.dailyVisits : {},
      currentStreak: s.currentStreak || 0,
      bestStreak: s.bestStreak || 0,
    };
  } catch {
    return {
      firstVisitAt: null,
      totalTimeSpent: 0,
      lastVisitAt: null,
      gamesPlayed: 0,
      gamesStarted: 0,
      gamesByType: {},
      lastPlayedGame: null,
      dailyVisits: {},
      currentStreak: 0,
      bestStreak: 0,
    };
  }
}

export function saveStats(s) {
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(s));
  } catch (_) {}
}

export function incrementGamesPlayed() {
  const s = getStats();
  saveStats({ ...s, gamesPlayed: (s.gamesPlayed || 0) + 1 });
}

export function recordGameStart(game) {
  const s = getStats();
  saveStats({
    ...s,
    gamesStarted: (s.gamesStarted || 0) + 1,
    lastPlayedGame: game || s.lastPlayedGame || null,
  });
}

export function recordGameFinish(game) {
  const s = getStats();
  const key = game || 'unknown';
  const cur = s.gamesByType && typeof s.gamesByType === 'object' ? s.gamesByType : {};
  saveStats({
    ...s,
    gamesPlayed: (s.gamesPlayed || 0) + 1,
    lastPlayedGame: game || s.lastPlayedGame || null,
    gamesByType: {
      ...cur,
      [key]: (cur[key] || 0) + 1,
    },
  });
}

export function getLevelProgress(stats = getStats()) {
  const played = stats.gamesPlayed || 0;
  const level = Math.floor(played / 10) + 1;
  const progressInLevel = played % 10;
  return {
    level,
    nextLevelIn: 10 - progressInLevel,
    progressPercent: Math.round((progressInLevel / 10) * 100),
  };
}

function toDayKey(ts) {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function calcStreak(dailyVisits, nowTs = Date.now()) {
  const map = dailyVisits && typeof dailyVisits === 'object' ? dailyVisits : {};
  let streak = 0;
  const p = new Date(nowTs);
  p.setHours(0, 0, 0, 0);
  while (true) {
    const key = toDayKey(p.getTime());
    if (!map[key]) break;
    streak += 1;
    p.setDate(p.getDate() - 1);
  }
  return streak;
}

export function touchVisit(nowTs = Date.now()) {
  const s = getStats();
  const dayKey = toDayKey(nowTs);
  const dailyVisits = { ...(s.dailyVisits || {}) };
  dailyVisits[dayKey] = 1;
  const currentStreak = calcStreak(dailyVisits, nowTs);
  const bestStreak = Math.max(Number(s.bestStreak) || 0, currentStreak);
  saveStats({
    ...s,
    firstVisitAt: s.firstVisitAt || nowTs,
    lastVisitAt: nowTs,
    dailyVisits,
    currentStreak,
    bestStreak,
  });
}

export function addSessionTime(secondsDelta = 0) {
  const delta = Math.max(0, Number(secondsDelta) || 0);
  if (!delta) return;
  const s = getStats();
  saveStats({
    ...s,
    totalTimeSpent: (Number(s.totalTimeSpent) || 0) + delta,
  });
}
