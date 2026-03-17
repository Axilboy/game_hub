import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import { roomRoutes } from './rooms.js';
import { adminRoutes } from './admin.js';
import { roomManager } from './roomManager.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || '3000', 10);
const publicDir = path.join(__dirname, 'public');

const fastify = Fastify({ logger: true });
await fastify.register(cors, { origin: true });
// Decorators MUST be added before fastify starts/listens
fastify.decorate('io', null);
fastify.register(roomRoutes, { prefix: '/api' });
fastify.register(adminRoutes, { prefix: '/api' });

if (existsSync(publicDir)) {
  await fastify.register(fastifyStatic, { root: publicDir });
  fastify.setNotFoundHandler((request, reply) => {
    if (request.method === 'GET' && !request.url.startsWith('/api') && !request.url.startsWith('/socket.io')) {
      return reply.sendFile('index.html');
    }
    return reply.code(404).send({ error: 'Not found' });
  });
}

async function start() {
  await fastify.listen({ port: PORT, host: '0.0.0.0' });
  const io = new Server(fastify.server, {
    cors: { origin: process.env.BASE_URL || '*', credentials: true },
    transports: ['websocket', 'polling'],
  });

  io.on('connection', (socket) => {
    const roomId = socket.handshake.auth?.roomId;
    const player = socket.handshake.auth?.player;
    if (!roomId || !player?.id) {
      socket.disconnect(true);
      return;
    }
    const room = roomManager.get(roomId);
    if (!room) {
      socket.disconnect(true);
      return;
    }
    socket.join(roomId);
    roomManager.setPlayerSocket(roomId, player.id, socket.id);
    socket.to(roomId).emit('player_joined', { player });
    socket.on('disconnect', () => {
      const roomBefore = roomManager.get(roomId);
      const wasHost = roomBefore?.hostId === player.id;
      roomManager.setPlayerSocket(roomId, player.id, null);
      const leftRoom = roomManager.leave(roomId, player.id);
      socket.to(roomId).emit('player_left', { playerId: player.id });
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
    });
  });

  // Assign to existing decorator (can't decorate after start)
  fastify.io = io;
  console.log(`Server and WebSocket on http://0.0.0.0:${PORT}`);
}

start().catch((err) => {
  fastify.log.error(err);
  process.exit(1);
});
