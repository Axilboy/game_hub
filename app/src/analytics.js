const MAX_EVENTS = 200;

export function track(event, props = {}) {
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.debug('[analytics]', event, props);
  }
  try {
    const raw = localStorage.getItem('gh_analytics');
    const q = raw ? JSON.parse(raw) : [];
    q.push({ t: Date.now(), event, ...props });
    localStorage.setItem('gh_analytics', JSON.stringify(q.slice(-MAX_EVENTS)));
  } catch (_) {}
}
