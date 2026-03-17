import { getStats, checkAdminPassword } from './statsManager.js';
import { createPromocode, redeemPromocode } from './promocodes.js';

export async function adminRoutes(fastify) {
  fastify.post('/admin/stats', async (request, reply) => {
    const { password } = request.body || {};
    if (!checkAdminPassword(password)) {
      return reply.code(403).send({ error: 'Invalid password' });
    }
    return getStats();
  });

  fastify.post('/admin/promocode', async (request, reply) => {
    const { password, type } = request.body || {};
    if (!checkAdminPassword(password)) {
      return reply.code(403).send({ error: 'Invalid password' });
    }
    const t = type === 'week' || type === 'month' ? type : 'day';
    const { code, expiresAt } = createPromocode(t);
    return { code, expiresAt };
  });

  fastify.post('/promocode/redeem', async (request, reply) => {
    const { code } = request.body || {};
    if (!code) return reply.code(400).send({ error: 'code required' });
    const result = redeemPromocode(code);
    if (!result) return reply.code(400).send({ error: 'Invalid or expired code' });
    return result;
  });
}
