import { customAlphabet } from 'nanoid';
import { SPY_PREMIUM_IDS } from './words.js';
import { assignPlayerIdsToTeams } from './partyTeamAssign.js';

function syncTruthDareTurnOrder(room) {
  if (!room || room.state !== 'lobby') return;
  if (room.selectedGame !== 'truth_dare') return;
  const gs = room.gameSettings || {};
  const playerIds = room.players.map((p) => String(p.id));
  let order = Array.isArray(gs.truthDareTurnOrder) ? gs.truthDareTurnOrder.map(String) : [];
  order = order.filter((id) => playerIds.includes(id));
  const seen = new Set(order);
  for (const id of playerIds) {
    if (!seen.has(id)) {
      order.push(id);
      seen.add(id);
    }
  }
  const prev = JSON.stringify(gs.truthDareTurnOrder || []);
  const next = JSON.stringify(order);
  if (prev !== next) {
    room.gameSettings = { ...gs, truthDareTurnOrder: order };
  }
}

/** Только Элиас: автокоманды по составу лобби */
function syncPartyTeams(room) {
  if (!room || room.state !== 'lobby') return;
  if (room.selectedGame !== 'elias') return;
  const gs = room.gameSettings;
  if (!gs) return;
  const teams = gs.eliasTeams;
  if (!Array.isArray(teams) || teams.length < 2) return;
  const playerIds = room.players.map((p) => p.id);
  const assigned = assignPlayerIdsToTeams(playerIds, teams.length);
  if (!assigned) return;
  teams.forEach((t, i) => {
    t.playerIds = assigned[i] || [];
  });
  let wins = Array.isArray(gs.eliasLobbyWins) ? [...gs.eliasLobbyWins] : [];
  while (wins.length < teams.length) wins.push(0);
  if (wins.length > teams.length) wins = wins.slice(0, teams.length);
  gs.eliasLobbyWins = wins;
}

/** После PATCH лобби: Элиас — синхрон команд; П/Д — порядок ходов */
function maybeSyncPartyTeamsAfterLobbyPatch(room) {
  if (!room || room.state !== 'lobby') return;
  const sg = room.selectedGame;
  if (sg === 'truth_dare') {
    syncTruthDareTurnOrder(room);
    return;
  }
  if (sg !== 'elias') return;
  const gs = room.gameSettings;
  if (!gs) return;
  const teams = gs.eliasTeams;
  if (!Array.isArray(teams) || teams.length < 2) return;
  const playerIds = room.players.map((p) => p.id);
  const pidSet = new Set(playerIds.map(String));
  const assigned = new Set();
  let total = 0;
  teams.forEach((t) => {
    (t.playerIds || []).forEach((id) => {
      assigned.add(String(id));
      total += 1;
    });
  });
  if (total === 0 && playerIds.length >= 1) {
    syncPartyTeams(room);
    return;
  }
  if (pidSet.size !== assigned.size) {
    syncPartyTeams(room);
    return;
  }
  for (const pid of playerIds) {
    if (!assigned.has(String(pid))) {
      syncPartyTeams(room);
      return;
    }
  }
}

const alphabet = '0123456789';
const codeGen = customAlphabet(alphabet, 6);

const rooms = new Map();
const codes = new Map();
const inviteTokens = new Map();
const ADJ = ['Веселые', 'Летучие', 'Танцующие', 'Сонные', 'Пьяные', 'Мохнатые', 'Шумные', 'Добрые'];
const NOUN = ['Плясуны', 'Барабашки', 'Финтиплюшки', 'Крендельки', 'Карасики', 'Хохотуны', 'Скворечники', 'Булочки'];

function generateCode() {
  let code;
  do {
    code = codeGen();
  } while (codes.has(code));
  return code;
}

function generateInviteToken() {
  const token = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
  return inviteTokens.has(token) ? generateInviteToken() : token;
}

function generateRoomName() {
  const a = ADJ[Math.floor(Math.random() * ADJ.length)];
  const b = NOUN[Math.floor(Math.random() * NOUN.length)];
  return `${a} ${b}`;
}

export const roomManager = {
  create(hostId, hostName = 'Хост', hostPhotoUrl = null, hostHasPro = false, hostAvatarEmoji = null) {
    const roomId = crypto.randomUUID();
    const code = generateCode();
    const inviteToken = generateInviteToken();
    const hid = String(hostId);
    const room = {
      id: roomId,
      hostId: hid,
      code,
      inviteToken,
      name: generateRoomName(),
      players: [{ id: hid, name: hostName, isHost: true, photo_url: hostPhotoUrl || null, avatar_emoji: hostAvatarEmoji || null }],
      playerInventories: { [hid]: { dictionaries: ['free'], hasPro: false } },
      selectedGame: null,
      gameSettings: null,
      game: null,
      state: 'lobby',
      gameState: null,
      playerSockets: {},
    };
    rooms.set(roomId, room);
    codes.set(code, roomId);
    inviteTokens.set(inviteToken, roomId);
    return room;
  },

  get(roomId) {
    return rooms.get(roomId) || null;
  },

  getByCode(code) {
    const roomId = codes.get(code);
    return roomId ? rooms.get(roomId) : null;
  },

  getByInviteToken(token) {
    const roomId = inviteTokens.get(token);
    return roomId ? rooms.get(roomId) : null;
  },

  join(roomId, playerId, playerName, inventory = null, photoUrl = null, avatarEmoji = null) {
    const room = rooms.get(roomId);
    if (!room) return null;
    const pid = String(playerId);
    const existing = room.players.find((p) => String(p.id) === pid);
    if (existing) {
      if (inventory && room.playerInventories) room.playerInventories[pid] = inventory;
      if (playerName && String(playerName).trim()) existing.name = String(playerName).trim();
      if (photoUrl !== undefined) existing.photo_url = photoUrl || null;
      if (avatarEmoji !== undefined) existing.avatar_emoji = avatarEmoji || null;
      return room;
    }
    room.players.push({ id: pid, name: playerName || 'Игрок', isHost: false, photo_url: photoUrl || null, avatar_emoji: avatarEmoji || null });
    if (!room.playerInventories) room.playerInventories = {};
    room.playerInventories[pid] = inventory || { dictionaries: ['free'], hasPro: false };
    syncPartyTeams(room);
    syncTruthDareTurnOrder(room);
    return room;
  },

  setPlayerSocket(roomId, playerId, socketId) {
    const room = rooms.get(roomId);
    if (!room) return;
    const pid = String(playerId);
    room.playerSockets[pid] = socketId;
  },

  setGame(roomId, game) {
    const room = rooms.get(roomId);
    if (!room) return null;
    room.game = game;
    if (game) room.lastGameResult = null;
    return room;
  },

  setState(roomId, state, gameState = null) {
    const room = rooms.get(roomId);
    if (!room) return null;
    room.state = state;
    room.gameState = gameState;
    return room;
  },

  getGameState(roomId) {
    const room = rooms.get(roomId);
    return room?.gameState || null;
  },

  updateGameState(roomId, patch) {
    const room = rooms.get(roomId);
    if (!room || !room.gameState) return null;
    Object.assign(room.gameState, patch);
    return room;
  },

  endGame(roomId, opts = {}) {
    const room = rooms.get(roomId);
    if (!room) return null;
    if (opts.lastGameResult) {
      room.lastGameResult = { ...opts.lastGameResult, at: Date.now() };
    }
    room.game = null;
    room.state = 'lobby';
    room.gameState = null;
    return room;
  },

  setRoomName(roomId, name) {
    const room = rooms.get(roomId);
    if (!room) return null;
    room.name = (name && String(name).trim()) || 'Лобби';
    return room;
  },

  setPlayerInventory(roomId, playerId, inventory, photoUrl = null, avatarEmoji = null) {
    const room = rooms.get(roomId);
    if (!room) return null;
    if (!room.playerInventories) room.playerInventories = {};
    const pid = String(playerId);
    room.playerInventories[pid] = inventory;
    const p = room.players.find((x) => String(x.id) === pid);
    if (p) {
      if (photoUrl !== undefined) p.photo_url = photoUrl || null;
      if (avatarEmoji !== undefined) p.avatar_emoji = avatarEmoji || null;
    }
    return room;
  },

  setLobbyGame(roomId, hostId, selectedGame, gameSettings) {
    const room = rooms.get(roomId);
    if (!room || String(room.hostId) !== String(hostId)) return null;
    room.selectedGame = selectedGame || null;
    if (gameSettings !== undefined) room.gameSettings = gameSettings;
    maybeSyncPartyTeamsAfterLobbyPatch(room);
    return room;
  },

  leave(roomId, playerId) {
    const room = rooms.get(roomId);
    if (!room) return null;
    const pid = String(playerId);
    const wasHost = String(room.hostId) === pid;
    room.players = room.players.filter((p) => String(p.id) !== pid);
    if (room.playerInventories) delete room.playerInventories[pid];
    delete room.playerSockets[pid];
    if (room.players.length === 0) {
      rooms.delete(roomId);
      codes.delete(room.code);
      inviteTokens.delete(room.inviteToken);
      return null;
    }
    syncPartyTeams(room);
    syncTruthDareTurnOrder(room);
    room.players.forEach((p) => { p.isHost = false; });
    if (wasHost) {
      const idx = Math.floor(Math.random() * room.players.length);
      room.hostId = String(room.players[idx].id);
      room.players[idx].isHost = true;
    }
    return room;
  },

  kick(roomId, hostId, playerIdToKick) {
    const room = rooms.get(roomId);
    if (!room || String(room.hostId) !== String(hostId)) return null;
    if (String(playerIdToKick) === String(hostId)) return null;
    if (!room.players.some((p) => String(p.id) === String(playerIdToKick))) return null;
    const socketId = room.playerSockets?.[String(playerIdToKick)] || null;
    return { socketId };
  },

  /** Передача хоста добровольно (текущий хост → другой игрок в комнате). */
  transferHost(roomId, currentHostId, newHostId) {
    const room = rooms.get(roomId);
    if (!room || String(room.hostId) !== String(currentHostId)) return null;
    if (String(newHostId) === String(currentHostId)) return room;
    if (!room.players.some((p) => String(p.id) === String(newHostId))) return null;
    room.players.forEach((p) => { p.isHost = false; });
    room.hostId = String(newHostId);
    const np = room.players.find((p) => String(p.id) === String(newHostId));
    if (np) np.isHost = true;
    return room;
  },

  /**
   * Хост отключил сокет — передать права другому игроку (предпочтительно онлайн).
   * Вызывается при disconnect текущего hostId.
   */
  transferHostAfterHostDisconnect(roomId, disconnectedHostId) {
    const room = rooms.get(roomId);
    if (!room || String(room.hostId) !== String(disconnectedHostId)) return room;
    const others = room.players.filter((p) => String(p.id) !== String(disconnectedHostId));
    if (!others.length) return room;
    const online = others.find((p) => room.playerSockets?.[String(p.id)]);
    const next = online || others[0];
    room.players.forEach((p) => { p.isHost = false; });
    room.hostId = String(next.id);
    next.isHost = true;
    return room;
  },

  toSafe(room) {
    if (!room) return null;
    const { gameState, playerSockets, playerInventories, ...rest } = room;
    const inv = room.playerInventories || {};
    const allDicts = new Set(['free']);
    let anyPro = false;
    for (const p of room.players || []) {
      const invP = inv[p.id];
      if (invP) {
        if (invP.dictionaries) invP.dictionaries.forEach((d) => allDicts.add(d));
        if (invP.hasPro) anyPro = true;
      }
    }
    const availableDictionaries = ['free'];
    if (anyPro) SPY_PREMIUM_IDS.forEach((id) => availableDictionaries.push(id));
    for (const d of allDicts) if (d !== 'free' && !availableDictionaries.includes(d)) availableDictionaries.push(d);
    const allSpyDictionaryIds = ['free', ...SPY_PREMIUM_IDS];
    const availableEliasDictionaries = ['basic', 'animals', 'memes'];
    if (anyPro) availableEliasDictionaries.push('movies', 'science', 'sport', 'travel', 'food', 'kids');
    const sockets = room.playerSockets || {};
    const players = (room.players || []).map((p) => ({
      ...p,
      hasPro: Boolean(inv[p.id]?.hasPro),
      online: Boolean(sockets[p.id]),
    }));
    return { ...rest, players, availableDictionaries, allSpyDictionaryIds, availableEliasDictionaries };
  },
};
