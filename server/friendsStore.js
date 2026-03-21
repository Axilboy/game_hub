import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FRIENDS_FILE = process.env.FRIENDS_FILE || join(__dirname, '..', 'data', 'friends.json');

/** @type {Map<string, Set<string>>} */
let adj = new Map();
/** @type {Map<string, string>} */
let displayNames = new Map();

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
    writeFileSync(FRIENDS_FILE, JSON.stringify({ adj: adjObj, names: namesObj }, null, 0));
  } catch (_) {}
}

load();

function ensureSet(playerId) {
  const id = String(playerId);
  if (!adj.has(id)) adj.set(id, new Set());
  return adj.get(id);
}

export function addFriendPair(playerId, friendId, friendDisplayName) {
  const a = String(playerId);
  const b = String(friendId);
  if (a === b) return { ok: false, error: 'Нельзя добавить себя' };
  ensureSet(a).add(b);
  ensureSet(b).add(a);
  if (friendDisplayName && String(friendDisplayName).trim()) {
    displayNames.set(b, String(friendDisplayName).trim().slice(0, 80));
  }
  save();
  return { ok: true };
}

export function removeFriendPair(playerId, friendId) {
  const a = String(playerId);
  const b = String(friendId);
  ensureSet(a).delete(b);
  ensureSet(b).delete(a);
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
  displayNames.set(String(playerId), String(name).trim().slice(0, 80));
  save();
}

export function getStoredDisplayName(playerId) {
  return displayNames.get(String(playerId)) || '';
}
