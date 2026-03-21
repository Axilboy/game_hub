import { roomManager } from './roomManager.js';
import { getRandomWord, getSpyRoleHintsForLocation, getSpyRolePoolForLocation, getWordsByDictionaryIds } from './words.js';
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
import { getEliasWords, getRandomEliasWord } from './eliasWords.js';
import {
  getTruthDareCatalog,
  createTruthDareState,
  pickTruthDareDecoupled,
  getUnlockedTruthDareCategorySlugs,
  getTruthDareCardById,
  getTruthDareCardSummary,
} from './truthDare.js';
import { createBunkerState, pickNextCrisis, canUseBunkerScenario, BUNKER_SCENARIOS } from './bunker.js';

export async function roomRoutes(fastify) {
  function pickEliasWord(gs) {
    const dictWords = getEliasWords(gs.dictionaryIds);
    const customWords = Array.isArray(gs.customWords) ? gs.customWords : [];
    const merged = [...new Set([...dictWords, ...customWords].map((w) => String(w || '').trim()).filter(Boolean))];
    if (merged.length === 0) return getRandomEliasWord(gs.dictionaryIds);
    if (!gs.usedWordsInMatch) gs.usedWordsInMatch = [];
    const used = new Set(gs.usedWordsInMatch);
    let pool = merged.filter((w) => !used.has(w));
    if (pool.length === 0) {
      gs.usedWordsInMatch = [];
      pool = merged;
    }
    const pick = pool[Math.floor(Math.random() * pool.length)];
    gs.usedWordsInMatch.push(pick);
    return pick;
  }

  const ERR = {
    tooMany: { error: 'Слишком часто. Подождите немного.' },
    playerIdRequired: { error: 'Нужен playerId' },
    hostOnly: { error: 'Только хост может запустить игру' },
    gameNotFound: { error: 'Игра не найдена' },
    notInRoom: { error: 'Вы не в комнате' },
    notVotingPhase: { error: 'Сейчас не фаза голосования' },
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
      ? {
        dictionaries: Array.isArray(inventory.dictionaries) ? inventory.dictionaries : ['free'],
        unlockedItems: Array.isArray(inventory.unlockedItems) ? inventory.unlockedItems.map(String) : [],
        hasPro: Boolean(inventory.hasPro),
      }
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
    const { roomId, hostId, timerEnabled = false, timerSeconds = 60, spyCount = 1, allSpiesChanceEnabled = false, spiesSeeEachOther = false, showLocationsList = false, dictionaryIds } = request.body || {};
    const room = roomManager.get(roomId);
    if (!room) return reply.code(404).send({ error: 'Room not found' });
    if (room.hostId !== hostId) return reply.code(403).send({ error: 'Only host can start' });
    const players = room.players;
    const minPlayers = minSpyPlayers(spyCount);
    if (players.length < minPlayers) return reply.code(400).send({ error: `Need at least ${minPlayers} players for ${spyCount} spy/spies` });
    const safeRoom = roomManager.toSafe(room);
    const allowedDicts = new Set(safeRoom.availableDictionaries || ['free']);
    if (Array.isArray(dictionaryIds) && dictionaryIds.length === 0) {
      return reply.code(400).send({ error: 'Выберите хотя бы один набор локаций в настройках' });
    }
    const ids = Array.isArray(dictionaryIds) ? dictionaryIds.filter((d) => allowedDicts.has(d)) : null;
    const pickedIds = ids && ids.length ? ids : (dictionaryIds === undefined ? ['free'] : []);
    if (!pickedIds.length) {
      return reply.code(400).send({ error: 'Нет доступных выбранных наборов — снимите блокировки или выберите другие локации' });
    }
    const word = getRandomWord(pickedIds);
    const locationPool = getWordsByDictionaryIds(pickedIds).slice(0, 160);
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
    const rolePool = getSpyRolePoolForLocation(word);
    const civilianRolesByPlayerId = {};
    for (const p of players) {
      if (!spyIds.includes(p.id)) {
        civilianRolesByPlayerId[p.id] = rolePool[Math.floor(Math.random() * rolePool.length)];
      }
    }
    recordGameSession();
    roomManager.setGame(roomId, 'spy');
    roomManager.setState(roomId, 'playing', {
      word,
      spyIds,
      allSpiesRound,
      spiesSeeEachOther: Boolean(spiesSeeEachOther),
      showLocationsList: Boolean(showLocationsList),
      locationPool,
      civilianRolesByPlayerId,
      timerEnabled: Boolean(timerEnabled),
      timerSeconds: safeSeconds,
      readyIds: [],
      timerStartsAt: null,
      guessPollActive: false,
      guessPollVotes: {},
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
    const gs = room.gameState;
    const { word, spyIds, timerEnabled, timerSeconds, allSpiesRound, timerStartsAt, spiesSeeEachOther, showLocationsList, locationPool } = gs;
    const isSpy = spyIds.includes(playerId);
    const wStr = String(word || '');
    const wordChars = [...wStr];
    const wordMask = wordChars.map(() => '•').join(' ');
    const civs = spyCivilianPlayers(room, gs);
    let guessPollCounts = { correct: 0, wrong: 0, answered: 0, expected: civs.length };
    if (gs.guessPollActive) {
      const votes = gs.guessPollVotes || {};
      for (const p of civs) {
        const v = votes[p.id];
        if (v === 'correct') {
          guessPollCounts.correct++;
          guessPollCounts.answered++;
        } else if (v === 'wrong') {
          guessPollCounts.wrong++;
          guessPollCounts.answered++;
        }
      }
    }
    const guessPollBlock = {
      guessPollActive: Boolean(gs.guessPollActive),
      guessPollMyVote: gs.guessPollVotes?.[playerId] || null,
      guessPollCounts,
    };
    const showRoleBlock = Boolean(gs.showLocationsList);
    const myCivilianRole =
      !isSpy && showRoleBlock ? (gs.civilianRolesByPlayerId?.[playerId] || null) : null;
    const payload = {
      role: isSpy ? 'spy' : 'civilian',
      timerEnabled: Boolean(timerEnabled),
      timerSeconds: timerSeconds || 60,
      allSpiesRound: Boolean(allSpiesRound),
      timerStartsAt: timerStartsAt || null,
      showLocationsList: Boolean(showLocationsList),
      locationList: Array.isArray(locationPool) ? locationPool : [],
      roleHints: getSpyRoleHintsForLocation(word),
      myCivilianRole,
      showRoleBlock,
      wordLength: wordChars.length,
      wordMask,
      ...guessPollBlock,
    };
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
    // Элиас: таймер и слово стартуют только после «Начать» у объясняющего (см. /elias/begin-round)
    return { ok: true, timerStarted: allReady };
  });

  function spyCivilianPlayers(room, gs) {
    const spySet = new Set(gs.spyIds || []);
    return (room.players || []).filter((p) => !spySet.has(p.id));
  }

  function resolveGuessPoll(roomId, io, { force = false } = {}) {
    const room = roomManager.get(roomId);
    if (!room || room.game !== 'spy' || !room.gameState) return;
    const gs = room.gameState;
    if (!gs.guessPollActive) return;
    const civs = spyCivilianPlayers(room, gs);
    if (civs.length === 0) {
      gs.guessPollActive = false;
      gs.guessPollVotes = {};
      return;
    }
    const votes = gs.guessPollVotes || {};
    let correct = 0;
    let wrong = 0;
    let answered = 0;
    for (const p of civs) {
      const v = votes[p.id];
      if (v === 'correct') {
        correct++;
        answered++;
      } else if (v === 'wrong') {
        wrong++;
        answered++;
      }
    }
    if (!force && answered < civs.length) return;
    gs.guessPollActive = false;
    gs.guessPollVotes = {};
    const spyIds = gs.spyIds || [];
    const spyId = spyIds[0];
    const spyPlayer = spyId ? room.players.find((p) => p.id === spyId) : null;
    if (correct > wrong) {
      roomManager.endGame(roomId);
      io.to(roomId).emit('game_guess_result', {
        guessedById: spyId,
        guessedByName: spyPlayer?.name || 'Шпион',
        guessedLocation: gs.word,
        correct: true,
        actualLocation: gs.word,
        verbalPoll: true,
      });
      io.to(roomId).emit('game_ended');
    } else {
      io.to(roomId).emit('game_guess_poll_result', { accepted: false });
    }
  }

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
    if (!room.players.some((p) => p.id === playerId)) {
      return reply.code(403).send({ error: 'Только игроки в комнате могут начать голосование' });
    }
    if (!allowAction(`spy:startvote:${roomId}:${playerId}`, 6, 20_000)) {
      return reply.code(429).send(ERR.tooMany);
    }
    const gs = room.gameState;
    const now = Date.now();
    if (gs.votingEndsAt && gs.votingEndsAt > now) return reply.send({ votingEndsAt: gs.votingEndsAt });
    if (gs.guessPollActive) {
      gs.guessPollActive = false;
      gs.guessPollVotes = {};
    }
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

  const DEFAULT_MAFIA_PHASE_TIMERS = {
    nightMafia: 45,
    nightCommissioner: 25,
    day: 90,
    voting: 45,
  };

  function normalizeMafiaTimers(timers) {
    const t = timers && typeof timers === 'object' ? timers : {};
    const toSec = (val, fallback) => Math.min(300, Math.max(0, Number(val) || fallback));
    return {
      nightMafia: toSec(t.nightMafia, DEFAULT_MAFIA_PHASE_TIMERS.nightMafia),
      nightCommissioner: toSec(t.nightCommissioner, DEFAULT_MAFIA_PHASE_TIMERS.nightCommissioner),
      day: toSec(t.day, DEFAULT_MAFIA_PHASE_TIMERS.day),
      voting: toSec(t.voting, DEFAULT_MAFIA_PHASE_TIMERS.voting),
    };
  }

  function phaseDurationFor(gs, phase) {
    const timers = normalizeMafiaTimers(gs?.settings?.phaseTimers);
    if (phase === 'night_mafia') return timers.nightMafia;
    if (phase === 'night_commissioner') return timers.nightCommissioner;
    if (phase === 'day') return timers.day;
    if (phase === 'voting') return timers.voting;
    return 0;
  }

  function markMafiaPhase(gs, phase) {
    gs.phase = phase;
    gs.phaseStartedAt = Date.now();
    gs.phaseDurationSec = phaseDurationFor(gs, phase);
  }

  fastify.post('/rooms/:roomId/spy/guess-location', async (request, reply) => {
    const { roomId } = request.params;
    const { playerId, guess } = request.body || {};
    if (!allowAction(`spy:guess:${roomId}:${playerId}`, 8, 20_000)) {
      return reply.code(429).send(ERR.tooMany);
    }
    const room = roomManager.get(roomId);
    if (!room || room.game !== 'spy' || !room.gameState) return reply.code(404).send({ error: 'Игра не найдена' });
    const gs = room.gameState;
    if (!gs.spyIds?.includes(playerId)) return reply.code(403).send({ error: 'Только шпион может угадывать локацию' });
    if (gs.votingEndsAt && gs.votingEndsAt > Date.now()) return reply.code(400).send({ error: 'Во время голосования угадывать нельзя' });
    const g = String(guess || '').trim().toLowerCase();
    if (!g) return reply.code(400).send({ error: 'Введите локацию' });
    const correct = String(gs.word || '').trim().toLowerCase() === g;
    if (correct) {
      const io = fastify.io;
      roomManager.endGame(roomId);
      io.to(roomId).emit('game_guess_result', {
        guessedById: playerId,
        guessedByName: room.players.find((p) => p.id === playerId)?.name || 'Шпион',
        guessedLocation: guess,
        correct: true,
        actualLocation: gs.word,
      });
      io.to(roomId).emit('game_ended');
      return { ok: true, correct: true, ended: true };
    }
    return { ok: true, correct: false };
  });

  fastify.post('/rooms/:roomId/spy/start-guess-poll', async (request, reply) => {
    const { roomId } = request.params;
    const { playerId } = request.body || {};
    if (!playerId) return reply.code(400).send(ERR.playerIdRequired);
    if (!allowAction(`spy:guesspollstart:${roomId}:${playerId}`, 6, 15_000)) {
      return reply.code(429).send(ERR.tooMany);
    }
    const room = roomManager.get(roomId);
    if (!room || room.game !== 'spy' || !room.gameState) return reply.code(404).send({ error: 'Игра не найдена' });
    const gs = room.gameState;
    if (!gs.spyIds?.includes(playerId)) return reply.code(403).send({ error: 'Только шпион может начать проверку' });
    if (gs.allSpiesRound) return reply.code(400).send({ error: 'В режиме «все шпионы» устная проверка недоступна' });
    const now = Date.now();
    if (gs.votingEndsAt && gs.votingEndsAt > now) return reply.code(400).send({ error: 'Сначала завершите голосование' });
    const civs = spyCivilianPlayers(room, gs);
    if (civs.length === 0) return reply.code(400).send({ error: 'Нет игроков для голосования' });
    gs.guessPollActive = true;
    gs.guessPollVotes = {};
    fastify.io.to(roomId).emit('game_guess_poll_start', {});
    return { ok: true };
  });

  fastify.post('/rooms/:roomId/spy/guess-poll-vote', async (request, reply) => {
    const { roomId } = request.params;
    const { playerId, verdict } = request.body || {};
    if (!playerId) return reply.code(400).send(ERR.playerIdRequired);
    if (verdict !== 'correct' && verdict !== 'wrong') {
      return reply.code(400).send({ error: 'verdict: correct или wrong' });
    }
    if (!allowAction(`spy:guesspollvote:${roomId}:${playerId}`, 30, 8000)) {
      return reply.code(429).send(ERR.tooMany);
    }
    const room = roomManager.get(roomId);
    if (!room || room.game !== 'spy' || !room.gameState) return reply.code(404).send({ error: 'Игра не найдена' });
    const gs = room.gameState;
    if (!gs.guessPollActive) return reply.code(400).send({ error: 'Проверка не активна' });
    if (gs.spyIds?.includes(playerId)) return reply.code(403).send({ error: 'Шпион не голосует' });
    gs.guessPollVotes = gs.guessPollVotes || {};
    gs.guessPollVotes[playerId] = verdict;
    const civs = spyCivilianPlayers(room, gs);
    const votes = gs.guessPollVotes;
    let answered = 0;
    for (const p of civs) {
      if (votes[p.id] === 'correct' || votes[p.id] === 'wrong') answered++;
    }
    if (answered >= civs.length) {
      resolveGuessPoll(roomId, fastify.io, { force: true });
    }
    return { ok: true };
  });

  fastify.post('/rooms/:roomId/spy/end-guess-poll', async (request, reply) => {
    const { roomId } = request.params;
    const { playerId } = request.body || {};
    if (!playerId) return reply.code(400).send(ERR.playerIdRequired);
    const room = roomManager.get(roomId);
    if (!room || room.game !== 'spy' || !room.gameState) return reply.code(404).send({ error: 'Игра не найдена' });
    if (room.hostId !== playerId) return reply.code(403).send({ error: 'Только хост может завершить проверку досрочно' });
    const gs = room.gameState;
    if (!gs.guessPollActive) return reply.code(400).send({ error: 'Проверка не активна' });
    resolveGuessPoll(roomId, fastify.io, { force: true });
    return { ok: true };
  });

  fastify.post('/rooms/:roomId/transfer-host', async (request, reply) => {
    const { roomId } = request.params;
    const { playerId, newHostId } = request.body || {};
    if (!playerId || !newHostId) return reply.code(400).send({ error: 'Нужны playerId и newHostId' });
    if (!allowAction(`transferhost:${roomId}:${playerId}`, 4, 20_000)) {
      return reply.code(429).send(ERR.tooMany);
    }
    const room = roomManager.get(roomId);
    if (!room) return reply.code(404).send({ error: 'Комната не найдена' });
    if (room.hostId !== playerId) return reply.code(403).send({ error: 'Только хост может передать права' });
    if (!room.players.some((p) => p.id === newHostId)) return reply.code(400).send({ error: 'Игрок не в комнате' });
    const r = roomManager.transferHost(roomId, playerId, newHostId);
    if (!r) return reply.code(400).send({ error: 'Не удалось передать хоста' });
    const io = fastify.io;
    io.to(roomId).emit('host_changed', { hostId: r.hostId });
    io.to(roomId).emit('room_updated');
    return { ok: true, room: roomManager.toSafe(r) };
  });

  fastify.post('/rooms/mafia/start', async (request, reply) => {
    const { roomId, hostId, moderatorId, extended = false, revealRoleOnDeath = true, mafiaCanSkipKill = false, phaseTimers } = request.body || {};
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
    const gs = createMafiaState(players, {
      extended,
      revealRoleOnDeath,
      mafiaCanSkipKill,
      moderatorId: modId,
      theme: 'default',
      phaseTimers: normalizeMafiaTimers(phaseTimers),
    });
    markMafiaPhase(gs, 'night_mafia');
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
    const { playerId, expectedPhase, expectedPhaseStartedAt } = request.body || {};
    const room = roomManager.get(roomId);
    if (!room || room.game !== 'mafia' || !room.gameState) return reply.code(404).send({ error: 'Game not found' });
    const gs = room.gameState;
    if (gs.moderatorId !== playerId) return reply.code(403).send({ error: 'Только ведущий может продвигать фазу' });
    // Safe sync for auto-advance: ignore stale requests (client timer/duplicates).
    // If we don't match the current phase timing, another transition already happened.
    if (expectedPhase && gs.phase !== expectedPhase) {
      return { ok: true, ignored: true, reason: 'stale_phase' };
    }
    if (expectedPhaseStartedAt != null && Number(gs.phaseStartedAt) !== Number(expectedPhaseStartedAt)) {
      return { ok: true, ignored: true, reason: 'stale_phaseStartedAt' };
    }
    if (!allowAction(`mafia:advance:${roomId}:${playerId}`, 16, 8000)) {
      return reply.code(429).send(ERR.tooMany);
    }
    const io = fastify.io;
    if (gs.phase === 'night_mafia') {
      const mafiaIds = getMafiaPlayers(gs.roles);
      const needCommissioner = room.players.some((p) => gs.roles[p.id] === 'commissioner' && gs.alive.includes(p.id));
      markMafiaPhase(gs, needCommissioner ? 'night_commissioner' : 'day');
      if (gs.phase === 'day') {
        const next = resolveNight(gs, room.players);
        Object.assign(gs, next);
        gs.phaseStartedAt = Date.now();
        gs.phaseDurationSec = phaseDurationFor(gs, gs.phase);
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
      markMafiaPhase(gs, 'day');
      const next = resolveNight(gs, room.players);
      Object.assign(gs, next);
      gs.phaseStartedAt = Date.now();
      gs.phaseDurationSec = phaseDurationFor(gs, gs.phase);
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
      markMafiaPhase(gs, 'voting');
      io.to(roomId).emit('mafia_phase', { phase: 'voting' });
      return { ok: true };
    }
    if (gs.phase === 'voting') {
      const next = resolveDayVote(gs);
      Object.assign(gs, next);
      gs.phaseStartedAt = Date.now();
      gs.phaseDurationSec = phaseDurationFor(gs, gs.phase);
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
    const { roomId, hostId, timerSeconds = 60, scoreLimit = 10, dictionaryIds, skipPenalty = 1, customWords = [], teams: teamsInput, team1Ids, team2Ids } = request.body || {};
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
    if (!Array.isArray(dictionaryIds) || dictionaryIds.length === 0) {
      return reply.code(400).send({ error: 'Выберите хотя бы один словарь в настройках' });
    }
    const dictIds = dictionaryIds;
    const normalizedCustomWords = Array.isArray(customWords)
      ? [...new Set(customWords.map((w) => String(w || '').trim()).filter(Boolean))].slice(0, 400)
      : [];
    const roundSeconds = Math.min(120, Math.max(30, Number(timerSeconds) || 60));
    const gs = {
      teams,
      currentTeamIndex: 0,
      currentExplainerIndex: 0,
      currentWord: null,
      awaitingExplainerStart: true,
      usedWordsInMatch: [],
      dictionaryIds: dictIds,
      customWords: normalizedCustomWords,
      roundEndsAt: null,
      timerSeconds: roundSeconds,
      scoreLimit: Math.min(100, Math.max(5, Number(scoreLimit) || 10)),
      skipPenalty: Math.min(3, Math.max(0, Number(skipPenalty) || 1)),
      winner: null,
      readyIds: [],
      // Prevent accidental double-score/skip for the same word (e.g. multiple teammates click).
      lastGuessedWord: null,
      lastSkippedWord: null,
      playerStats: {},
    };
    for (const p of players) {
      gs.playerStats[p.id] = { guessed: 0, skipped: 0 };
    }
    recordGameSession();
    roomManager.setGame(roomId, 'elias');
    roomManager.setState(roomId, 'playing', gs);
    const io = fastify.io;
    io.to(roomId).emit('game_start', { game: 'elias' });
    return { ok: true };
  });

  fastify.get('/rooms/:roomId/truth_dare/catalog', async (request, reply) => {
    const { roomId } = request.params;
    const playerId = request.query?.playerId;
    if (!playerId) return reply.code(400).send(ERR.playerIdRequired);
    const room = roomManager.get(roomId);
    if (!room) return reply.code(404).send({ error: 'Комната не найдена' });
    if (!room.players?.some((p) => p.id === playerId)) return reply.code(403).send(ERR.notInRoom);
    const inv = room.playerInventories || {};
    const hasPro = Boolean(inv[playerId]?.hasPro);
    return { ok: true, categories: getTruthDareCatalog({ playerHasPro: hasPro }) };
  });

  fastify.post('/rooms/truth_dare/start', async (request, reply) => {
    const {
      roomId,
      hostId,
      mode,
      categorySlugs,
      show18Plus = false,
      safeMode = true,
      roundsCount,
      timerSeconds,
      skipLimitPerPlayer,
      randomStartPlayer,
    } = request.body || {};
    const room = roomManager.get(roomId);
    if (!room) return reply.code(404).send({ error: 'Комната не найдена' });
    if (room.hostId !== hostId) return reply.code(403).send(ERR.hostOnly);
    if (!room.players || room.players.length < 2) return reply.code(400).send({ error: 'Для Правда/Действие нужно минимум 2 игрока' });
    if (!allowAction(`truthdare:start:${roomId}:${hostId}`, 4, 20_000)) {
      return reply.code(429).send(ERR.tooMany);
    }
    const gs = createTruthDareState(room, {
      mode,
      categorySlugs,
      show18Plus,
      safeMode,
      roundsCount,
      timerSeconds,
      skipLimitPerPlayer,
      randomStartPlayer,
    });
    if (!gs?.currentCard) {
      return reply.code(400).send({ error: 'Не удалось подобрать карточку для старта. Проверьте режим, Safe/18+ и выбранные категории (учитывается Pro у текущего игрока).' });
    }
    recordGameSession();
    roomManager.setGame(roomId, 'truth_dare');
    roomManager.setState(roomId, 'playing', gs);
    const io = fastify.io;
    const tokenToSchedule = gs.turnToken;
    const durMs = Math.max(0, (gs.turnEndsAt ?? Date.now()) - Date.now());
    if (gs.turnTimeoutId) clearTimeout(gs.turnTimeoutId);
    gs.turnTimeoutId = setTimeout(() => truthDareOnTurnTimeout(roomId, tokenToSchedule), durMs);
    io.to(roomId).emit('game_start', { game: 'truth_dare' });
    return { ok: true };
  });

  fastify.get('/rooms/:roomId/truth_dare/state', async (request, reply) => {
    const { roomId } = request.params;
    const playerId = request.query?.playerId;
    if (!playerId) return reply.code(400).send(ERR.playerIdRequired);
    const room = roomManager.get(roomId);
    if (!room || room.game !== 'truth_dare' || !room.gameState) return reply.code(404).send(ERR.gameNotFound);
    if (!room.players?.some((p) => p.id === playerId)) return reply.code(403).send(ERR.notInRoom);
    const gs = room.gameState;
    const getPlayerName = (id) => room.players.find((p) => p.id === id)?.name || id;
    const pointsToWin = Math.min(50, Math.max(1, Number(gs.settings?.roundsCount) || 5));
    return {
      phase: gs.phase,
      roundIndex: gs.roundIndex,
      roundsCount: gs.settings?.roundsCount ?? null,
      pointsToWin,
      mode: gs.settings?.mode ?? null,
      timerSeconds: gs.settings?.timerSeconds ?? null,
      skipLimitPerPlayer: gs.settings?.skipLimitPerPlayer ?? null,
      safeMode: Boolean(gs.settings?.safeMode),
      show18Plus: Boolean(gs.settings?.show18Plus),
      playerOrder: gs.playerOrder || [],
      currentPlayerId: gs.currentPlayerId || null,
      isMyTurn: gs.currentPlayerId === playerId,
      turnToken: gs.turnToken ?? null,
      turnStartedAt: gs.turnStartedAt ?? null,
      turnEndsAt: gs.turnEndsAt ?? null,
      isAdultConfirmed: Boolean(gs.ageConfirmedByPlayerId?.[playerId]),
      currentCard: gs.currentCard
        ? {
          id: gs.currentCard.id,
          truth: gs.currentCard.truth ?? '',
          dare: gs.currentCard.dare ?? '',
          categorySlug: gs.currentCard.categorySlug,
          is18Plus: Boolean(gs.currentCard.is18Plus),
        }
        : null,
      currentPlayerName: gs.currentPlayerId ? getPlayerName(gs.currentPlayerId) : null,
      skipsUsed: Number(gs.skipCountByPlayerId?.[playerId]) || 0,
      skipsLeft: Math.max(0, Number(gs.settings?.skipLimitPerPlayer || 0) - (Number(gs.skipCountByPlayerId?.[playerId]) || 0)),
      playerStats: gs.playerStats || {},
      turnHistory: (gs.turnHistory || []).slice(-8).map((x) => ({ ...x, playerName: getPlayerName(x.playerId) })),
      myLikes: gs.likesByPlayerId?.[playerId] || [],
      myFavorites: gs.favoritesByPlayerId?.[playerId] || [],
      currentCardLikes: Number(gs.cardLikes?.[gs.currentCard?.id]) || 0,
      currentCardReports: Number(gs.cardReports?.[gs.currentCard?.id]) || 0,
    };
  });

  fastify.post('/rooms/:roomId/truth_dare/confirm-18plus', async (request, reply) => {
    const { roomId } = request.params;
    const { playerId } = request.body || {};
    if (!playerId) return reply.code(400).send(ERR.playerIdRequired);
    const room = roomManager.get(roomId);
    if (!room || room.game !== 'truth_dare' || !room.gameState) return reply.code(404).send(ERR.gameNotFound);
    if (!room.players?.some((p) => p.id === playerId)) return reply.code(403).send(ERR.notInRoom);
    const gs = room.gameState;
    gs.ageConfirmedByPlayerId = gs.ageConfirmedByPlayerId || {};
    gs.ageConfirmedByPlayerId[playerId] = true;
    fastify.io.to(roomId).emit('truth_dare_update', {});
    return { ok: true };
  });

  function truthDareFinishWithWinner(roomId, io, winnerPlayerId) {
    const room = roomManager.get(roomId);
    if (!room || room.game !== 'truth_dare' || !room.gameState) return;
    const gs = room.gameState;
    if (gs.turnTimeoutId) clearTimeout(gs.turnTimeoutId);
    gs.turnTimeoutId = null;
    const getName = (id) => room.players.find((p) => p.id === id)?.name || id;
    const playerStats = { ...(gs.playerStats || {}) };
    const ranking = Object.keys(playerStats)
      .map((id) => ({
        id,
        name: getName(id),
        done: playerStats[id]?.done || 0,
        truth: playerStats[id]?.truth || 0,
        dare: playerStats[id]?.dare || 0,
      }))
      .sort((a, b) => b.done - a.done);
    const payload = {
      game: 'truth_dare',
      winnerPlayerId,
      winnerName: getName(winnerPlayerId),
      playerStats,
      ranking,
    };
    roomManager.endGame(roomId, { lastGameResult: payload });
    io.to(roomId).emit('game_ended', payload);
  }

  function truthDareOnTurnTimeout(roomId, expectedToken) {
    const io = fastify.io;
    const room = roomManager.get(roomId);
    if (!room || room.game !== 'truth_dare' || !room.gameState) return;
    const gs = room.gameState;
    if (gs.turnToken !== expectedToken) return; // stale / already advanced

    gs.turnResults = gs.turnResults || {};
    if (!gs.turnResults[expectedToken]) {
      gs.turnResults[expectedToken] = { playerId: gs.currentPlayerId, action: 'timeout', at: Date.now() };
    }
    if (gs.currentPlayerId) {
      gs.playerStats = gs.playerStats || {};
      gs.playerStats[gs.currentPlayerId] = gs.playerStats[gs.currentPlayerId] || { done: 0, skip: 0, timeout: 0, truth: 0, dare: 0 };
      gs.playerStats[gs.currentPlayerId].timeout = (gs.playerStats[gs.currentPlayerId].timeout || 0) + 1;
      gs.turnHistory = gs.turnHistory || [];
      gs.turnHistory.push({ token: expectedToken, playerId: gs.currentPlayerId, action: 'timeout', at: Date.now() });
    }

    truthDareAdvanceTurn(roomId, io, { expectedTurnToken: expectedToken });
  }

  function truthDareAdvanceTurn(roomId, io, { expectedTurnToken } = {}) {
    const room = roomManager.get(roomId);
    if (!room || room.game !== 'truth_dare' || !room.gameState) return;
    const gs = room.gameState;
    if (expectedTurnToken != null && gs.turnToken !== expectedTurnToken) return;

    if (gs.turnTimeoutId) clearTimeout(gs.turnTimeoutId);
    gs.turnTimeoutId = null;

    const nextRoundIndex = (gs.roundIndex ?? 0) + 1;

    const playerOrder = gs.playerOrder || [];
    if (!playerOrder.length) {
      roomManager.endGame(roomId);
      io.to(roomId).emit('game_ended');
      return;
    }

    const nextPlayerIndex = ((gs.currentPlayerIndex ?? 0) + 1) % playerOrder.length;
    const nextPlayerId = playerOrder[nextPlayerIndex];

    gs.roundIndex = nextRoundIndex;
    gs.currentPlayerIndex = nextPlayerIndex;
    gs.currentPlayerId = nextPlayerId;

    const inv = room.playerInventories || {};
    const nextHasPro = Boolean(inv[nextPlayerId]?.hasPro);
    const nextUnlockedCategorySlugs = getUnlockedTruthDareCategorySlugs(inv[nextPlayerId]?.unlockedItems || []);
    const include18PlusForPlayer = Boolean(gs.settings?.show18Plus) && Boolean(gs.ageConfirmedByPlayerId?.[nextPlayerId]);

    let nextCard = pickTruthDareDecoupled({
      mode: gs.settings?.mode ?? 'mixed',
      categorySlugs: gs.settings?.categorySlugs ?? [],
      include18Plus: include18PlusForPlayer,
      safeMode: Boolean(gs.settings?.safeMode),
      playerHasPro: nextHasPro,
      unlockedCategorySlugs: nextUnlockedCategorySlugs,
      usedTruthCardIds: gs.usedTruthCardIds || [],
      usedDareCardIds: gs.usedDareCardIds || [],
    });

    if (!nextCard) {
      nextCard = pickTruthDareDecoupled({
        mode: gs.settings?.mode ?? 'mixed',
        categorySlugs: ['classic', 'friends'],
        include18Plus: false,
        safeMode: Boolean(gs.settings?.safeMode),
        playerHasPro: nextHasPro,
        unlockedCategorySlugs: nextUnlockedCategorySlugs,
        usedTruthCardIds: gs.usedTruthCardIds || [],
        usedDareCardIds: gs.usedDareCardIds || [],
      });
    }

    if (!nextCard) {
      roomManager.endGame(roomId);
      io.to(roomId).emit('game_ended');
      return;
    }

    gs.usedTruthCardIds = [...(gs.usedTruthCardIds || []), nextCard.truthCardId];
    gs.usedDareCardIds = [...(gs.usedDareCardIds || []), nextCard.dareCardId];
    gs.currentCard = nextCard;

    gs.turnToken = (Number(gs.turnToken) || 0) + 1;
    gs.turnStartedAt = Date.now();
    const timerSeconds = Number(gs.settings?.timerSeconds) || 60;
    gs.turnEndsAt = gs.turnStartedAt + timerSeconds * 1000;

    const tokenToSchedule = gs.turnToken;
    gs.turnTimeoutId = setTimeout(() => truthDareOnTurnTimeout(roomId, tokenToSchedule), timerSeconds * 1000);

    io.to(roomId).emit('truth_dare_update', {});
  }

  fastify.post('/rooms/:roomId/truth_dare/turn', async (request, reply) => {
    const { roomId } = request.params;
    const { playerId, action, turnToken, choice } = request.body || {};
    if (!playerId) return reply.code(400).send(ERR.playerIdRequired);
    if (turnToken == null) return reply.code(400).send({ error: 'Нужен turnToken' });
    if (action !== 'done' && action !== 'skip') return reply.code(400).send({ error: 'Некорректное действие' });
    if (action === 'done' && choice !== 'truth' && choice !== 'dare') {
      return reply.code(400).send({ error: 'Укажите choice: truth или dare' });
    }

    if (!allowAction(`truthdare:turn:${roomId}:${playerId}`, 12, 8000)) {
      return reply.code(429).send(ERR.tooMany);
    }

    const room = roomManager.get(roomId);
    if (!room || room.game !== 'truth_dare' || !room.gameState) return reply.code(404).send(ERR.gameNotFound);
    const gs = room.gameState;

    if (gs.currentPlayerId !== playerId) return reply.code(403).send({ error: 'Это не ваш ход' });
    if (gs.turnToken !== turnToken) return { ok: true, ignored: true, reason: 'stale_turn' };
    if (action === 'skip') {
      const used = Number(gs.skipCountByPlayerId?.[playerId]) || 0;
      const limit = Number(gs.settings?.skipLimitPerPlayer) || 0;
      if (limit > 0 && used >= limit) {
        return reply.code(400).send({ error: 'Лимит пропусков исчерпан' });
      }
      gs.skipCountByPlayerId = gs.skipCountByPlayerId || {};
      gs.skipCountByPlayerId[playerId] = used + 1;
    }

    gs.turnResults = gs.turnResults || {};
    if (!gs.turnResults[turnToken]) {
      gs.turnResults[turnToken] = { playerId, action, at: Date.now() };
    } else {
      // Idempotency: if the turn was already processed (same token), no need to advance again.
      if (gs.turnResults[turnToken]?.processed) {
        return { ok: true, already: true };
      }
    }

    // Mark processed so duplicates don't re-advance.
    gs.turnResults[turnToken] = { ...(gs.turnResults[turnToken] || {}), processed: true };
    gs.playerStats = gs.playerStats || {};
    gs.playerStats[playerId] = gs.playerStats[playerId] || { done: 0, skip: 0, timeout: 0, truth: 0, dare: 0 };
    if (action === 'done') {
      gs.playerStats[playerId].done = (gs.playerStats[playerId].done || 0) + 1;
      if (choice === 'truth') gs.playerStats[playerId].truth = (gs.playerStats[playerId].truth || 0) + 1;
      if (choice === 'dare') gs.playerStats[playerId].dare = (gs.playerStats[playerId].dare || 0) + 1;
    } else {
      gs.playerStats[playerId].skip = (gs.playerStats[playerId].skip || 0) + 1;
    }
    gs.turnHistory = gs.turnHistory || [];
    gs.turnHistory.push({
      token: turnToken,
      playerId,
      action,
      choice: action === 'done' ? choice : undefined,
      at: Date.now(),
    });

    const pointsToWin = Math.min(50, Math.max(1, Number(gs.settings?.roundsCount) || 5));
    if (action === 'done' && (gs.playerStats[playerId].done || 0) >= pointsToWin) {
      truthDareFinishWithWinner(roomId, fastify.io, playerId);
      return { ok: true };
    }

    truthDareAdvanceTurn(roomId, fastify.io, { expectedTurnToken: turnToken });
    return { ok: true };
  });

  fastify.post('/rooms/:roomId/truth_dare/react', async (request, reply) => {
    const { roomId } = request.params;
    const { playerId, cardId, like = true, favorite = false } = request.body || {};
    if (!playerId) return reply.code(400).send(ERR.playerIdRequired);
    if (!cardId) return reply.code(400).send({ error: 'cardId required' });
    const room = roomManager.get(roomId);
    if (!room || room.game !== 'truth_dare' || !room.gameState) return reply.code(404).send(ERR.gameNotFound);
    if (!room.players?.some((p) => p.id === playerId)) return reply.code(403).send(ERR.notInRoom);
    if (!allowAction(`truthdare:react:${roomId}:${playerId}`, 20, 12_000)) return reply.code(429).send(ERR.tooMany);
    const card = getTruthDareCardById(cardId);
    if (!card) return reply.code(400).send({ error: 'Неизвестная карточка' });
    const gs = room.gameState;
    gs.likesByPlayerId = gs.likesByPlayerId || {};
    gs.favoritesByPlayerId = gs.favoritesByPlayerId || {};
    gs.cardLikes = gs.cardLikes || {};
    gs.likesByPlayerId[playerId] = Array.isArray(gs.likesByPlayerId[playerId]) ? gs.likesByPlayerId[playerId] : [];
    gs.favoritesByPlayerId[playerId] = Array.isArray(gs.favoritesByPlayerId[playerId]) ? gs.favoritesByPlayerId[playerId] : [];
    if (like && !gs.likesByPlayerId[playerId].includes(cardId)) {
      gs.likesByPlayerId[playerId].push(cardId);
      gs.cardLikes[cardId] = (gs.cardLikes[cardId] || 0) + 1;
    }
    if (favorite && !gs.favoritesByPlayerId[playerId].includes(cardId)) {
      gs.favoritesByPlayerId[playerId].push(cardId);
    }
    fastify.io.to(roomId).emit('truth_dare_update', {});
    return { ok: true };
  });

  fastify.post('/rooms/:roomId/truth_dare/report', async (request, reply) => {
    const { roomId } = request.params;
    const { playerId, cardId, reason = '' } = request.body || {};
    if (!playerId) return reply.code(400).send(ERR.playerIdRequired);
    if (!cardId) return reply.code(400).send({ error: 'cardId required' });
    const room = roomManager.get(roomId);
    if (!room || room.game !== 'truth_dare' || !room.gameState) return reply.code(404).send(ERR.gameNotFound);
    if (!room.players?.some((p) => p.id === playerId)) return reply.code(403).send(ERR.notInRoom);
    if (!allowAction(`truthdare:report:${roomId}:${playerId}`, 8, 30_000)) return reply.code(429).send(ERR.tooMany);
    const card = getTruthDareCardById(cardId);
    if (!card) return reply.code(400).send({ error: 'Неизвестная карточка' });
    const gs = room.gameState;
    gs.reportedByPlayerAndCard = gs.reportedByPlayerAndCard || {};
    gs.cardReports = gs.cardReports || {};
    const key = `${playerId}:${cardId}`;
    if (gs.reportedByPlayerAndCard[key]) return { ok: true, already: true };
    gs.reportedByPlayerAndCard[key] = true;
    gs.cardReports[cardId] = (gs.cardReports[cardId] || 0) + 1;
    gs.reportLog = gs.reportLog || [];
    gs.reportLog.push({ cardId, by: playerId, reason: String(reason || '').slice(0, 160), at: Date.now() });
    fastify.io.to(roomId).emit('truth_dare_update', {});
    return { ok: true };
  });

  fastify.get('/rooms/:roomId/truth_dare/moderation', async (request, reply) => {
    const { roomId } = request.params;
    const playerId = request.query?.playerId;
    if (!playerId) return reply.code(400).send(ERR.playerIdRequired);
    const room = roomManager.get(roomId);
    if (!room || room.game !== 'truth_dare' || !room.gameState) return reply.code(404).send(ERR.gameNotFound);
    if (room.hostId !== playerId) return reply.code(403).send(ERR.hostOnly);
    const gs = room.gameState;
    const rows = Object.entries(gs.cardReports || {})
      .map(([cardId, reports]) => {
        const card = getTruthDareCardById(cardId);
        return {
          cardId,
          reports: Number(reports) || 0,
          likes: Number(gs.cardLikes?.[cardId]) || 0,
          text: getTruthDareCardSummary(card) || '—',
          categorySlug: card?.categorySlug || 'unknown',
        };
      })
      .sort((a, b) => b.reports - a.reports || b.likes - a.likes)
      .slice(0, 25);
    return { ok: true, rows };
  });

  // -----------------------------
  // BUNKER (rules engine v1)
  // -----------------------------

  function bunkerMarkPhase(gs, phase) {
    const timers = gs.settings?.phaseTimers || {};
    gs.phase = phase;
    gs.phaseStartedAt = Date.now();
    gs.phaseDurationSec = Number(timers[phase]) || 15;
    gs.phaseToken = (Number(gs.phaseToken) || 0) + 1;
  }

  function bunkerClearTimeout(gs) {
    if (gs?.bunkerPhaseTimeoutId) clearTimeout(gs.bunkerPhaseTimeoutId);
    gs.bunkerPhaseTimeoutId = null;
  }

  function bunkerScheduleNext(roomId, io, token, durationMs) {
    const room = roomManager.get(roomId);
    if (!room || room.game !== 'bunker' || !room.gameState) return;
    const gs = room.gameState;
    const dur = Math.max(0, Number(durationMs) || 0);
    gs.bunkerPhaseTimeoutId = setTimeout(() => bunkerOnPhaseTimeout(roomId, token), dur);
  }

  function bunkerOnPhaseTimeout(roomId, expectedToken) {
    const room = roomManager.get(roomId);
    if (!room || room.game !== 'bunker' || !room.gameState) return;
    const gs = room.gameState;
    if (gs.phaseToken !== expectedToken) return; // stale timeout

    bunkerAdvancePhase(roomId);
  }

  function bunkerAdvancePhase(roomId) {
    const room = roomManager.get(roomId);
    if (!room || room.game !== 'bunker' || !room.gameState) return;
    const gs = room.gameState;
    const io = fastify.io;

    const aliveSet = new Set(gs.alive || []);

    if (gs.phase === 'intro') {
      bunkerMarkPhase(gs, 'reveals');
      io.to(roomId).emit('bunker_update', {});
      bunkerScheduleNext(roomId, io, gs.phaseToken, gs.phaseDurationSec * 1000);
      return;
    }

    if (gs.phase === 'reveals') {
      bunkerMarkPhase(gs, 'discussion');
      io.to(roomId).emit('bunker_update', {});
      bunkerScheduleNext(roomId, io, gs.phaseToken, gs.phaseDurationSec * 1000);
      return;
    }

    if (gs.phase === 'discussion') {
      bunkerMarkPhase(gs, 'voting');
      gs.votes = {};
      gs.tieCandidates = null;
      io.to(roomId).emit('bunker_update', {});
      bunkerScheduleNext(roomId, io, gs.phaseToken, gs.phaseDurationSec * 1000);
      return;
    }

    if (gs.phase === 'voting') {
      // Resolve votes: highest count wins, tie -> tie_break phase.
      const counts = {};
      for (const [voterId, targetId] of Object.entries(gs.votes || {})) {
        if (!aliveSet.has(voterId)) continue;
        if (!aliveSet.has(targetId)) continue;
        if (targetId === voterId) continue;
        counts[targetId] = (counts[targetId] || 0) + 1;
      }

      const candidates = aliveSet.size ? [...aliveSet] : [];
      let max = -1;
      const winners = [];
      for (const id of candidates) {
        const c = counts[id] || 0;
        if (c > max) {
          max = c;
          winners.length = 0;
          winners.push(id);
        } else if (c === max) {
          winners.push(id);
        }
      }

      if (winners.length > 1) {
        gs.tieCandidates = winners;
        bunkerMarkPhase(gs, 'tie_break');
        io.to(roomId).emit('bunker_update', {});
        bunkerScheduleNext(roomId, io, gs.phaseToken, gs.phaseDurationSec * 1000);
        return;
      }

      const eliminatedId = winners[0] || null;
      if (eliminatedId) {
        gs.alive = (gs.alive || []).filter((id) => id !== eliminatedId);
        gs.eliminated = [...(gs.eliminated || []), { id: eliminatedId, by: 'vote', at: Date.now() }];
      }

      gs.roundIndex = (Number(gs.roundIndex) || 0) + 1;

      const maxRounds = Number(gs.maxRounds) || 1;
      const shouldEnd = gs.alive.length <= 1 || gs.roundIndex >= maxRounds;
      if (shouldEnd) {
        bunkerMarkPhase(gs, 'final');
        io.to(roomId).emit('bunker_update', {});
        bunkerScheduleNext(roomId, io, gs.phaseToken, gs.phaseDurationSec * 1000);
        return;
      }

      gs.currentCrisis = pickNextCrisis();
      gs.crisisHistory = [...(gs.crisisHistory || []), gs.currentCrisis ? { id: gs.currentCrisis.id, name: gs.currentCrisis.name, at: Date.now() } : null].filter(Boolean).slice(-20);
      bunkerMarkPhase(gs, 'round_event');
      io.to(roomId).emit('bunker_update', {});
      bunkerScheduleNext(roomId, io, gs.phaseToken, gs.phaseDurationSec * 1000);
      return;
    }

    if (gs.phase === 'tie_break') {
      const list = Array.isArray(gs.tieCandidates) ? gs.tieCandidates : [];
      const eliminatedId = list.length ? list[Math.floor(Math.random() * list.length)] : null;
      if (eliminatedId) {
        gs.alive = (gs.alive || []).filter((id) => id !== eliminatedId);
        gs.eliminated = [...(gs.eliminated || []), { id: eliminatedId, by: 'tie_break', at: Date.now() }];
      }
      gs.tieCandidates = null;

      gs.roundIndex = (Number(gs.roundIndex) || 0) + 1;

      const maxRounds = Number(gs.maxRounds) || 1;
      const shouldEnd = gs.alive.length <= 1 || gs.roundIndex >= maxRounds;
      if (shouldEnd) {
        bunkerMarkPhase(gs, 'final');
        io.to(roomId).emit('bunker_update', {});
        bunkerScheduleNext(roomId, io, gs.phaseToken, gs.phaseDurationSec * 1000);
        return;
      }

      gs.currentCrisis = pickNextCrisis();
      gs.crisisHistory = [...(gs.crisisHistory || []), gs.currentCrisis ? { id: gs.currentCrisis.id, name: gs.currentCrisis.name, at: Date.now() } : null].filter(Boolean).slice(-20);
      bunkerMarkPhase(gs, 'round_event');
      io.to(roomId).emit('bunker_update', {});
      bunkerScheduleNext(roomId, io, gs.phaseToken, gs.phaseDurationSec * 1000);
      return;
    }

    if (gs.phase === 'round_event') {
      bunkerMarkPhase(gs, 'voting');
      gs.votes = {};
      gs.tieCandidates = null;
      io.to(roomId).emit('bunker_update', {});
      bunkerScheduleNext(roomId, io, gs.phaseToken, gs.phaseDurationSec * 1000);
      return;
    }

    if (gs.phase === 'final') {
      roomManager.endGame(roomId);
      io.to(roomId).emit('game_ended');
      return;
    }

    return;
  }

  fastify.post('/rooms/bunker/start', async (request, reply) => {
    const { roomId, hostId, maxRounds, phaseTimers, scenarioId } = request.body || {};
    const room = roomManager.get(roomId);
    if (!room) return reply.code(404).send({ error: 'Комната не найдена' });
    if (room.hostId !== hostId) return reply.code(403).send(ERR.hostOnly);
    if (!room.players || room.players.length < 4) return reply.code(400).send({ error: 'Для Бункера нужно минимум 4 игрока' });
    const inv = room.playerInventories || {};
    const hostInv = inv[hostId] || {};
    if (!canUseBunkerScenario({ scenarioId, playerHasPro: Boolean(hostInv.hasPro), unlockedItems: hostInv.unlockedItems || [] })) {
      return reply.code(403).send({ error: 'Сценарий недоступен без Pro или нужного пака' });
    }

    const gs = createBunkerState(room, { maxRounds, phaseTimers, scenarioId });
    gs.characters = gs.characters || {};

    recordGameSession();
    roomManager.setGame(roomId, 'bunker');
    roomManager.setState(roomId, 'playing', gs);
    const io = fastify.io;
    // schedule intro phase completion
    bunkerClearTimeout(gs);
    const token = gs.phaseToken;
    gs.bunkerPhaseTimeoutId = setTimeout(() => bunkerOnPhaseTimeout(roomId, token), gs.phaseDurationSec * 1000);
    io.to(roomId).emit('game_start', { game: 'bunker' });
    io.to(roomId).emit('bunker_update', {});
    return { ok: true };
  });

  fastify.get('/rooms/:roomId/bunker/state', async (request, reply) => {
    const { roomId } = request.params;
    const playerId = request.query?.playerId;
    if (!playerId) return reply.code(400).send(ERR.playerIdRequired);
    const room = roomManager.get(roomId);
    if (!room || room.game !== 'bunker' || !room.gameState) return reply.code(404).send(ERR.gameNotFound);
    if (!room.players?.some((p) => p.id === playerId)) return reply.code(403).send(ERR.notInRoom);
    const gs = room.gameState;

    const now = Date.now();
    const phaseEndsAt = gs.phaseStartedAt != null && gs.phaseDurationSec != null ? gs.phaseStartedAt + gs.phaseDurationSec * 1000 : null;
    const phaseSecondsLeft = phaseEndsAt != null ? Math.max(0, Math.ceil((phaseEndsAt - now) / 1000)) : null;

    const getPlayerName = (id) => room.players.find((p) => p.id === id)?.name || id;
    const alive = (gs.alive || []).map((id) => ({ id, name: getPlayerName(id) }));

    const showPublicCharacters = ['reveals', 'discussion', 'voting', 'tie_break', 'round_event', 'final'].includes(gs.phase);
    const publicCharacters = {};
    if (showPublicCharacters && gs.characters) {
      for (const pid of Object.keys(gs.characters)) {
        if (!(gs.alive || []).includes(pid)) continue;
        const ch = gs.characters[pid] || {};
        publicCharacters[pid] = {
          profession: ch.profession || null,
          skill: ch.skill || null,
          phobia: ch.phobia || null,
          baggage: ch.baggage || null,
        };
      }
    }

    const voteCounts = {};
    for (const targetId of Object.values(gs.votes || {})) {
      if (!alive.find((p) => p.id === targetId)) continue;
      voteCounts[targetId] = (voteCounts[targetId] || 0) + 1;
    }

    const eliminatedLog = (gs.eliminated || [])
      .map((e) => ({
        id: e?.id || null,
        name: getPlayerName(e?.id),
        by: e?.by || null, // 'vote' | 'tie_break'
        at: e?.at || null,
      }))
      .filter((e) => e.id)
      .sort((a, b) => (b.at || 0) - (a.at || 0))
      .slice(0, 10);

    return {
      phase: gs.phase,
      phaseSecondsLeft,
      phaseStartedAt: gs.phaseStartedAt ?? null,
      phaseDurationSec: gs.phaseDurationSec ?? null,
      phaseEndsAt,
      roundIndex: gs.roundIndex ?? 0,
      maxRounds: gs.maxRounds ?? null,
      scenario: BUNKER_SCENARIOS.find((s) => s.id === gs.scenarioId) || null,
      startedAt: gs.phaseStartedAt ?? null,
      totalPlayers: Array.isArray(gs.playerOrder) ? gs.playerOrder.length : room.players.length,
      alive,
      currentCrisis: gs.currentCrisis || null,
      crisisHistory: Array.isArray(gs.crisisHistory) ? gs.crisisHistory.slice(-8) : [],
      myCharacter: gs.characters?.[playerId] || null,
      publicCharacters,
      votes: gs.votes || {},
      voteCounts,
      tieCandidates: gs.tieCandidates || null,
      eliminatedLog,
      myEliminatedAt: (gs.eliminated || []).find((e) => e?.id === playerId)?.at || null,
    };
  });

  fastify.post('/rooms/:roomId/bunker/vote', async (request, reply) => {
    const { roomId } = request.params;
    const { playerId, targetId } = request.body || {};
    if (!playerId) return reply.code(400).send(ERR.playerIdRequired);
    if (!targetId) return reply.code(400).send({ error: 'Нужен targetId' });
    if (!allowAction(`bunker:vote:${roomId}:${playerId}`, 20, 8000)) {
      return reply.code(429).send(ERR.tooMany);
    }

    const room = roomManager.get(roomId);
    if (!room || room.game !== 'bunker' || !room.gameState) return reply.code(404).send(ERR.gameNotFound);
    const gs = room.gameState;
    if (gs.phase !== 'voting') return reply.code(400).send(ERR.notVotingPhase);
    if (!Array.isArray(gs.alive) || !gs.alive.includes(playerId)) return reply.code(403).send({ error: 'Вы не живы' });
    if (!gs.alive.includes(targetId) || targetId === playerId) return reply.code(400).send({ error: 'Неверная цель' });

    gs.votes = gs.votes || {};
    if (gs.votes[playerId] === targetId) return { ok: true };
    gs.votes[playerId] = targetId;
    fastify.io.to(roomId).emit('bunker_update', {});
    return { ok: true };
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
    const playerStats = gs.playerStats && typeof gs.playerStats === 'object' ? gs.playerStats : {};
    const mvp = playersToMvp(playerStats, room.players);
    return {
      teams: gs.teams.map((t) => ({ name: t.name, score: t.score, playerIds: t.players })),
      currentTeamIndex: gs.currentTeamIndex,
      currentExplainerIndex: gs.currentExplainerIndex,
      awaitingExplainerStart: Boolean(gs.awaitingExplainerStart),
      word: isExplainer && !gs.awaitingExplainerStart ? gs.currentWord : null,
      roundEndsAt: gs.roundEndsAt,
      timerSeconds: gs.timerSeconds,
      scoreLimit: gs.scoreLimit,
      skipPenalty: gs.skipPenalty ?? 1,
      winner: gs.winner,
      myTeamIndex: teamIndex,
      isExplainer,
      isCurrentExplainer: playerId === explainerId,
      currentExplainerId: explainerId,
      explainerName: explainer?.name || 'Игрок',
      playerStats,
      mvp,
    };
  });

  function eliasNextWord(roomId, io) {
    const room = roomManager.get(roomId);
    if (!room || room.game !== 'elias' || !room.gameState) return;
    const gs = room.gameState;
    if (gs.winner) return;
    if (gs.awaitingExplainerStart) return;
    gs.currentWord = pickEliasWord(gs);
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
    gs.currentWord = null;
    gs.awaitingExplainerStart = true;
    gs.lastGuessedWord = null;
    gs.lastSkippedWord = null;
    gs.roundEndsAt = null;
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

  function playersToMvp(playerStats, roomPlayers) {
    let bestId = null;
    let bestScore = -Infinity;
    for (const [id, st] of Object.entries(playerStats || {})) {
      const guessed = Number(st?.guessed) || 0;
      const skipped = Number(st?.skipped) || 0;
      const score = guessed - skipped;
      if (score > bestScore) {
        bestScore = score;
        bestId = id;
      }
    }
    if (!bestId) return null;
    const p = (roomPlayers || []).find((x) => x.id === bestId);
    const raw = playerStats?.[bestId] || {};
    return {
      id: bestId,
      name: p?.name || 'Игрок',
      guessed: Number(raw.guessed) || 0,
      skipped: Number(raw.skipped) || 0,
      value: (Number(raw.guessed) || 0) - (Number(raw.skipped) || 0),
    };
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
    if (gs.awaitingExplainerStart || gs.currentWord == null) {
      return reply.code(400).send({ error: 'Раунд ещё не начат' });
    }
    if (gs.lastGuessedWord === gs.currentWord) return { ok: true, already: true };
    gs.lastGuessedWord = gs.currentWord;
    team.score = (team.score || 0) + 1;
    const stats = gs.playerStats?.[playerId] || { guessed: 0, skipped: 0 };
    stats.guessed = (stats.guessed || 0) + 1;
    if (gs.playerStats) gs.playerStats[playerId] = stats;
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
    if (gs.awaitingExplainerStart || gs.currentWord == null) {
      return reply.code(400).send({ error: 'Раунд ещё не начат' });
    }
    if (gs.lastSkippedWord === gs.currentWord) return { ok: true, already: true };
    gs.lastSkippedWord = gs.currentWord;
    const stats = gs.playerStats?.[playerId] || { guessed: 0, skipped: 0 };
    stats.skipped = (stats.skipped || 0) + 1;
    if (gs.playerStats) gs.playerStats[playerId] = stats;
    const penalty = Math.min(3, Math.max(0, Number(gs.skipPenalty) || 0));
    if (penalty > 0) team.score = Math.max(0, (team.score || 0) - penalty);
    eliasNextWord(roomId, fastify.io);
    return { ok: true, score: team.score };
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

  fastify.post('/rooms/:roomId/elias/begin-round', async (request, reply) => {
    const { roomId } = request.params;
    const { playerId } = request.body || {};
    if (!playerId) return reply.code(400).send({ error: 'Нужен playerId' });
    if (!allowAction(`elias:begin:${roomId}:${playerId}`, 10, 5000)) {
      return reply.code(429).send(ERR.tooMany);
    }
    const room = roomManager.get(roomId);
    if (!room || room.game !== 'elias' || !room.gameState) return reply.code(404).send({ error: 'Игра не найдена' });
    const gs = room.gameState;
    if (gs.winner != null) return reply.code(400).send({ error: 'Игра уже завершена' });
    if (!gs.awaitingExplainerStart) return { ok: true, already: true };
    const team = gs.teams[gs.currentTeamIndex];
    const explainerId = team?.players?.length
      ? team.players[gs.currentExplainerIndex % team.players.length]
      : null;
    if (playerId !== explainerId) {
      return reply.code(403).send({ error: 'Начать раунд может только текущий объясняющий' });
    }
    gs.currentWord = pickEliasWord(gs);
    gs.awaitingExplainerStart = false;
    gs.lastGuessedWord = null;
    gs.lastSkippedWord = null;
    gs.roundEndsAt = Date.now() + (Number(gs.timerSeconds) || 60) * 1000;
    fastify.io.to(roomId).emit('elias_timer_start', { roundEndsAt: gs.roundEndsAt });
    fastify.io.to(roomId).emit('elias_update', {});
    return { ok: true, roundEndsAt: gs.roundEndsAt };
  });

  fastify.patch('/rooms/:roomId/players/me', async (request, reply) => {
    const { roomId } = request.params;
    const { playerId, inventory, photo_url, avatar_emoji } = request.body || {};
    const room = roomManager.get(roomId);
    if (!room) return reply.code(404).send({ error: 'Room not found' });
    if (!room.players.some((p) => p.id === playerId)) return reply.code(403).send({ error: 'Not in room' });
    const inv = inventory && typeof inventory === 'object'
      ? {
        dictionaries: Array.isArray(inventory.dictionaries) ? inventory.dictionaries : ['free'],
        unlockedItems: Array.isArray(inventory.unlockedItems) ? inventory.unlockedItems.map(String) : [],
        hasPro: Boolean(inventory.hasPro),
      }
      : { dictionaries: ['free'], unlockedItems: [], hasPro: false };
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
