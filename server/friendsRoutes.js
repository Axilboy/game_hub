import {
  addPendingRequest,
  addFriendPair,
  removeFriendPair,
  getFriendIds,
  areFriends,
  getStoredDisplayName,
  setDisplayName,
  getIncomingRequests,
  getOutgoingPendingTargets,
  acceptPendingRequest,
  rejectPendingRequest,
  getNote,
  setNoteFor,
} from './friendsStore.js';
import { touchPresence, getPresenceForFriend } from './presenceStore.js';

function parsePlayerId(q) {
  if (q == null || q === '') return null;
  const s = String(q).trim();
  return s || null;
}

function resolveFriendDisplayName(fid, pres) {
  const stored = getStoredDisplayName(fid);
  const fromPresence = pres.online && pres.displayName ? pres.displayName.trim() : '';
  return fromPresence || stored || `Игрок ${String(fid).slice(-4)}`;
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

  /** Заявка в друзья (получатель увидит запрос и сможет принять/отклонить) */
  fastify.post('/friends/request', async (request, reply) => {
    const body = request.body || {};
    const playerId = parsePlayerId(body.playerId);
    const targetId = parsePlayerId(body.targetId);
    if (!playerId || !targetId) {
      return reply.code(400).send({ error: 'Нужны playerId и targetId' });
    }
    const requesterName = String(body.requesterName || '').trim().slice(0, 120);
    const r = addPendingRequest(playerId, targetId, requesterName);
    if (!r.ok) return reply.code(400).send({ error: r.error || 'Ошибка' });
    return { ok: true };
  });

  /** Принять заявку: playerId — тот, кто принимает, fromId — отправитель заявки */
  fastify.post('/friends/accept', async (request, reply) => {
    const body = request.body || {};
    const playerId = parsePlayerId(body.playerId);
    const fromId = parsePlayerId(body.fromId);
    if (!playerId || !fromId) {
      return reply.code(400).send({ error: 'Нужны playerId и fromId' });
    }
    const note = body.note;
    const acceptorDisplayName = String(body.acceptorDisplayName || '').trim().slice(0, 120);
    const r = acceptPendingRequest(fromId, playerId, note, acceptorDisplayName);
    if (!r.ok) return reply.code(400).send({ error: r.error || 'Ошибка' });
    return { ok: true };
  });

  fastify.post('/friends/reject', async (request, reply) => {
    const body = request.body || {};
    const playerId = parsePlayerId(body.playerId);
    const fromId = parsePlayerId(body.fromId);
    if (!playerId || !fromId) {
      return reply.code(400).send({ error: 'Нужны playerId и fromId' });
    }
    const r = rejectPendingRequest(fromId, playerId);
    if (!r.ok) return reply.code(400).send({ error: r.error || 'Ошибка' });
    return { ok: true };
  });

  /** Устарело: мгновенное добавление — оставлено для совместимости */
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

  /** Изменить примечание к другу (видно только вам) */
  fastify.post('/friends/note', async (request, reply) => {
    const body = request.body || {};
    const playerId = parsePlayerId(body.playerId);
    const friendId = parsePlayerId(body.friendId);
    const note = body.note != null ? String(body.note) : '';
    if (!playerId || !friendId) {
      return reply.code(400).send({ error: 'Нужны playerId и friendId' });
    }
    if (!areFriends(playerId, friendId)) {
      return reply.code(400).send({ error: 'Не в списке друзей' });
    }
    setNoteFor(playerId, friendId, note);
    return { ok: true, note: getNote(playerId, friendId) };
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
      const displayName = resolveFriendDisplayName(fid, pres);
      const note = getNote(playerId, fid);
      const canJoinLobby =
        pres.online && pres.location === 'lobby' && Boolean(pres.inviteToken);
      return {
        id: fid,
        displayName,
        note: note || '',
        online: pres.online,
        location: pres.online ? pres.location : 'offline',
        roomCode: pres.roomCode || null,
        joinInviteToken: canJoinLobby ? pres.inviteToken : null,
      };
    });
    const incomingRequests = getIncomingRequests(playerId);
    const outgoingPendingIds = getOutgoingPendingTargets(playerId);
    return { friends, incomingRequests, outgoingPendingIds };
  });
}
