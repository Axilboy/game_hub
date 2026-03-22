import { getInventory, saveInventory } from './inventory';
import { getDisplayName } from './displayName';

/** Браузерный «гость» (id вида web_…). В Telegram Mini App — числовой id. */
export function isBrowserGuestUser(user) {
  if (user?.id == null || user?.id === '') return true;
  return String(user.id).startsWith('web_');
}

/** Аккаунт по почте (acc_…) после регистрации на сайте. */
export function isEmailAccountUser(user) {
  return user?.id != null && String(user.id).startsWith('acc_');
}

export function buildAccountBackup(user) {
  const inv = getInventory();
  return {
    v: 1,
    kind: 'gamehub_account_backup',
    exportedAt: Date.now(),
    playerId: String(user?.id ?? ''),
    displayName: getDisplayName() || user?.first_name || '',
    inventory: {
      dictionaries: Array.isArray(inv.dictionaries) ? [...inv.dictionaries] : ['free'],
      unlockedItems: Array.isArray(inv.unlockedItems) ? [...inv.unlockedItems] : [],
      purchases: Array.isArray(inv.purchases) ? [...inv.purchases].slice(-50) : [],
      hasPro: Boolean(inv.hasPro),
      proExpiresAt: Number(inv.proExpiresAt) || 0,
    },
  };
}

export function importAccountBackup(raw) {
  try {
    const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!data || data.kind !== 'gamehub_account_backup' || data.v !== 1 || !data.inventory) {
      return { ok: false, error: 'Неверный формат файла' };
    }
    const inv = data.inventory;
    const next = {
      ...getInventory(),
      dictionaries: Array.isArray(inv.dictionaries) && inv.dictionaries.length ? inv.dictionaries : ['free'],
      unlockedItems: Array.isArray(inv.unlockedItems) ? inv.unlockedItems : [],
      purchases: Array.isArray(inv.purchases) ? inv.purchases : [],
      hasPro: Boolean(inv.hasPro),
      proExpiresAt: Number(inv.proExpiresAt) || 0,
    };
    saveInventory(next);
    return { ok: true };
  } catch {
    return { ok: false, error: 'Не удалось прочитать файл' };
  }
}

export function downloadAccountBackup(user) {
  const payload = buildAccountBackup(user);
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  const sid = String(user?.id ?? 'guest').replace(/[^\w-]+/g, '_').slice(0, 24);
  a.download = `gamehub-backup-${sid}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function getTelegramBotUrl() {
  const u = import.meta.env.VITE_BOT_USERNAME;
  if (!u || typeof u !== 'string') return '';
  const name = u.replace(/^@/, '').trim();
  return name ? `https://t.me/${name}` : '';
}
