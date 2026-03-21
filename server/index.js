import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import { roomRoutes } from './rooms.js';
import { adminRoutes } from './admin.js';
import { feedbackRoutes } from './feedbackRoutes.js';
import { friendsRoutes } from './friendsRoutes.js';
import { roomManager } from './roomManager.js';
import { buildRobotsTxt, buildSitemapXml } from '../seo/sitemapConfig.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || '3000', 10);
const publicDir = path.join(__dirname, 'public');

const BUILD_TAG = process.env.BUILD_TAG || process.env.RAILWAY_GIT_COMMIT_SHA || 'dev';

const fastify = Fastify({ logger: true });

fastify.setErrorHandler((err, request, reply) => {
  request.log.error({ err, url: request.url, build: BUILD_TAG }, 'request_error');
  if (reply.sent) return;
  const status = err.statusCode && err.statusCode >= 400 && err.statusCode < 600 ? err.statusCode : 500;
  reply.code(status).send({
    error: status === 500 ? 'Внутренняя ошибка сервера' : (err.message || 'Ошибка'),
    build: BUILD_TAG,
  });
});

await fastify.register(cors, { origin: true });
// Decorators MUST be added before fastify starts/listens
fastify.decorate('io', null);
fastify.register(roomRoutes, { prefix: '/api' });
fastify.register(adminRoutes, { prefix: '/api' });
fastify.register(feedbackRoutes, { prefix: '/api' });
fastify.register(friendsRoutes, { prefix: '/api' });

fastify.get('/robots.txt', async (request, reply) => {
  const proto = request.headers['x-forwarded-proto'] || request.protocol || 'http';
  const origin = process.env.BASE_URL || process.env.VITE_BASE_URL || `${proto}://${request.hostname}`;
  reply.type('text/plain; charset=utf-8').send(buildRobotsTxt(origin));
});

fastify.get('/sitemap.xml', async (request, reply) => {
  const proto = request.headers['x-forwarded-proto'] || request.protocol || 'http';
  const origin = process.env.BASE_URL || process.env.VITE_BASE_URL || `${proto}://${request.hostname}`;
  const lastmod = new Date().toISOString().slice(0, 10);
  reply.type('application/xml; charset=utf-8').send(buildSitemapXml(origin, lastmod));
});

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
      if (!roomBefore || !roomBefore.players?.some((p) => p.id === player.id)) {
        return;
      }
      roomManager.setPlayerSocket(roomId, player.id, null);
      const wasHost = roomBefore.hostId === player.id;
      let newHostId = null;
      if (wasHost) {
        const after = roomManager.transferHostAfterHostDisconnect(roomId, player.id);
        if (after && after.hostId !== player.id) {
          newHostId = after.hostId;
        }
      }
      socket.to(roomId).emit('player_offline', { playerId: player.id });
      if (newHostId) {
        io.to(roomId).emit('host_changed', { hostId: newHostId });
        io.to(roomId).emit('room_updated');
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
