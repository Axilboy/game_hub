const codes = new Map();

function randomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 8; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export function createPromocode(type) {
  const now = Date.now();
  let ms = 24 * 60 * 60 * 1000;
  if (type === 'week') ms = 7 * ms;
  else if (type === 'month') ms = 30 * ms;
  let code;
  do {
    code = randomCode();
  } while (codes.has(code));
  const expiresAt = now + ms;
  codes.set(code, { type, expiresAt, used: false });
  return { code, expiresAt };
}

export function redeemPromocode(code) {
  const c = codes.get(String(code).toUpperCase());
  if (!c || c.used || c.expiresAt < Date.now()) return null;
  c.used = true;
  return { proExpiresAt: c.expiresAt };
}
