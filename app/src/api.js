import { track } from './analytics';

const API_URL = (import.meta.env.VITE_API_URL !== undefined && import.meta.env.VITE_API_URL !== '')
  ? import.meta.env.VITE_API_URL
  : (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');

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
    const isAbort = e?.name === 'AbortError';
    track('api_error', {
      path: url.replace(API_URL, ''),
      message: String(e?.message || e).slice(0, 160),
      timeout: isAbort,
    });
    throw e;
  } finally {
    clearTimeout(timeoutId);
  }
}

export function getApiErrorMessage(error, fallback = 'Ошибка запроса') {
  if (!error) return fallback;
  if (error?.name === 'AbortError') return 'Сервер отвечает слишком долго. Попробуйте ещё раз.';
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
