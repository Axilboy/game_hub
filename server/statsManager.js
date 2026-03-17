const ADMIN_PASSWORD = '1973';
const byDate = new Map();

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function ensureSet(dateKey) {
  if (!byDate.has(dateKey)) byDate.set(dateKey, new Set());
  return byDate.get(dateKey);
}

export function recordPlayer(playerId) {
  const key = todayKey();
  ensureSet(key).add(String(playerId));
}

export function getStats() {
  const now = new Date();
  const dayKey = todayKey();
  const daySet = byDate.get(dayKey) || new Set();

  let weekCount = 0;
  const weekSet = new Set();
  for (let i = 0; i < 7; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    for (const id of byDate.get(k) || []) weekSet.add(id);
  }
  weekCount = weekSet.size;

  let monthCount = 0;
  const monthSet = new Set();
  for (let i = 0; i < 30; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    for (const id of byDate.get(k) || []) monthSet.add(id);
  }
  monthCount = monthSet.size;

  let totalCount = 0;
  const totalSet = new Set();
  for (const set of byDate.values()) {
    for (const id of set) totalSet.add(id);
  }
  totalCount = totalSet.size;

  return {
    day: daySet.size,
    week: weekCount,
    month: monthCount,
    total: totalCount,
  };
}

export function checkAdminPassword(password) {
  return password === ADMIN_PASSWORD;
}
