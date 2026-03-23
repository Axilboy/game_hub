import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'crypto';

const DEV_JWT_SECRET = 'gamehub-dev-jwt-change-in-production';
const JWT_SECRET = process.env.JWT_SECRET || DEV_JWT_SECRET;
if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || process.env.JWT_SECRET === DEV_JWT_SECRET)) {
  throw new Error('JWT_SECRET is required in production and must not use default value');
}

export function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = scryptSync(String(password), salt, 64);
  return { salt: salt.toString('hex'), hash: hash.toString('hex') };
}

export function verifyPassword(password, saltHex, hashHex) {
  try {
    const salt = Buffer.from(saltHex, 'hex');
    const hash = scryptSync(String(password), salt, 64);
    const expected = Buffer.from(hashHex, 'hex');
    if (hash.length !== expected.length) return false;
    return timingSafeEqual(hash, expected);
  } catch {
    return false;
  }
}

function b64url(buf) {
  return Buffer.from(buf)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export function signJwt(payload, expiresInSec = 60 * 60 * 24 * 30) {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = {
    ...payload,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + expiresInSec,
  };
  const payloadB = b64url(JSON.stringify(body));
  const sig = createHmac('sha256', JWT_SECRET).update(`${header}.${payloadB}`).digest('base64');
  const sigUrl = sig.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${header}.${payloadB}.${sigUrl}`;
}

export function verifyJwt(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, payloadB, sig] = parts;
  const expected = createHmac('sha256', JWT_SECRET).update(`${header}.${payloadB}`).digest('base64');
  const sigUrl = expected.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  if (sig !== sigUrl) return null;
  try {
    const json = JSON.parse(Buffer.from(payloadB.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
    if (json.exp && json.exp < Math.floor(Date.now() / 1000)) return null;
    return json;
  } catch {
    return null;
  }
}

export function getBearerToken(request) {
  const h = request.headers?.authorization || request.headers?.Authorization;
  if (!h || typeof h !== 'string') return null;
  const m = /^Bearer\s+(.+)$/i.exec(h.trim());
  return m ? m[1].trim() : null;
}

/** Гость браузера без входа — id вида web_… */
export function isWebGuestId(playerId) {
  return String(playerId || '').startsWith('web_');
}

/** Telegram user id в Mini App — числовая строка */
export function isTelegramNumericId(playerId) {
  const s = String(playerId || '');
  return /^\d+$/.test(s) && s.length < 20;
}

/** Аккаунт по почте — acc_… */
export function isAccountId(playerId) {
  return String(playerId || '').startsWith('acc_');
}

/**
 * Друзья и покупки: разрешено для Telegram (числовой id) или acc_ + валидный JWT.
 * Гость web_* без JWT — запрещено.
 */
export function assertFriendsOrShopPlayer(request, playerId) {
  const pid = String(playerId || '').trim();
  if (!pid) return { ok: false, status: 400, error: 'Нужен playerId' };
  if (isTelegramNumericId(pid)) {
    return { ok: true, mode: 'telegram' };
  }
  if (isWebGuestId(pid)) {
    return { ok: false, status: 403, error: 'Войдите в аккаунт: регистрация по почте или откройте приложение в Telegram' };
  }
  if (isAccountId(pid)) {
    const token = getBearerToken(request);
    if (!token) return { ok: false, status: 401, error: 'Нужна авторизация' };
    const pl = verifyJwt(token);
    if (!pl || String(pl.sub) !== pid) {
      return { ok: false, status: 403, error: 'Сессия недействительна. Войдите снова.' };
    }
    return { ok: true, mode: 'account', payload: pl };
  }
  return { ok: false, status: 403, error: 'Неизвестный тип аккаунта' };
}
