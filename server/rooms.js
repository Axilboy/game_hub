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
    const { code, inviteToken, playerId, playerName, inventory } = request.body || {};
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
    const inv = inventory && typeof inventory === 'object'
      ? { dictionaries: Array.isArray(inventory.dictionaries) ? inventory.dictionaries : ['free'], hasPro: Boolean(inventory.hasPro) }
      : null;
    room = roomManager.join(room.id, playerId, playerName || 'Игрок', inv);
    return { room: roomManager.toSafe(room) };
  });

  fastify.get('/rooms/:roomId', async (request, reply) => {
    const room = roomManager.get(request.params.roomId);
    if (!room) return reply.code(404).send({ error: 'Room not found' });
    return { room: roomManager.toSafe(room) };
  });

  fastify.patch('/rooms/:roomId', async (request, reply) => {
    const { roomId } = request.params;
    const { hostId, name, selectedGame, gameSettings } = request.body || {};
    const room = roomManager.get(roomId);
    if (!room) return reply.code(404).send({ error: 'Room not found' });
    if (room.hostId !== hostId) return reply.code(403).send({ error: 'Only host can update' });
    if (name !== undefined) roomManager.setRoomName(roomId, name);
    if (selectedGame !== undefined || gameSettings !== undefined) {
      roomManager.setLobbyGame(roomId, hostId, selectedGame !== undefined ? selectedGame : room.selectedGame, gameSettings !== undefined ? gameSettings : room.gameSettings);
      const io = fastify.io;
      if (io) io.to(roomId).emit('room_updated');
    }
    const updated = roomManager.get(roomId);
    return { room: roomManager.toSafe(updated) };
  });

  fastify.post('/rooms/spy/start', async (request, reply) => {
    const { roomId, hostId, timerEnabled = false, timerSeconds = 60, spyCount = 1, dictionaryIds } = request.body || {};
    const room = roomManager.get(roomId);
    if (!room) return reply.code(404).send({ error: 'Room not found' });
    if (room.hostId !== hostId) return reply.code(403).send({ error: 'Only host can start' });
    const players = room.players;
    if (players.length < 2) return reply.code(400).send({ error: 'Need at least 2 players' });
    const safeRoom = roomManager.toSafe(room);
    const allowedDicts = new Set(safeRoom.availableDictionaries || ['free']);
    const ids = Array.isArray(dictionaryIds) ? dictionaryIds.filter((d) => allowedDicts.has(d)) : ['free'];
    const word = getRandomWord(ids.length ? ids : ['free']);
    const numSpies = Math.min(Math.max(1, parseInt(spyCount, 10) || 1), Math.max(1, players.length - 1));
    const indices = new Set();
    while (indices.size < numSpies) indices.add(Math.floor(Math.random() * players.length));
    const spyIds = Array.from(indices).map((i) => players[i].id);
    const safeSeconds = Math.min(3600, Math.max(30, Number(timerSeconds) || 60));
    roomManager.setGame(roomId, 'spy');
    roomManager.setState(roomId, 'playing', {
      word,
      spyIds,
      timerEnabled: Boolean(timerEnabled),
      timerSeconds: safeSeconds,
    });
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
    const { word, spyIds, timerEnabled, timerSeconds } = room.gameState;
    const isSpy = spyIds.includes(playerId);
    const payload = { role: isSpy ? 'spy' : 'civilian', timerEnabled: Boolean(timerEnabled), timerSeconds: timerSeconds || 60 };
    if (isSpy) return { ...payload };
    return { ...payload, word };
  });

  function endVote(roomId, io) {
    const r = roomManager.get(roomId);
    if (!r || r.game !== 'spy' || !r.gameState) return;
    const gs = r.gameState;
    if (gs.voteTimeoutId) clearTimeout(gs.voteTimeoutId);
    gs.voteTimeoutId = null;
    gs.votingEndsAt = null;
    const votes = gs.votes || {};
    const count = {};
    for (const id of Object.values(votes)) count[id] = (count[id] || 0) + 1;
    let max = 0, votedOutId = null;
    for (const [id, c] of Object.entries(count)) if (c > max) { max = c; votedOutId = id; }
    const votedOut = r.players.find((p) => p.id === votedOutId);
    const isSpy = r.gameState.spyIds && r.gameState.spyIds.includes(votedOutId);
    roomManager.endGame(roomId);
    io.to(roomId).emit('game_vote_end', { votedOutId, votedOutName: votedOut?.name || 'Игрок', isSpy });
    io.to(roomId).emit('game_ended');
  }

  fastify.post('/rooms/:roomId/spy/start-vote', async (request, reply) => {
    const { roomId } = request.params;
    const { playerId } = request.body || {};
    const room = roomManager.get(roomId);
    if (!room || room.game !== 'spy' || !room.gameState) return reply.code(404).send({ error: 'Game not found' });
    const gs = room.gameState;
    const now = Date.now();
    if (gs.votingEndsAt && gs.votingEndsAt > now) return reply.send({ votingEndsAt: gs.votingEndsAt });
    gs.votingEndsAt = now + 30000;
    gs.votes = {};
    const io = fastify.io;
    io.to(roomId).emit('game_vote_start', { votingEndsAt: gs.votingEndsAt });
    gs.voteTimeoutId = setTimeout(() => endVote(roomId, io), 30000);
    return { votingEndsAt: gs.votingEndsAt };
  });

  fastify.post('/rooms/:roomId/spy/end-vote', async (request, reply) => {
    const { roomId } = request.params;
    const room = roomManager.get(roomId);
    if (!room || room.game !== 'spy' || !room.gameState) return reply.code(404).send({ error: 'Game not found' });
    const gs = room.gameState;
    if (!gs.votingEndsAt || gs.votingEndsAt < Date.now()) return reply.code(400).send({ error: 'Voting not active' });
    endVote(roomId, fastify.io);
    return { ok: true };
  });

  fastify.post('/rooms/:roomId/spy/vote', async (request, reply) => {
    const { roomId } = request.params;
    const { playerId, votedForId } = request.body || {};
    const room = roomManager.get(roomId);
    if (!room || room.game !== 'spy' || !room.gameState) return reply.code(404).send({ error: 'Game not found' });
    const gs = room.gameState;
    if (!gs.votingEndsAt || gs.votingEndsAt < Date.now()) return reply.code(400).send({ error: 'Voting not active' });
    if (!room.players.some((p) => p.id === votedForId)) return reply.code(400).send({ error: 'Invalid player' });
    gs.votes = gs.votes || {};
    gs.votes[playerId] = votedForId;
    const votedCount = Object.keys(gs.votes).length;
    const totalPlayers = room.players.length;
    if (votedCount >= totalPlayers) {
      endVote(roomId, fastify.io);
    }
    return { ok: true };
  });

  fastify.patch('/rooms/:roomId/players/me', async (request, reply) => {
    const { roomId } = request.params;
    const { playerId, inventory } = request.body || {};
    const room = roomManager.get(roomId);
    if (!room) return reply.code(404).send({ error: 'Room not found' });
    if (!room.players.some((p) => p.id === playerId)) return reply.code(403).send({ error: 'Not in room' });
    const inv = inventory && typeof inventory === 'object'
      ? { dictionaries: Array.isArray(inventory.dictionaries) ? inventory.dictionaries : ['free'], hasPro: Boolean(inventory.hasPro) }
      : { dictionaries: ['free'], hasPro: false };
    roomManager.setPlayerInventory(roomId, playerId, inv);
    const updated = roomManager.get(roomId);
    return { room: roomManager.toSafe(updated) };
  });

  fastify.post('/rooms/:roomId/kick', async (request, reply) => {
    const { roomId } = request.params;
    const { hostId, playerIdToKick } = request.body || {};
    const room = roomManager.get(roomId);
    if (!room) return reply.code(404).send({ error: 'Room not found' });
    if (room.hostId !== hostId) return reply.code(403).send({ error: 'Only host can kick' });
    const result = roomManager.kick(roomId, hostId, playerIdToKick);
    if (!result) return reply.code(400).send({ error: 'Cannot kick' });
    const io = fastify.io;
    const sock = io.sockets.sockets.get(result.socketId);
    if (sock) sock.disconnect(true);
    return { ok: true };
  });

  fastify.get('/rooms/:roomId/spy/vote-status', async (request, reply) => {
    const { roomId } = request.params;
    const room = roomManager.get(roomId);
    if (!room || room.game !== 'spy' || !room.gameState) return reply.code(404).send({ error: 'Game not found' });
    const gs = room.gameState;
    const now = Date.now();
    const active = gs.votingEndsAt && gs.votingEndsAt > now;
    return { votingEndsAt: gs.votingEndsAt || null, active, players: room.players };
  });
}
