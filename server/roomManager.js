import { customAlphabet } from 'nanoid';

const alphabet = '0123456789';
const codeGen = customAlphabet(alphabet, 6);

const rooms = new Map();
const codes = new Map();
const inviteTokens = new Map();

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

export const roomManager = {
  create(hostId, hostName = 'Хост', hostPhotoUrl = null, hostHasPro = false, hostAvatarEmoji = null) {
    const roomId = crypto.randomUUID();
    const code = generateCode();
    const inviteToken = generateInviteToken();
    const room = {
      id: roomId,
      hostId,
      code,
      inviteToken,
      name: 'Лобби',
      players: [{ id: hostId, name: hostName, isHost: true, photo_url: hostPhotoUrl || null, avatar_emoji: hostAvatarEmoji || null }],
      playerInventories: { [hostId]: { dictionaries: ['free'], hasPro: false } },
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
    if (room.players.some((p) => p.id === playerId)) {
      if (inventory && room.playerInventories) room.playerInventories[playerId] = inventory;
      const p = room.players.find((x) => x.id === playerId);
      if (p) {
        if (photoUrl !== undefined) p.photo_url = photoUrl || null;
        if (avatarEmoji !== undefined) p.avatar_emoji = avatarEmoji || null;
      }
      return room;
    }
    room.players.push({ id: playerId, name: playerName, isHost: false, photo_url: photoUrl || null, avatar_emoji: avatarEmoji || null });
    if (!room.playerInventories) room.playerInventories = {};
    room.playerInventories[playerId] = inventory || { dictionaries: ['free'], hasPro: false };
    return room;
  },

  setPlayerSocket(roomId, playerId, socketId) {
    const room = rooms.get(roomId);
    if (!room) return;
    room.playerSockets[playerId] = socketId;
  },

  setGame(roomId, game) {
    const room = rooms.get(roomId);
    if (!room) return null;
    room.game = game;
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

  endGame(roomId) {
    const room = rooms.get(roomId);
    if (!room) return null;
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
    room.playerInventories[playerId] = inventory;
    const p = room.players.find((x) => x.id === playerId);
    if (p) {
      if (photoUrl !== undefined) p.photo_url = photoUrl || null;
      if (avatarEmoji !== undefined) p.avatar_emoji = avatarEmoji || null;
    }
    return room;
  },

  setLobbyGame(roomId, hostId, selectedGame, gameSettings) {
    const room = rooms.get(roomId);
    if (!room || room.hostId !== hostId) return null;
    room.selectedGame = selectedGame || null;
    if (gameSettings !== undefined) room.gameSettings = gameSettings;
    return room;
  },

  leave(roomId, playerId) {
    const room = rooms.get(roomId);
    if (!room) return null;
    const wasHost = room.hostId === playerId;
    room.players = room.players.filter((p) => p.id !== playerId);
    if (room.playerInventories) delete room.playerInventories[playerId];
    delete room.playerSockets[playerId];
    if (room.players.length === 0) {
      rooms.delete(roomId);
      codes.delete(room.code);
      inviteTokens.delete(room.inviteToken);
      return null;
    }
    room.players.forEach((p) => { p.isHost = false; });
    if (wasHost) {
      const idx = Math.floor(Math.random() * room.players.length);
      room.hostId = room.players[idx].id;
      room.players[idx].isHost = true;
    }
    return room;
  },

  kick(roomId, hostId, playerIdToKick) {
    const room = rooms.get(roomId);
    if (!room || room.hostId !== hostId) return null;
    if (playerIdToKick === hostId) return null;
    const socketId = room.playerSockets?.[playerIdToKick];
    return socketId ? { socketId } : null;
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
    if (anyPro) availableDictionaries.push('theme1', 'theme2');
    for (const d of allDicts) if (d !== 'free' && !availableDictionaries.includes(d)) availableDictionaries.push(d);
    const players = (room.players || []).map((p) => ({ ...p, hasPro: Boolean(inv[p.id]?.hasPro) }));
    return { ...rest, players, availableDictionaries };
  },
};
