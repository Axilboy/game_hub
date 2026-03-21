import { appendFeedback, readAllFeedback } from './feedbackStore.js';
import { checkAdminPassword } from './statsManager.js';

const ipHits = new Map();

function rateLimitOk(ip) {
  const now = Date.now();
  const windowMs = 60 * 60 * 1000;
  const max = 30;
  const arr = ipHits.get(ip) || [];
  const recent = arr.filter((t) => now - t < windowMs);
  if (recent.length >= max) return false;
  recent.push(now);
  ipHits.set(ip, recent);
  return true;
}

export async function feedbackRoutes(fastify) {
  fastify.post('/feedback', async (request, reply) => {
    const ip = request.ip || request.socket?.remoteAddress || 'unknown';
    if (!rateLimitOk(ip)) {
      return reply.code(429).send({ error: 'Слишком много сообщений. Попробуйте позже.' });
    }
    const { message, contact, playerId, displayName } = request.body || {};
    const text = String(message || '').trim();
    if (text.length < 3) {
      return reply.code(400).send({ error: 'Напишите хотя бы пару слов.' });
    }
    if (text.length > 4000) {
      return reply.code(400).send({ error: 'Сообщение слишком длинное.' });
    }
    await appendFeedback({
      message: text,
      contact: String(contact || '').trim().slice(0, 240),
      playerId: playerId != null ? String(playerId).slice(0, 80) : '',
      displayName: String(displayName || '').trim().slice(0, 120),
      ip: String(ip).slice(0, 64),
      userAgent: String(request.headers['user-agent'] || '').slice(0, 400),
    });
    return { ok: true };
  });

  fastify.post('/admin/feedback/list', async (request, reply) => {
    const { password } = request.body || {};
    if (!checkAdminPassword(password)) {
      return reply.code(403).send({ error: 'Invalid password' });
    }
    const items = await readAllFeedback();
    return { items, count: items.length };
  });

  fastify.post('/admin/feedback/export', async (request, reply) => {
    const { password } = request.body || {};
    if (!checkAdminPassword(password)) {
      return reply.code(403).send({ error: 'Invalid password' });
    }
    const items = await readAllFeedback();
    const json = JSON.stringify(items, null, 2);
    reply.header('Content-Type', 'application/json; charset=utf-8');
    reply.header('Content-Disposition', 'attachment; filename="gamehub-feedback.json"');
    return reply.send(json);
  });
}
