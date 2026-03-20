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
