const API_URL = (import.meta.env.VITE_API_URL !== undefined && import.meta.env.VITE_API_URL !== '')
  ? import.meta.env.VITE_API_URL
  : (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');

function withTimeout(ms, signal) {
  if (!ms || ms <= 0) return signal;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(new Error('timeout')), ms);
  // If caller already provides a signal, combine it.
  if (signal) {
    if (signal.aborted) controller.abort();
    signal.addEventListener('abort', () => controller.abort(), { once: true });
  }
  // Always clear timer.
  controller.signal.addEventListener('abort', () => clearTimeout(timeoutId), { once: true });
  return controller.signal;
}

async function fetchJson(url, options = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const r = await fetch(url, {
      ...options,
      credentials: 'include',
      signal: controller.signal,
    });
    if (!r.ok) throw new Error(await r.text());
    return await r.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

export const api = {
  async get(path) {
    return fetchJson(`${API_URL}/api${path}`, { method: 'GET' }, 10000);
  },
  async post(path, body) {
    return fetchJson(
      `${API_URL}/api${path}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
      10000,
    );
  },
  async patch(path, body) {
    return fetchJson(
      `${API_URL}/api${path}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
      10000,
    );
  },
};
