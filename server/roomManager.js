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
  create(hostId, hostName = 'Хост') {
    const roomId = crypto.randomUUID();
    const code = generateCode();
    const inviteToken = generateInviteToken();
    const room = {
      id: roomId,
      hostId,
      code,
      inviteToken,
      players: [{ id: hostId, name: hostName, isHost: true }],
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

  join(roomId, playerId, playerName) {
    const room = rooms.get(roomId);
    if (!room) return null;
    if (room.players.some((p) => p.id === playerId)) return room;
    room.players.push({ id: playerId, name: playerName, isHost: false });
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

  leave(roomId, playerId) {
    const room = rooms.get(roomId);
    if (!room) return;
    room.players = room.players.filter((p) => p.id !== playerId);
    delete room.playerSockets[playerId];
    if (room.players.length === 0) {
      rooms.delete(roomId);
      codes.delete(room.code);
      inviteTokens.delete(room.inviteToken);
    } else if (room.hostId === playerId) {
      room.hostId = room.players[0].id;
      room.players[0].isHost = true;
    }
  },

  toSafe(room) {
    if (!room) return null;
    const { gameState, playerSockets, ...rest } = room;
    return { ...rest, players: room.players };
  },
};
