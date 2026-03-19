import { roomManager } from './roomManager.js';
import { getRandomWord } from './words.js';
import { recordPlayer, recordGameSession, recordAdImpression } from './statsManager.js';
import { allowAction } from './rateLimit.js';
import {
  createMafiaState,
  resolveNight,
  resolveDayVote,
  checkWin,
  toClientState,
  getMafiaPlayers,
} from './mafia.js';
import { getRandomEliasWord } from './eliasWords.js';

export async function roomRoutes(fastify) {
  const ERR = {
    tooMany: { error: 'Слишком часто. Подождите немного.' },
  };

  fastify.post('/stats/ad-shown', async (request, reply) => {
    const { playerId } = request.body || {};
    if (!playerId) return reply.code(400).send({ error: 'Нужен playerId' });
    if (!allowAction(`adshown:${playerId}`, 15, 60_000)) {
      return reply.code(429).send(ERR.tooMany);
    }
    recordAdImpression();
    return { ok: true };
  });

  fastify.post('/rooms', async (request, reply) => {
    const { hostId, hostName, hostPhotoUrl, hostHasPro, hostAvatarEmoji } = request.body || {};
    if (!hostId) {
      return reply.code(400).send({ error: 'hostId required' });
    }
    const room = roomManager.create(hostId, hostName || 'Хост', hostPhotoUrl, hostHasPro, hostAvatarEmoji);
    if (room.playerInventories && hostHasPro) room.playerInventories[room.hostId] = { ...(room.playerInventories[room.hostId] || {}), hasPro: true };
    recordPlayer(hostId);
    return { room: roomManager.toSafe(room), inviteToken: room.inviteToken };
  });

  fastify.post('/rooms/join', async (request, reply) => {
    const { code, inviteToken, playerId, playerName, inventory, photo_url, avatar_emoji } = request.body || {};
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
    room = roomManager.join(room.id, playerId, playerName || 'Игрок', inv, photo_url || null, avatar_emoji || null);
    recordPlayer(playerId);
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
    }
    const io = fastify.io;
    if (io && (name !== undefined || selectedGame !== undefined || gameSettings !== undefined)) io.to(roomId).emit('room_updated');
    const updated = roomManager.get(roomId);
    return { room: roomManager.toSafe(updated) };
  });

  const ALL_SPIES_CHANCE = 0.05;

  function minSpyPlayers(spyCount) {
    const n = Math.min(3, Math.max(1, parseInt(spyCount, 10) || 1));
    return n + 2;
  }

  fastify.post('/rooms/spy/start', async (request, reply) => {
    const { roomId, hostId, timerEnabled = false, timerSeconds = 60, spyCount = 1, allSpiesChanceEnabled = false, spiesSeeEachOther = false, dictionaryIds } = request.body || {};
    const room = roomManager.get(roomId);
    if (!room) return reply.code(404).send({ error: 'Room not found' });
    if (room.hostId !== hostId) return reply.code(403).send({ error: 'Only host can start' });
    const players = room.players;
    const minPlayers = minSpyPlayers(spyCount);
    if (players.length < minPlayers) return reply.code(400).send({ error: `Need at least ${minPlayers} players for ${spyCount} spy/spies` });
    const safeRoom = roomManager.toSafe(room);
    const allowedDicts = new Set(safeRoom.availableDictionaries || ['free']);
    const ids = Array.isArray(dictionaryIds) ? dictionaryIds.filter((d) => allowedDicts.has(d)) : ['free'];
    const word = getRandomWord(ids.length ? ids : ['free']);
    let spyIds;
    if (allSpiesChanceEnabled && Math.random() < ALL_SPIES_CHANCE) {
      spyIds = players.map((p) => p.id);
    } else {
      const count = Math.min(Math.max(1, parseInt(spyCount, 10) || 1), Math.max(1, players.length - 1));
      const indices = new Set();
      while (indices.size < count) indices.add(Math.floor(Math.random() * players.length));
      spyIds = Array.from(indices).map((i) => players[i].id);
    }
    const safeSeconds = Math.min(3600, Math.max(30, Number(timerSeconds) || 60));
    const allSpiesRound = spyIds.length === players.length;
    recordGameSession();
    roomManager.setGame(roomId, 'spy');
    roomManager.setState(roomId, 'playing', {
      word,
      spyIds,
      allSpiesRound,
      spiesSeeEachOther: Boolean(spiesSeeEachOther),
      timerEnabled: Boolean(timerEnabled),
      timerSeconds: safeSeconds,
      readyIds: [],
      timerStartsAt: null,
    });
    const io = fastify.io;
    io.to(roomId).emit('game_start', { game: 'spy', allSpiesRound });
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
    const { word, spyIds, timerEnabled, timerSeconds, allSpiesRound, timerStartsAt, spiesSeeEachOther } = room.gameState;
    const isSpy = spyIds.includes(playerId);
    const payload = { role: isSpy ? 'spy' : 'civilian', timerEnabled: Boolean(timerEnabled), timerSeconds: timerSeconds || 60, allSpiesRound: Boolean(allSpiesRound), timerStartsAt: timerStartsAt || null };
    if (isSpy) {
      if (spiesSeeEachOther && spyIds.length > 1) {
        const otherSpyNames = room.players.filter((p) => spyIds.includes(p.id) && p.id !== playerId).map((p) => p.name || 'Игрок');
        return { ...payload, otherSpyNames };
      }
      return payload;
    }
    return { ...payload, word };
  });

  fastify.post('/rooms/:roomId/ready', async (request, reply) => {
    const { roomId } = request.params;
    const { playerId, game } = request.body || {};
    if (!playerId || !game) return reply.code(400).send({ error: 'Нужны playerId и game' });
    if (!allowAction(`ready:${roomId}:${playerId}`, 40, 10_000)) {
      return reply.code(429).send(ERR.tooMany);
    }
    const room = roomManager.get(roomId);
    if (!room || room.game !== game || !room.gameState) return reply.code(404).send({ error: 'Игра не найдена' });
    if (!room.players.some((p) => p.id === playerId)) return reply.code(403).send({ error: 'Вы не в комнате' });
    const gs = room.gameState;
    if (!gs.readyIds) gs.readyIds = [];
    if (gs.readyIds.includes(playerId)) return { ok: true, timerStarted: !!gs.timerStartsAt };
    gs.readyIds.push(playerId);
    const allReady = gs.readyIds.length >= room.players.length;
    const io = fastify.io;
    if (game === 'spy' && allReady && gs.timerEnabled && gs.timerSeconds) {
      gs.timerStartsAt = Date.now();
      io.to(roomId).emit('game_timer_start', { timerStartsAt: gs.timerStartsAt, timerSeconds: gs.timerSeconds });
    }
    if (game === 'elias' && allReady && gs.timerSeconds) {
      gs.roundEndsAt = Date.now() + gs.timerSeconds * 1000;
      io.to(roomId).emit('elias_timer_start', { roundEndsAt: gs.roundEndsAt });
    }
    return { ok: true, timerStarted: allReady };
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
    const allSpiesRound = Boolean(r.gameState.allSpiesRound);
    roomManager.endGame(roomId);
    io.to(roomId).emit('game_vote_end', { votedOutId, votedOutName: votedOut?.name || 'Игрок', isSpy, allSpiesRound });
    io.to(roomId).emit('game_ended');
  }

  fastify.post('/rooms/:roomId/spy/start-vote', async (request, reply) => {
    const { roomId } = request.params;
    const { playerId } = request.body || {};
    const room = roomManager.get(roomId);
    if (!room || room.game !== 'spy' || !room.gameState) return reply.code(404).send({ error: 'Игра не найдена' });
    if (room.hostId !== playerId) return reply.code(403).send({ error: 'Только хост может начать голосование' });
    if (!allowAction(`spy:startvote:${roomId}:${playerId}`, 6, 20_000)) {
      return reply.code(429).send(ERR.tooMany);
    }
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
    const { playerId } = request.body || {};
    const room = roomManager.get(roomId);
    if (!room || room.game !== 'spy' || !room.gameState) return reply.code(404).send({ error: 'Игра не найдена' });
    if (room.hostId !== playerId) return reply.code(403).send({ error: 'Только хост может завершить голосование' });
    if (!allowAction(`spy:endvote:${roomId}:${playerId}`, 6, 15_000)) {
      return reply.code(429).send(ERR.tooMany);
    }
    const gs = room.gameState;
    if (!gs.votingEndsAt || gs.votingEndsAt < Date.now()) return reply.code(400).send({ error: 'Голосование не активно' });
    endVote(roomId, fastify.io);
    return { ok: true };
  });

  fastify.post('/rooms/:roomId/spy/vote', async (request, reply) => {
    const { roomId } = request.params;
    const { playerId, votedForId } = request.body || {};
    if (!allowAction(`spy:vote:${roomId}:${playerId}`, 25, 8000)) {
      return reply.code(429).send(ERR.tooMany);
    }
    const room = roomManager.get(roomId);
    if (!room || room.game !== 'spy' || !room.gameState) return reply.code(404).send({ error: 'Игра не найдена' });
    const gs = room.gameState;
    if (!gs.votingEndsAt || gs.votingEndsAt < Date.now()) return reply.code(400).send({ error: 'Голосование не активно' });
    if (!room.players.some((p) => p.id === votedForId)) return reply.code(400).send({ error: 'Неверный игрок' });
    gs.votes = gs.votes || {};
    if (gs.votes[playerId] === votedForId) return { ok: true };
    gs.votes[playerId] = votedForId;
    const votedCount = Object.keys(gs.votes).length;
    const totalPlayers = room.players.length;
    if (votedCount >= totalPlayers) {
      endVote(roomId, fastify.io);
    }
    return { ok: true };
  });

  fastify.post('/rooms/mafia/start', async (request, reply) => {
    const { roomId, hostId, moderatorId, extended = false, revealRoleOnDeath = true, mafiaCanSkipKill = false } = request.body || {};
    const room = roomManager.get(roomId);
    if (!room) return reply.code(404).send({ error: 'Room not found' });
    if (room.hostId !== hostId) return reply.code(403).send({ error: 'Only host can start' });
    const players = room.players;
    if (players.length < 4) return reply.code(400).send({ error: 'Need at least 4 players for Mafia' });
    const safeRoom = roomManager.toSafe(room);
    const roomHasPro = safeRoom.players?.some((p) => p.hasPro) ?? false;
    if (extended && !roomHasPro) return reply.code(403).send({ error: 'Extended mode requires Pro' });
    let modId = moderatorId;
    if (!modId || !players.some((p) => p.id === modId)) {
      modId = players[Math.floor(Math.random() * players.length)].id;
    }
    const gs = createMafiaState(players, { extended, revealRoleOnDeath, mafiaCanSkipKill, moderatorId: modId, theme: 'default' });
    recordGameSession();
    roomManager.setGame(roomId, 'mafia');
    roomManager.setState(roomId, 'playing', gs);
    const io = fastify.io;
    io.to(roomId).emit('game_start', { game: 'mafia' });
    return { ok: true, moderatorId: modId };
  });

  fastify.get('/rooms/:roomId/mafia/state', async (request, reply) => {
    const { roomId } = request.params;
    const playerId = request.query?.playerId;
    if (!playerId) return reply.code(400).send({ error: 'playerId required' });
    const room = roomManager.get(roomId);
    if (!room || room.game !== 'mafia' || !room.gameState) return reply.code(404).send({ error: 'Game not found' });
    const state = toClientState(room.gameState, playerId, room.players);
    return state;
  });

  fastify.post('/rooms/:roomId/mafia/action', async (request, reply) => {
    const { roomId } = request.params;
    const { playerId, action, targetId } = request.body || {};
    if (!allowAction(`mafia:action:${roomId}:${playerId}`, 24, 8000)) {
      return reply.code(429).send(ERR.tooMany);
    }
    const room = roomManager.get(roomId);
    if (!room || room.game !== 'mafia' || !room.gameState) return reply.code(404).send({ error: 'Игра не найдена' });
    const gs = room.gameState;
    const phase = gs.phase;
    if (action === 'mafia_kill' && phase === 'night_mafia') {
      const mafiaIds = getMafiaPlayers(gs.roles);
      if (!mafiaIds.includes(playerId)) return reply.code(403).send({ error: 'Вы не мафия' });
      if (gs.settings.mafiaCanSkipKill && !targetId) {
        gs.mafiaVotes = gs.mafiaVotes || {};
        gs.mafiaVotes[playerId] = null;
        return { ok: true };
      }
      if (!targetId || !gs.alive.includes(targetId)) return reply.code(400).send({ error: 'Неверная цель' });
      gs.mafiaVotes = gs.mafiaVotes || {};
      gs.mafiaVotes[playerId] = targetId;
      return { ok: true };
    }
    if (action === 'commissioner_check' && (phase === 'night_commissioner' || phase === 'night_mafia')) {
      if (gs.roles[playerId] !== 'commissioner') return reply.code(403).send({ error: 'Вы не комиссар' });
      if (!targetId || !gs.alive.includes(targetId)) return reply.code(400).send({ error: 'Неверная цель' });
      gs.commissionerCheck = targetId;
      gs.commissionerCheckedId = targetId;
      return { ok: true, isMafia: getMafiaPlayers(gs.roles).includes(targetId) };
    }
    return reply.code(400).send({ error: 'Действие недоступно в этой фазе' });
  });

  fastify.post('/rooms/:roomId/mafia/advance', async (request, reply) => {
    const { roomId } = request.params;
    const { playerId } = request.body || {};
    const room = roomManager.get(roomId);
    if (!room || room.game !== 'mafia' || !room.gameState) return reply.code(404).send({ error: 'Game not found' });
    const gs = room.gameState;
    if (gs.moderatorId !== playerId) return reply.code(403).send({ error: 'Только ведущий может продвигать фазу' });
    if (!allowAction(`mafia:advance:${roomId}:${playerId}`, 16, 8000)) {
      return reply.code(429).send(ERR.tooMany);
    }
    const io = fastify.io;
    if (gs.phase === 'night_mafia') {
      const mafiaIds = getMafiaPlayers(gs.roles);
      const needCommissioner = room.players.some((p) => gs.roles[p.id] === 'commissioner' && gs.alive.includes(p.id));
      gs.phase = needCommissioner ? 'night_commissioner' : 'day';
      if (gs.phase === 'day') {
        const next = resolveNight(gs, room.players);
        Object.assign(gs, next);
        const win = checkWin(gs);
        if (win) {
          roomManager.endGame(roomId);
          io.to(roomId).emit('mafia_ended', { winner: win });
          io.to(roomId).emit('game_ended');
          return { ok: true, winner: win };
        }
      }
      io.to(roomId).emit('mafia_phase', { phase: gs.phase });
      return { ok: true };
    }
    if (gs.phase === 'night_commissioner') {
      gs.phase = 'day';
      const next = resolveNight(gs, room.players);
      Object.assign(gs, next);
      const win = checkWin(gs);
      if (win) {
        roomManager.endGame(roomId);
        io.to(roomId).emit('mafia_ended', { winner: win });
        io.to(roomId).emit('game_ended');
        return { ok: true, winner: win };
      }
      io.to(roomId).emit('mafia_phase', { phase: 'day' });
      return { ok: true };
    }
    if (gs.phase === 'day') {
      gs.phase = 'voting';
      io.to(roomId).emit('mafia_phase', { phase: 'voting' });
      return { ok: true };
    }
    if (gs.phase === 'voting') {
      const next = resolveDayVote(gs);
      Object.assign(gs, next);
      const win = checkWin(gs);
      if (win) {
        roomManager.endGame(roomId);
        io.to(roomId).emit('mafia_ended', { winner: win });
        io.to(roomId).emit('game_ended');
        return { ok: true, winner: win };
      }
      io.to(roomId).emit('mafia_phase', { phase: gs.phase });
      return { ok: true };
    }
    return reply.code(400).send({ error: 'Unknown phase' });
  });

  fastify.post('/rooms/:roomId/mafia/vote', async (request, reply) => {
    const { roomId } = request.params;
    const { playerId, targetId } = request.body || {};
    const room = roomManager.get(roomId);
    if (!room || room.game !== 'mafia' || !room.gameState) return reply.code(404).send({ error: 'Game not found' });
    const gs = room.gameState;
    if (gs.phase !== 'voting') return reply.code(400).send({ error: 'Not voting phase' });
    if (!gs.alive.includes(playerId)) return reply.code(403).send({ error: 'You are dead' });
    if (!targetId || !gs.alive.includes(targetId)) return reply.code(400).send({ error: 'Invalid target' });
    gs.dayVotes = gs.dayVotes || {};
    if (gs.dayVotes[playerId] === targetId) return { ok: true };
    gs.dayVotes[playerId] = targetId;
    return { ok: true };
  });

  fastify.post('/rooms/elias/start', async (request, reply) => {
    const { roomId, hostId, timerSeconds = 60, scoreLimit = 10, dictionaryIds, teams: teamsInput, team1Ids, team2Ids } = request.body || {};
    const room = roomManager.get(roomId);
    if (!room) return reply.code(404).send({ error: 'Room not found' });
    if (room.hostId !== hostId) return reply.code(403).send({ error: 'Only host can start' });
    const players = room.players;
    if (players.length < 2) return reply.code(400).send({ error: 'Need at least 2 players' });
    const playerIdSet = new Set(players.map((p) => p.id));
    let teams;
    if (Array.isArray(teamsInput) && teamsInput.length >= 2) {
      teams = teamsInput.map((t) => ({
        name: t.name || 'Команда',
        players: (t.playerIds || t.players || []).filter((id) => playerIdSet.has(id)),
        score: 0,
      }));
      const totalPlaying = teams.reduce((sum, t) => sum + t.players.length, 0);
      const teamsWithPlayers = teams.filter((t) => t.players.length > 0).length;
      if (totalPlaying > 0 && totalPlaying < 2) return reply.code(400).send({ error: 'В игре должно быть минимум 2 игрока' });
      if (totalPlaying >= 2 && teamsWithPlayers < 2) return reply.code(400).send({ error: 'Игроки должны быть минимум в двух разных командах' });
    } else {
      let team1 = [];
      let team2 = [];
      if (Array.isArray(team1Ids) && Array.isArray(team2Ids) && (team1Ids.length > 0 || team2Ids.length > 0)) {
        team1 = team1Ids.filter((id) => playerIdSet.has(id));
        team2 = team2Ids.filter((id) => playerIdSet.has(id));
        if (team1.length + team2.length < 2) return reply.code(400).send({ error: 'В игре должно быть минимум 2 игрока (в двух командах вместе)' });
      }
      if (team1.length === 0 && team2.length === 0) {
        team1 = players.slice(0, Math.ceil(players.length / 2)).map((p) => p.id);
        team2 = players.slice(Math.ceil(players.length / 2)).map((p) => p.id);
      }
      teams = [{ name: 'Команда 1', players: team1, score: 0 }, { name: 'Команда 2', players: team2, score: 0 }];
    }
    const dictIds = Array.isArray(dictionaryIds) && dictionaryIds.length ? dictionaryIds : ['basic'];
    const currentWord = getRandomEliasWord(dictIds);
    const roundSeconds = Math.min(120, Math.max(30, Number(timerSeconds) || 60));
    const gs = {
      teams,
      currentTeamIndex: 0,
      currentExplainerIndex: 0,
      currentWord,
      dictionaryIds: dictIds,
      roundEndsAt: null,
      timerSeconds: roundSeconds,
      scoreLimit: Math.min(100, Math.max(5, Number(scoreLimit) || 10)),
      winner: null,
      readyIds: [],
      // Prevent accidental double-score/skip for the same word (e.g. multiple teammates click).
      lastGuessedWord: null,
      lastSkippedWord: null,
    };
    recordGameSession();
    roomManager.setGame(roomId, 'elias');
    roomManager.setState(roomId, 'playing', gs);
    const io = fastify.io;
    io.to(roomId).emit('game_start', { game: 'elias' });
    return { ok: true };
  });

  // Stub: future game "Правда или действие"
  fastify.post('/rooms/truth_dare/start', async (request, reply) => {
    return reply.code(501).send({ error: 'Игра «Правда или действие» скоро будет добавлена' });
  });

  fastify.get('/rooms/:roomId/elias/state', async (request, reply) => {
    const { roomId } = request.params;
    const playerId = request.query?.playerId;
    if (!playerId) return reply.code(400).send({ error: 'playerId required' });
    const room = roomManager.get(roomId);
    if (!room || room.game !== 'elias' || !room.gameState) return reply.code(404).send({ error: 'Game not found' });
    const gs = room.gameState;
    const teamIndex = gs.teams.findIndex((t) => t.players.includes(playerId));
    const team = gs.teams[teamIndex];
    // Show word + action buttons to the whole "explaining team", not only one player.
    const isExplainer = teamIndex === gs.currentTeamIndex;
    const explainerId = team ? team.players[gs.currentExplainerIndex % team.players.length] : null;
    const explainer = room.players.find((p) => p.id === explainerId);
    return {
      teams: gs.teams.map((t) => ({ name: t.name, score: t.score, playerIds: t.players })),
      currentTeamIndex: gs.currentTeamIndex,
      currentExplainerIndex: gs.currentExplainerIndex,
      word: isExplainer ? gs.currentWord : null,
      roundEndsAt: gs.roundEndsAt,
      timerSeconds: gs.timerSeconds,
      scoreLimit: gs.scoreLimit,
      winner: gs.winner,
      myTeamIndex: teamIndex,
      isExplainer,
      explainerName: explainer?.name || 'Игрок',
    };
  });

  function eliasNextWord(roomId, io) {
    const room = roomManager.get(roomId);
    if (!room || room.game !== 'elias' || !room.gameState) return;
    const gs = room.gameState;
    if (gs.winner) return;
    gs.currentWord = getRandomEliasWord(gs.dictionaryIds);
    gs.lastGuessedWord = null;
    gs.lastSkippedWord = null;
    io.to(roomId).emit('elias_update', {});
  }

  function eliasNextTurn(roomId, io) {
    const room = roomManager.get(roomId);
    if (!room || room.game !== 'elias' || !room.gameState) return;
    const gs = room.gameState;
    if (gs.winner) return;
    const team = gs.teams[gs.currentTeamIndex];
    const nextExplainer = (gs.currentExplainerIndex + 1) % team.players.length;
    if (nextExplainer === 0) {
      gs.currentTeamIndex = (gs.currentTeamIndex + 1) % gs.teams.length;
    }
    gs.currentExplainerIndex = nextExplainer;
    gs.currentWord = getRandomEliasWord(gs.dictionaryIds);
    gs.lastGuessedWord = null;
    gs.lastSkippedWord = null;
    gs.roundEndsAt = Date.now() + gs.timerSeconds * 1000;
    io.to(roomId).emit('elias_update', {});
  }

  function eliasCheckWin(roomId, io) {
    const room = roomManager.get(roomId);
    if (!room || room.game !== 'elias' || !room.gameState) return;
    const gs = room.gameState;
    for (let i = 0; i < gs.teams.length; i++) {
      if (gs.teams[i].score >= gs.scoreLimit) {
        gs.winner = i;
        roomManager.endGame(roomId);
        io.to(roomId).emit('elias_ended', { winnerTeamIndex: i, teams: gs.teams });
        io.to(roomId).emit('game_ended');
        return;
      }
    }
  }

  fastify.post('/rooms/:roomId/elias/guessed', async (request, reply) => {
    const { roomId } = request.params;
    const { playerId } = request.body || {};
    if (!allowAction(`elias:guess:${roomId}:${playerId}`, 20, 4000)) {
      return reply.code(429).send(ERR.tooMany);
    }
    const room = roomManager.get(roomId);
    if (!room || room.game !== 'elias' || !room.gameState) return reply.code(404).send({ error: 'Игра не найдена' });
    const gs = room.gameState;
    const team = gs.teams[gs.currentTeamIndex];
    if (!team?.players?.includes(playerId)) return reply.code(403).send({ error: 'Не ваша команда' });
    if (gs.lastGuessedWord === gs.currentWord) return { ok: true, already: true };
    gs.lastGuessedWord = gs.currentWord;
    team.score = (team.score || 0) + 1;
    eliasNextWord(roomId, fastify.io);
    eliasCheckWin(roomId, fastify.io);
    return { ok: true, score: team.score };
  });

  fastify.post('/rooms/:roomId/elias/skip', async (request, reply) => {
    const { roomId } = request.params;
    const { playerId } = request.body || {};
    if (!allowAction(`elias:skip:${roomId}:${playerId}`, 20, 4000)) {
      return reply.code(429).send(ERR.tooMany);
    }
    const room = roomManager.get(roomId);
    if (!room || room.game !== 'elias' || !room.gameState) return reply.code(404).send({ error: 'Игра не найдена' });
    const gs = room.gameState;
    const team = gs.teams[gs.currentTeamIndex];
    if (!team?.players?.includes(playerId)) return reply.code(403).send({ error: 'Не ваша команда' });
    if (gs.lastSkippedWord === gs.currentWord) return { ok: true, already: true };
    gs.lastSkippedWord = gs.currentWord;
    eliasNextWord(roomId, fastify.io);
    return { ok: true };
  });

  fastify.post('/rooms/:roomId/elias/next-turn', async (request, reply) => {
    const { roomId } = request.params;
    const { playerId } = request.body || {};
    if (!allowAction(`elias:next:${roomId}:${playerId}`, 15, 5000)) {
      return reply.code(429).send(ERR.tooMany);
    }
    const room = roomManager.get(roomId);
    if (!room || room.game !== 'elias' || !room.gameState) return reply.code(404).send({ error: 'Игра не найдена' });
    const gs = room.gameState;
    const team = gs.teams[gs.currentTeamIndex];
    const explainerId = team?.players?.length
      ? team.players[gs.currentExplainerIndex % team.players.length]
      : null;
    if (playerId !== explainerId) {
      return reply.code(403).send({ error: 'Смену хода завершает только текущий объясняющий' });
    }
    eliasNextTurn(roomId, fastify.io);
    return { ok: true };
  });

  fastify.patch('/rooms/:roomId/players/me', async (request, reply) => {
    const { roomId } = request.params;
    const { playerId, inventory, photo_url, avatar_emoji } = request.body || {};
    const room = roomManager.get(roomId);
    if (!room) return reply.code(404).send({ error: 'Room not found' });
    if (!room.players.some((p) => p.id === playerId)) return reply.code(403).send({ error: 'Not in room' });
    const inv = inventory && typeof inventory === 'object'
      ? { dictionaries: Array.isArray(inventory.dictionaries) ? inventory.dictionaries : ['free'], hasPro: Boolean(inventory.hasPro) }
      : { dictionaries: ['free'], hasPro: false };
    roomManager.setPlayerInventory(roomId, playerId, inv, photo_url, avatar_emoji);
    const updated = roomManager.get(roomId);
    return { room: roomManager.toSafe(updated) };
  });

  fastify.post('/rooms/:roomId/leave', async (request, reply) => {
    const { roomId } = request.params;
    const { playerId } = request.body || {};
    const room = roomManager.get(roomId);
    if (!room) return reply.code(404).send({ error: 'Room not found' });
    if (!room.players?.some((p) => p.id === playerId)) return reply.code(403).send({ error: 'Not in room' });
    const wasHost = room.hostId === playerId;
    const leftRoom = roomManager.leave(roomId, playerId);
    const io = fastify.io;
    io.to(roomId).emit('player_left', { playerId });
    if (leftRoom && wasHost) {
      io.to(roomId).emit('host_changed', { hostId: leftRoom.hostId });
    }
    const r = roomManager.get(roomId);
    if (r?.state === 'playing') {
      const connected = Object.values(r.playerSockets || {}).filter(Boolean).length;
      if (connected < 2) {
        roomManager.endGame(roomId);
        io.to(roomId).emit('game_ended');
      }
    }
    return { ok: true, room: r ? roomManager.toSafe(r) : null };
  });

  fastify.post('/rooms/:roomId/kick', async (request, reply) => {
    const { roomId } = request.params;
    const { hostId, playerIdToKick } = request.body || {};
    const room = roomManager.get(roomId);
    if (!room) return reply.code(404).send({ error: 'Room not found' });
    if (room.hostId !== hostId) return reply.code(403).send({ error: 'Only host can kick' });
    const result = roomManager.kick(roomId, hostId, playerIdToKick);
    if (!result) return reply.code(400).send({ error: 'Cannot kick' });
    const wasHost = room.hostId === playerIdToKick;
    const socketId = result.socketId;
    const leftRoom = roomManager.leave(roomId, playerIdToKick);
    const io = fastify.io;
    if (socketId) {
      const sock = io.sockets.sockets.get(socketId);
      if (sock) sock.disconnect(true);
    }
    io.to(roomId).emit('player_left', { playerId: playerIdToKick });
    if (leftRoom && wasHost) {
      io.to(roomId).emit('host_changed', { hostId: leftRoom.hostId });
    }
    const r = roomManager.get(roomId);
    if (r?.state === 'playing') {
      const connected = Object.values(r.playerSockets || {}).filter(Boolean).length;
      if (connected < 2) {
        roomManager.endGame(roomId);
        io.to(roomId).emit('game_ended');
      }
    }
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
