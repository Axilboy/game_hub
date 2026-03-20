const INV_KEY = 'gameHub_inventory';
const TRIAL_HOURS = 24;
const TRIAL_COOLDOWN_DAYS = 7;

export function getInventory() {
  try {
    const s = JSON.parse(localStorage.getItem(INV_KEY) || '{}');
    const hasPro = Boolean(s.hasPro && s.proExpiresAt && s.proExpiresAt > Date.now());
    return {
      dictionaries: Array.isArray(s.dictionaries) ? s.dictionaries : ['free'],
      unlockedItems: Array.isArray(s.unlockedItems) ? s.unlockedItems : [],
      purchases: Array.isArray(s.purchases) ? s.purchases : [],
      hasPro,
      proExpiresAt: s.proExpiresAt || null,
    };
  } catch {
    return { dictionaries: ['free'], unlockedItems: [], purchases: [], hasPro: false, proExpiresAt: null };
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
  inv.purchases = [
    ...(Array.isArray(inv.purchases) ? inv.purchases : []),
    { id: `dict:${id}`, t: Date.now(), type: 'dictionary' },
  ].slice(-50);
  saveInventory(inv);
  return inv;
}

export function setPro(expiresAt) {
  const inv = getInventory();
  inv.hasPro = true;
  inv.proExpiresAt = expiresAt;
  inv.purchases = [
    ...(Array.isArray(inv.purchases) ? inv.purchases : []),
    { id: 'pro', t: Date.now(), type: 'subscription', expiresAt },
  ].slice(-50);
  saveInventory(inv);
  return inv;
}

export function addPurchaseHistory(entry) {
  const inv = getInventory();
  inv.purchases = [
    ...(Array.isArray(inv.purchases) ? inv.purchases : []),
    { ...entry, t: entry?.t || Date.now() },
  ].slice(-50);
  saveInventory(inv);
  return inv;
}

export function unlockItem(itemId) {
  const inv = getInventory();
  const normalizedId = String(itemId || '').trim();
  if (!normalizedId) return inv;
  if (!Array.isArray(inv.unlockedItems)) inv.unlockedItems = [];
  if (!inv.unlockedItems.includes(normalizedId)) inv.unlockedItems = [...inv.unlockedItems, normalizedId];
  inv.purchases = [
    ...(Array.isArray(inv.purchases) ? inv.purchases : []),
    { id: normalizedId, t: Date.now(), type: 'item_unlock' },
  ].slice(-50);
  saveInventory(inv);
  return inv;
}

export function hasUnlockedItem(itemId) {
  const inv = getInventory();
  const normalizedId = String(itemId || '').trim();
  if (!normalizedId) return false;
  return Array.isArray(inv.unlockedItems) && inv.unlockedItems.includes(normalizedId);
}

export function restorePurchases() {
  const inv = getInventory();
  saveInventory(inv);
  return inv;
}

export function canStartTrial(nowTs = Date.now()) {
  try {
    const raw = JSON.parse(localStorage.getItem(INV_KEY) || '{}');
    const lastTrialAt = Number(raw.lastTrialAt) || 0;
    if (!lastTrialAt) return true;
    const cooldownMs = TRIAL_COOLDOWN_DAYS * 24 * 3600 * 1000;
    return nowTs - lastTrialAt >= cooldownMs;
  } catch {
    return true;
  }
}

export function startTrialUnlock(nowTs = Date.now()) {
  const inv = getInventory();
  if (!canStartTrial(nowTs)) return { ok: false, inv };
  const expiresAt = nowTs + TRIAL_HOURS * 3600 * 1000;
  inv.hasPro = true;
  inv.proExpiresAt = expiresAt;
  inv.purchases = [
    ...(Array.isArray(inv.purchases) ? inv.purchases : []),
    { id: 'trial_pro_24h', t: nowTs, type: 'trial', expiresAt },
  ].slice(-50);
  try {
    const raw = JSON.parse(localStorage.getItem(INV_KEY) || '{}');
    raw.lastTrialAt = nowTs;
    raw.trialCount = (Number(raw.trialCount) || 0) + 1;
    raw.dictionaries = inv.dictionaries;
    raw.unlockedItems = inv.unlockedItems;
    raw.purchases = inv.purchases;
    raw.hasPro = true;
    raw.proExpiresAt = expiresAt;
    localStorage.setItem(INV_KEY, JSON.stringify(raw));
  } catch (_) {
    saveInventory(inv);
  }
  return { ok: true, inv };
}

export function getOrCreateReferralCode() {
  try {
    const raw = JSON.parse(localStorage.getItem(INV_KEY) || '{}');
    if (raw.referralCode) return String(raw.referralCode);
    const code = `GH-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
    raw.referralCode = code;
    localStorage.setItem(INV_KEY, JSON.stringify(raw));
    return code;
  } catch {
    return `GH-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
  }
}

export function redeemReferralCode(code) {
  const normalized = String(code || '').trim().toUpperCase();
  if (!/^GH-[A-Z0-9]{5}$/.test(normalized)) return { ok: false, reason: 'invalid' };
  const own = getOrCreateReferralCode();
  if (normalized === own) return { ok: false, reason: 'self' };
  try {
    const raw = JSON.parse(localStorage.getItem(INV_KEY) || '{}');
    raw.redeemedReferrals = Array.isArray(raw.redeemedReferrals) ? raw.redeemedReferrals : [];
    if (raw.redeemedReferrals.includes(normalized)) return { ok: false, reason: 'duplicate' };
    raw.redeemedReferrals.push(normalized);
    const nowTs = Date.now();
    const inv = getInventory();
    const nextExpiry = Math.max(Number(inv.proExpiresAt) || 0, nowTs) + 12 * 3600 * 1000;
    raw.hasPro = true;
    raw.proExpiresAt = nextExpiry;
    raw.dictionaries = inv.dictionaries;
    raw.unlockedItems = inv.unlockedItems;
    raw.purchases = [
      ...(Array.isArray(inv.purchases) ? inv.purchases : []),
      { id: `referral:${normalized}`, t: nowTs, type: 'referral_bonus', expiresAt: nextExpiry },
    ].slice(-50);
    localStorage.setItem(INV_KEY, JSON.stringify(raw));
    return { ok: true, proExpiresAt: nextExpiry };
  } catch {
    return { ok: false, reason: 'storage' };
  }
}
