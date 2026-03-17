const STATS_KEY = 'gameHub_stats';

export function getStats() {
  try {
    const s = JSON.parse(localStorage.getItem(STATS_KEY) || '{}');
    return {
      firstVisitAt: s.firstVisitAt || null,
      totalTimeSpent: s.totalTimeSpent || 0,
      lastVisitAt: s.lastVisitAt || null,
      gamesPlayed: s.gamesPlayed || 0,
    };
  } catch {
    return { firstVisitAt: null, totalTimeSpent: 0, lastVisitAt: null, gamesPlayed: 0 };
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
