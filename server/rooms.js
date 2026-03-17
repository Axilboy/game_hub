import { roomManager } from './roomManager.js';
import { getRandomWord } from './words.js';

export async function roomRoutes(fastify) {
  fastify.post('/rooms', async (request, reply) => {
    const { hostId, hostName } = request.body || {};
    if (!hostId) {
      return reply.code(400).send({ error: 'hostId required' });
    }
    const room = roomManager.create(hostId, hostName || 'Хост');
    return { room: roomManager.toSafe(room), inviteToken: room.inviteToken };
  });

  fastify.post('/rooms/join', async (request, reply) => {
    const { code, inviteToken, playerId, playerName } = request.body || {};
    if (!playerId) {
      return reply.code(400).send({ error: 'playerId required' });
    }
    let room = null;
    if (inviteToken) {
      room = roomManager.getByInviteToken(inviteToken);
    }
    if (!room && code) {
      room = roomManager.getByCode(String(code).trim());
    }
    if (!room) {
      return reply.code(404).send({ error: 'Room not found' });
    }
    room = roomManager.join(room.id, playerId, playerName || 'Игрок');
    return { room: roomManager.toSafe(room) };
  });

  fastify.get('/rooms/:roomId', async (request, reply) => {
    const room = roomManager.get(request.params.roomId);
    if (!room) return reply.code(404).send({ error: 'Room not found' });
    return { room: roomManager.toSafe(room) };
  });

  fastify.post('/rooms/spy/start', async (request, reply) => {
    const { roomId, hostId } = request.body || {};
    const room = roomManager.get(roomId);
    if (!room) return reply.code(404).send({ error: 'Room not found' });
    if (room.hostId !== hostId) return reply.code(403).send({ error: 'Only host can start' });
    const players = room.players;
    if (players.length < 2) return reply.code(400).send({ error: 'Need at least 2 players' });
    const word = getRandomWord();
    const spyIndex = Math.floor(Math.random() * players.length);
    const spyId = players[spyIndex].id;
    roomManager.setGame(roomId, 'spy');
    roomManager.setState(roomId, 'playing', { word, spyIds: [spyId] });
    const io = fastify.io;
    io.to(roomId).emit('game_start', { game: 'spy' });
    return { ok: true };
  });

  fastify.get('/rooms/:roomId/spy/card', async (request, reply) => {
    const { roomId } = request.params;
    const playerId = request.query?.playerId;
    if (!playerId) return reply.code(400).send({ error: 'playerId required' });
    const room = roomManager.get(roomId);
    if (!room || room.game !== 'spy' || !room.gameState) {
      return reply.code(404).send({ error: 'Game not found' });
    }
    const { word, spyIds } = room.gameState;
    const isSpy = spyIds.includes(playerId);
    if (isSpy) return { role: 'spy' };
    return { role: 'civilian', word };
  });
}
