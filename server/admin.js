import { getStats, getPublicStats, checkAdminPassword, recordWebAnalytics } from './statsManager.js';
import { createPromocode, redeemPromocode } from './promocodes.js';

const ADMIN_STATS_CACHE_TTL_MS = 3000;
let adminStatsCache = { ts: 0, value: null };

export async function adminRoutes(fastify) {
  fastify.get('/stats/public', async () => getPublicStats());

  fastify.post('/analytics/track', async (request, reply) => {
    const body = request.body || {};
    const type = String(body.type || '').trim();
    if (!['session_start', 'page_view', 'page_dwell'].includes(type)) {
      return reply.code(400).send({ error: 'Invalid analytics event type' });
    }
    recordWebAnalytics({
      type,
      visitorId: body.visitorId,
      path: body.path,
      dwellMs: body.dwellMs,
      sourceType: body.sourceType,
      sourceName: body.sourceName,
      utmCampaign: body.utmCampaign,
    });
    return { ok: true };
  });

  fastify.post('/admin/stats', async (request, reply) => {
    const { password } = request.body || {};
    if (!checkAdminPassword(password)) {
      return reply.code(403).send({ error: 'Invalid password' });
    }
    const now = Date.now();
    if (adminStatsCache.value && now - adminStatsCache.ts < ADMIN_STATS_CACHE_TTL_MS) {
      return adminStatsCache.value;
    }
    const stats = getStats();
    adminStatsCache = { ts: now, value: stats };
    return stats;
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
