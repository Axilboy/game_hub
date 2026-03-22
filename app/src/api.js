import { track } from './analytics';

const API_URL = (import.meta.env.VITE_API_URL !== undefined && import.meta.env.VITE_API_URL !== '')
  ? import.meta.env.VITE_API_URL
  : (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');

const TOKEN_KEY = 'gameHub_authToken';

function getStoredToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

/**
 * @param {string} url
 * @param {RequestInit & { skipAuth?: boolean }} options
 */
async function fetchJson(url, options = {}, timeoutMs = 10000) {
  const { skipAuth, ...rest } = options;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const headers = { ...(rest.headers && typeof rest.headers === 'object' ? rest.headers : {}) };
    const hasExplicitAuth = Boolean(headers.Authorization || headers.authorization);
    const token = !skipAuth && !hasExplicitAuth ? getStoredToken() : null;
    if (token) headers.Authorization = `Bearer ${token}`;

    const r = await fetch(url, {
      ...rest,
      headers,
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
  /**
   * @param {string} path
   * @param {RequestInit & { skipAuth?: boolean }} [options]
   */
  async get(path, options = {}) {
    return fetchJson(`${API_URL}/api${path}`, { ...options, method: 'GET' }, 10000);
  },
  /**
   * @param {string} path
   * @param {object} body
   * @param {RequestInit & { skipAuth?: boolean }} [options]
   */
  async post(path, body, options = {}) {
    return fetchJson(
      `${API_URL}/api${path}`,
      {
        ...options,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(options.headers && typeof options.headers === 'object' ? options.headers : {}),
        },
        body: JSON.stringify(body),
      },
      10000,
    );
  },
  async patch(path, body, options = {}) {
    return fetchJson(
      `${API_URL}/api${path}`,
      {
        ...options,
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(options.headers && typeof options.headers === 'object' ? options.headers : {}),
        },
        body: JSON.stringify(body),
      },
      10000,
    );
  },
};
