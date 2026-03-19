/** Простой fixed-window rate limit для игровых эндпоинтов */

const buckets = new Map();

/**
 * @param {string} key уникальный ключ (комната + игрок + действие)
 * @param {number} maxCount макс. запросов за окно
 * @param {number} windowMs длина окна в мс
 */
export function allowAction(key, maxCount, windowMs) {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || now - b.start >= windowMs) {
    b = { start: now, count: 0 };
    buckets.set(key, b);
  }
  if (b.count >= maxCount) return false;
  b.count += 1;
  if (buckets.size > 20000) {
    for (const [k, v] of buckets) {
      if (now - v.start >= windowMs * 4) buckets.delete(k);
    }
  }
  return true;
}
