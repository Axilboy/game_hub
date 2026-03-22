import { signJwt, verifyJwt, getBearerToken } from './authCore.js';
import { createAccount, verifyAccountLogin, findAccountById } from './authStore.js';

export async function authRoutes(fastify) {
  fastify.post('/auth/register', async (request, reply) => {
    const { email, password, displayName } = request.body || {};
    const r = createAccount({ email, password, displayName });
    if (!r.ok) return reply.code(400).send({ error: r.error || 'Ошибка регистрации' });
    const acc = r.account;
    const token = signJwt({ sub: acc.id, email: acc.email });
    return {
      token,
      user: {
        id: acc.id,
        email: acc.email,
        first_name: acc.displayName,
      },
    };
  });

  fastify.post('/auth/login', async (request, reply) => {
    const { email, password } = request.body || {};
    const r = verifyAccountLogin(email, password);
    if (!r.ok) return reply.code(401).send({ error: r.error || 'Ошибка входа' });
    const acc = r.account;
    const token = signJwt({ sub: acc.id, email: acc.email });
    return {
      token,
      user: {
        id: acc.id,
        email: acc.email,
        first_name: acc.displayName,
      },
    };
  });

  fastify.get('/auth/me', async (request, reply) => {
    const token = getBearerToken(request);
    if (!token) return reply.code(401).send({ error: 'Не авторизован' });
    const pl = verifyJwt(token);
    if (!pl?.sub) return reply.code(401).send({ error: 'Сессия недействительна' });
    const acc = findAccountById(pl.sub);
    if (!acc) return reply.code(401).send({ error: 'Аккаунт не найден' });
    return {
      user: {
        id: acc.id,
        email: acc.email,
        first_name: acc.displayName,
      },
    };
  });
}
