import {
  addFriendPair,
  removeFriendPair,
  getFriendIds,
  areFriends,
  getStoredDisplayName,
  setDisplayName,
} from './friendsStore.js';
import { touchPresence, getPresenceForFriend } from './presenceStore.js';

function parsePlayerId(q) {
  if (q == null || q === '') return null;
  const s = String(q).trim();
  return s || null;
}

/**
 * @param {import('fastify').FastifyInstance} fastify
 */
export async function friendsRoutes(fastify) {
  fastify.post('/presence/heartbeat', async (request, reply) => {
    const body = request.body || {};
    const playerId = parsePlayerId(body.playerId);
    if (!playerId) {
      return reply.code(400).send({ error: 'Нужен playerId' });
    }
    const loc = body.location;
    const location = loc === 'lobby' || loc === 'playing' ? loc : 'home';
    touchPresence({
      playerId,
      displayName: body.displayName,
      location,
      roomId: body.roomId ?? null,
      inviteToken: body.inviteToken ?? null,
      roomCode: body.roomCode ?? null,
    });
    if (body.displayName && String(body.displayName).trim()) {
      setDisplayName(playerId, String(body.displayName));
    }
    return { ok: true };
  });

  fastify.post('/friends/add', async (request, reply) => {
    const body = request.body || {};
    const playerId = parsePlayerId(body.playerId);
    const friendId = parsePlayerId(body.friendId);
    if (!playerId || !friendId) {
      return reply.code(400).send({ error: 'Нужны playerId и friendId' });
    }
    const r = addFriendPair(playerId, friendId, body.friendName);
    if (!r.ok) return reply.code(400).send({ error: r.error || 'Ошибка' });
    return { ok: true };
  });

  fastify.post('/friends/remove', async (request, reply) => {
    const body = request.body || {};
    const playerId = parsePlayerId(body.playerId);
    const friendId = parsePlayerId(body.friendId);
    if (!playerId || !friendId) {
      return reply.code(400).send({ error: 'Нужны playerId и friendId' });
    }
    if (!areFriends(playerId, friendId)) {
      return reply.code(400).send({ error: 'Не в списке друзей' });
    }
    removeFriendPair(playerId, friendId);
    return { ok: true };
  });

  fastify.get('/friends/list', async (request, reply) => {
    const playerId = parsePlayerId(request.query?.playerId);
    if (!playerId) {
      return reply.code(400).send({ error: 'Нужен playerId' });
    }
    const ids = getFriendIds(playerId);
    const friends = ids.map((fid) => {
      const pres = getPresenceForFriend(fid);
      const storedName = getStoredDisplayName(fid);
      const displayName = (pres.online && pres.displayName) || storedName || `Игрок ${fid.slice(-4)}`;
      const canJoinLobby =
        pres.online && pres.location === 'lobby' && Boolean(pres.inviteToken);
      return {
        id: fid,
        displayName,
        online: pres.online,
        location: pres.online ? pres.location : 'offline',
        roomCode: pres.roomCode || null,
        joinInviteToken: canJoinLobby ? pres.inviteToken : null,
      };
    });
    return { friends };
  });
}
