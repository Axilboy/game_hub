const MAX_EVENTS = 200;
const ANALYTICS_KEY = 'gh_analytics';

export function track(event, props = {}) {
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.debug('[analytics]', event, props);
  }
  try {
    const raw = localStorage.getItem(ANALYTICS_KEY);
    const q = raw ? JSON.parse(raw) : [];
    q.push({ t: Date.now(), event, ...props });
    localStorage.setItem(ANALYTICS_KEY, JSON.stringify(q.slice(-MAX_EVENTS)));
  } catch (_) {}
}

export function getAnalyticsEvents() {
  try {
    const raw = localStorage.getItem(ANALYTICS_KEY);
    const q = raw ? JSON.parse(raw) : [];
    return Array.isArray(q) ? q : [];
  } catch (_) {
    return [];
  }
}

export function getFunnelSummary() {
  const events = getAnalyticsEvents();
  const count = (name) => events.filter((e) => e?.event === name).length;
  const created = count('room_create');
  const joined = count('room_join');
  const started = count('game_start');
  const completed = count('match_completed');
  return {
    eventsCount: events.length,
    roomCreate: created,
    roomJoin: joined,
    gameStart: started,
    matchCompleted: completed,
    startFromCreateRate: created > 0 ? Math.round((started / created) * 100) : 0,
    completionFromStartRate: started > 0 ? Math.round((completed / started) * 100) : 0,
  };
}
