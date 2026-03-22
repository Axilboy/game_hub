import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { nanoid } from 'nanoid';
import { getGameHubDataDir } from './dataPaths.js';
import { hashPassword, verifyPassword } from './authCore.js';

const ACCOUNTS_FILE = process.env.ACCOUNTS_FILE || join(getGameHubDataDir(), 'accounts.json');

function loadRaw() {
  try {
    if (!existsSync(ACCOUNTS_FILE)) return { byId: {}, byEmail: {} };
    const data = JSON.parse(readFileSync(ACCOUNTS_FILE, 'utf8'));
    return {
      byId: typeof data.byId === 'object' && data.byId ? data.byId : {},
      byEmail: typeof data.byEmail === 'object' && data.byEmail ? data.byEmail : {},
    };
  } catch {
    return { byId: {}, byEmail: {} };
  }
}

function saveRaw(state) {
  const dir = dirname(ACCOUNTS_FILE);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(
    ACCOUNTS_FILE,
    JSON.stringify({ byId: state.byId, byEmail: state.byEmail }, null, 0),
    'utf8',
  );
}

let state = loadRaw();

export function findAccountByEmail(email) {
  const e = String(email || '')
    .trim()
    .toLowerCase();
  if (!e) return null;
  const id = state.byEmail[e];
  return id ? state.byId[id] : null;
}

export function findAccountById(id) {
  return state.byId[String(id)] || null;
}

export function createAccount({ email, password, displayName }) {
  const e = String(email || '')
    .trim()
    .toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return { ok: false, error: 'Некорректный email' };
  if (String(password || '').length < 8) return { ok: false, error: 'Пароль не короче 8 символов' };
  if (state.byEmail[e]) return { ok: false, error: 'Этот email уже зарегистрирован' };

  const id = `acc_${nanoid(16)}`;
  const { salt, hash } = hashPassword(password);
  const row = {
    id,
    email: e,
    passwordSalt: salt,
    passwordHash: hash,
    displayName: String(displayName || '').trim().slice(0, 80) || 'Игрок',
    createdAt: Date.now(),
  };
  state.byId[id] = row;
  state.byEmail[e] = id;
  saveRaw(state);
  return { ok: true, account: row };
}

export function verifyAccountLogin(email, password) {
  const row = findAccountByEmail(email);
  if (!row) return { ok: false, error: 'Неверный email или пароль' };
  if (!verifyPassword(password, row.passwordSalt, row.passwordHash)) {
    return { ok: false, error: 'Неверный email или пароль' };
  }
  return { ok: true, account: row };
}
