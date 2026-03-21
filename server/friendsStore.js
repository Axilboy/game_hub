import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FRIENDS_FILE = process.env.FRIENDS_FILE || join(__dirname, '..', 'data', 'friends.json');

/** @type {Map<string, Set<string>>} */
let adj = new Map();
/** @type {Map<string, string>} глобальные имена игроков (последний heartbeat / заявка) */
let displayNames = new Map();
/** @type {Map<string, Map<string, string>>} notes[viewerId][friendId] — заметка «как зовут в жизни» */
let notes = new Map();
/** @type {Array<{ from: string, to: string, fromName: string, at: number }>} */
let pending = [];

function load() {
  try {
    if (!existsSync(FRIENDS_FILE)) return;
    const data = JSON.parse(readFileSync(FRIENDS_FILE, 'utf8'));
    adj = new Map();
    for (const [k, arr] of Object.entries(data.adj || {})) {
      const id = String(k);
      const set = new Set((Array.isArray(arr) ? arr : []).map(String));
      adj.set(id, set);
    }
    displayNames = new Map(Object.entries(data.names || {}).map(([k, v]) => [String(k), String(v || '')]));
    notes = new Map();
    for (const [owner, obj] of Object.entries(data.notes || {})) {
      const m = new Map();
      if (obj && typeof obj === 'object') {
        for (const [fid, text] of Object.entries(obj)) {
          m.set(String(fid), String(text || '').slice(0, 120));
        }
      }
      notes.set(String(owner), m);
    }
    pending = Array.isArray(data.pending)
      ? data.pending.map((p) => ({
          from: String(p.from),
          to: String(p.to),
          fromName: String(p.fromName || '').slice(0, 120),
          at: Number(p.at) || 0,
        }))
      : [];
  } catch (_) {}
}

function save() {
  try {
    const dir = dirname(FRIENDS_FILE);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const adjObj = {};
    for (const [k, set] of adj.entries()) {
      adjObj[k] = [...set];
    }
    const namesObj = Object.fromEntries(displayNames);
    const notesObj = {};
    for (const [owner, m] of notes.entries()) {
      notesObj[owner] = Object.fromEntries(m);
    }
    writeFileSync(
      FRIENDS_FILE,
      JSON.stringify({ adj: adjObj, names: namesObj, notes: notesObj, pending }, null, 0),
    );
  } catch (_) {}
}

load();

function ensureSet(playerId) {
  const id = String(playerId);
  if (!adj.has(id)) adj.set(id, new Set());
  return adj.get(id);
}

function ensureNotes(ownerId) {
  const id = String(ownerId);
  if (!notes.has(id)) notes.set(id, new Map());
  return notes.get(id);
}

export function getNote(ownerId, friendId) {
  return notes.get(String(ownerId))?.get(String(friendId)) || '';
}

export function setNoteFor(ownerId, friendId, text) {
  const t = String(text || '').trim().slice(0, 120);
  const m = ensureNotes(ownerId);
  if (!t) {
    m.delete(String(friendId));
  } else {
    m.set(String(friendId), t);
  }
  save();
}

export function addSymmetricFriends(fromId, friendId) {
  const a = String(fromId);
  const b = String(friendId);
  if (a === b) return;
  ensureSet(a).add(b);
  ensureSet(b).add(a);
}

/**
 * @param {string} playerId
 * @param {string} friendId
 * @param {string} friendDisplayName — как показывать friendId в списке у playerId (глобальное имя друга)
 */
export function setNameHintForFriend(playerId, friendId, friendDisplayName) {
  const name = String(friendDisplayName || '').trim().slice(0, 120);
  if (!name) return;
  displayNames.set(String(friendId), name);
}

export function addPendingRequest(from, to, fromName) {
  const a = String(from);
  const b = String(to);
  const fn = String(fromName || '').trim().slice(0, 120) || `Игрок ${a.slice(-4)}`;
  if (a === b) return { ok: false, error: 'Нельзя отправить заявку себе' };
  if (ensureSet(a).has(b)) return { ok: false, error: 'Уже в списке друзей' };
  if (pending.some((p) => p.from === a && p.to === b)) {
    return { ok: false, error: 'Заявка уже отправлена' };
  }
  if (pending.some((p) => p.from === b && p.to === a)) {
    return { ok: false, error: 'Этот игрок уже отправил вам заявку — откройте уведомление' };
  }
  pending.push({ from: a, to: b, fromName: fn, at: Date.now() });
  displayNames.set(a, fn);
  save();
  return { ok: true };
}

export function findPending(from, to) {
  return pending.find((p) => p.from === String(from) && p.to === String(to)) || null;
}

export function getIncomingRequests(toPlayerId) {
  const t = String(toPlayerId);
  return pending
    .filter((p) => p.to === t)
    .map((p) => ({
      fromId: p.from,
      fromName: p.fromName,
      requestedAt: p.at,
    }));
}

export function getOutgoingPendingTargets(fromPlayerId) {
  const f = String(fromPlayerId);
  return pending.filter((p) => p.from === f).map((p) => p.to);
}

export function removePending(from, to) {
  const a = String(from);
  const b = String(to);
  const i = pending.findIndex((p) => p.from === a && p.to === b);
  if (i === -1) return null;
  const [row] = pending.splice(i, 1);
  save();
  return row;
}

/**
 * Принятие: viewer = to (тот, кто принимает), from = отправитель заявки.
 * @param {string} note — заметка у принимающего о заявителе
 * @param {string} acceptorPublicName — имя принимающего для глобальной карты (видно другу)
 */
export function acceptPendingRequest(from, to, note, acceptorPublicName) {
  const row = removePending(from, to);
  if (!row) return { ok: false, error: 'Заявка не найдена' };
  addSymmetricFriends(from, to);
  const requesterName = row.fromName || `Игрок ${String(from).slice(-4)}`;
  const acceptorName = String(acceptorPublicName || '').trim().slice(0, 120) || `Игрок ${String(to).slice(-4)}`;
  displayNames.set(from, requesterName);
  displayNames.set(to, acceptorName);
  const noteTrim = String(note || '').trim().slice(0, 120);
  if (noteTrim) {
    ensureNotes(to).set(from, noteTrim);
  }
  save();
  return { ok: true };
}

export function rejectPendingRequest(from, to) {
  const row = removePending(from, to);
  if (!row) return { ok: false, error: 'Заявка не найдена' };
  save();
  return { ok: true };
}

/** Прямое добавление (старые клиенты / миграция) */
export function addFriendPair(playerId, friendId, friendDisplayName) {
  const a = String(playerId);
  const b = String(friendId);
  if (a === b) return { ok: false, error: 'Нельзя добавить себя' };
  if (ensureSet(a).has(b)) return { ok: true };
  addSymmetricFriends(a, b);
  if (friendDisplayName && String(friendDisplayName).trim()) {
    displayNames.set(b, String(friendDisplayName).trim().slice(0, 120));
  }
  save();
  return { ok: true };
}

export function removeFriendPair(playerId, friendId) {
  const a = String(playerId);
  const b = String(friendId);
  ensureSet(a).delete(b);
  ensureSet(b).delete(a);
  if (notes.has(a)) notes.get(a).delete(b);
  if (notes.has(b)) notes.get(b).delete(a);
  save();
  return { ok: true };
}

export function getFriendIds(playerId) {
  const set = adj.get(String(playerId));
  return set ? [...set] : [];
}

export function areFriends(a, b) {
  return ensureSet(a).has(String(b));
}

export function setDisplayName(playerId, name) {
  if (!name || !String(name).trim()) return;
  displayNames.set(String(playerId), String(name).trim().slice(0, 120));
  save();
}

export function getStoredDisplayName(playerId) {
  return displayNames.get(String(playerId)) || '';
}
