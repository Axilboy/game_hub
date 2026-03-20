import { track } from './analytics';

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
    if (!r.ok) {
      const body = await r.text();
      throw new Error(body || `HTTP ${r.status}`);
    }
    return await r.json();
  } catch (e) {
    if (e?.name !== 'AbortError') {
      track('api_error', { path: url.replace(API_URL, ''), message: String(e?.message || e).slice(0, 160) });
    }
    throw e;
  } finally {
    clearTimeout(timeoutId);
  }
}

export function getApiErrorMessage(error, fallback = 'Ошибка запроса') {
  if (!error) return fallback;
  const raw = String(error?.message || error || '').trim();
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      if (typeof parsed.error === 'string' && parsed.error.trim()) return parsed.error.trim();
      if (typeof parsed.message === 'string' && parsed.message.trim()) return parsed.message.trim();
    }
  } catch (_) {
    // message is plain text
  }
  if (raw.startsWith('{') && raw.endsWith('}')) return fallback;
  return raw;
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
