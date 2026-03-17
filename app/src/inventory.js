const INV_KEY = 'gameHub_inventory';

export function getInventory() {
  try {
    const s = JSON.parse(localStorage.getItem(INV_KEY) || '{}');
    const hasPro = Boolean(s.hasPro && s.proExpiresAt && s.proExpiresAt > Date.now());
    return {
      dictionaries: Array.isArray(s.dictionaries) ? s.dictionaries : ['free'],
      hasPro,
      proExpiresAt: s.proExpiresAt || null,
    };
  } catch {
    return { dictionaries: ['free'], hasPro: false, proExpiresAt: null };
  }
}

export function saveInventory(inv) {
  try {
    localStorage.setItem(INV_KEY, JSON.stringify(inv));
  } catch (_) {}
}

export function purchaseDictionary(id) {
  const inv = getInventory();
  if (inv.dictionaries.includes(id)) return inv;
  inv.dictionaries = [...inv.dictionaries, id];
  saveInventory(inv);
  return inv;
}

export function setPro(expiresAt) {
  const inv = getInventory();
  inv.hasPro = true;
  inv.proExpiresAt = expiresAt;
  saveInventory(inv);
  return inv;
}
