/** Считаем игрока «онлайн», если heartbeat был не старше этого окна (мс). */
export const PRESENCE_ONLINE_MS = 45_000;

/** @typedef {{ at: number, displayName: string, location: 'home'|'lobby'|'playing', roomId: string|null, inviteToken: string|null, roomCode: string|null }} PresenceRow */

/** @type {Map<string, PresenceRow>} */
const byPlayer = new Map();

/**
 * @param {object} p
 * @param {string} p.playerId
 * @param {string} [p.displayName]
 * @param {'home'|'lobby'|'playing'} [p.location]
 * @param {string|null} [p.roomId]
 * @param {string|null} [p.inviteToken]
 * @param {string|null} [p.roomCode]
 */
export function touchPresence(p) {
  const id = String(p.playerId);
  const location = p.location === 'lobby' || p.location === 'playing' ? p.location : 'home';
  byPlayer.set(id, {
    at: Date.now(),
    displayName: (p.displayName && String(p.displayName).trim()) ? String(p.displayName).trim().slice(0, 80) : '',
    location,
    roomId: p.roomId ? String(p.roomId) : null,
    inviteToken: p.inviteToken ? String(p.inviteToken) : null,
    roomCode: p.roomCode ? String(p.roomCode).replace(/\D/g, '').slice(0, 8) : null,
  });
}

/**
 * @param {string} friendId
 * @returns {{ online: boolean, displayName: string, location: 'home'|'lobby'|'playing'|null, roomId: string|null, inviteToken: string|null, roomCode: string|null }}
 */
export function getPresenceForFriend(friendId) {
  const row = byPlayer.get(String(friendId));
  if (!row) {
    return {
      online: false,
      displayName: '',
      location: null,
      roomId: null,
      inviteToken: null,
      roomCode: null,
    };
  }
  const online = Date.now() - row.at < PRESENCE_ONLINE_MS;
  if (!online) {
    return {
      online: false,
      displayName: row.displayName || '',
      location: null,
      roomId: null,
      inviteToken: null,
      roomCode: null,
    };
  }
  return {
    online: true,
    displayName: row.displayName || '',
    location: row.location,
    roomId: row.roomId,
    inviteToken: row.inviteToken,
    roomCode: row.roomCode,
  };
}
