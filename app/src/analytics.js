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
  const countBy = (name, key, value) => events.filter((e) => e?.event === name && e?.[key] === value).length;
  const created = count('room_create');
  const joined = count('room_join');
  const started = count('game_start');
  const completed = count('match_completed');
  const inviteShares = count('invite_share');
  const inviteShareTelegram = countBy('invite_share', 'mode', 'telegram');
  const inviteShareClipboard = countBy('invite_share', 'mode', 'clipboard');
  const storeOpens = count('store_open');
  const storeClicks = count('store_item_click');
  const apiErrors = count('api_error');
  const apiTimeouts = events.filter((e) => e?.event === 'api_error' && e?.timeout).length;
  return {
    eventsCount: events.length,
    roomCreate: created,
    roomJoin: joined,
    gameStart: started,
    matchCompleted: completed,
    inviteShares,
    inviteShareTelegram,
    inviteShareClipboard,
    storeOpens,
    storeClicks,
    apiErrors,
    apiTimeouts,
    startFromCreateRate: created > 0 ? Math.round((started / created) * 100) : 0,
    completionFromStartRate: started > 0 ? Math.round((completed / started) * 100) : 0,
    storeCtr: storeOpens > 0 ? Math.round((storeClicks / storeOpens) * 100) : 0,
  };
}
