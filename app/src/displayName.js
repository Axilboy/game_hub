const KEY = 'gameHub_displayName';
const AVATAR_KEY = 'gameHub_avatar';
const PHOTO_KEY = 'gameHub_profilePhoto';

export function getDisplayName() {
  try {
    const s = localStorage.getItem(KEY);
    return (s && s.trim()) || null;
  } catch {
    return null;
  }
}

/**
 * Имя для отображения в комнатах/друзьях: своё из профиля или из Telegram.
 * @param {null | { id?: string | number, first_name?: string, last_name?: string, username?: string }} user
 */
export function resolvePublicDisplayName(user) {
  const custom = getDisplayName()?.trim();
  if (custom) return custom.slice(0, 120);
  const fn = user?.first_name;
  if (fn) {
    const ln = user.last_name ? ` ${user.last_name}` : '';
    return `${fn}${ln}`.trim().slice(0, 120);
  }
  if (user?.username) return `@${user.username}`.slice(0, 120);
  if (user?.id != null) return `Игрок ${String(user.id).slice(-4)}`;
  return 'Игрок';
}

/**
 * Строка в списке друзей: «Имя в игре (заметка)».
 * @param {{ displayName?: string, note?: string, id?: string }} f
 */
export function formatFriendListLine(f) {
  const name =
    (f.displayName && String(f.displayName).trim()) ? String(f.displayName).trim() : `Игрок ${f.id ?? ''}`;
  const n = f.note && String(f.note).trim() ? String(f.note).trim() : '';
  return n ? `${name} (${n})` : name;
}

/** Только имя друга (без примечания) — для строки «имя · примечание справа». */
export function friendDisplayNameOnly(f) {
  return (f.displayName && String(f.displayName).trim())
    ? String(f.displayName).trim()
    : `Игрок ${f.id ?? ''}`;
}

export function setDisplayName(name) {
  try {
    const v = (name && String(name).trim()) || '';
    if (v) localStorage.setItem(KEY, v);
    else localStorage.removeItem(KEY);
  } catch (_) {}
}

export function getAvatar() {
  try {
    const s = localStorage.getItem(AVATAR_KEY);
    return (s && s.trim()) || null;
  } catch {
    return null;
  }
}

export function setAvatar(emoji) {
  try {
    const v = (emoji && String(emoji).trim()) || '';
    if (v) localStorage.setItem(AVATAR_KEY, v);
    else localStorage.removeItem(AVATAR_KEY);
  } catch (_) {}
}

export function getProfilePhoto() {
  try {
    const s = localStorage.getItem(PHOTO_KEY);
    return (s && s.trim()) || null;
  } catch {
    return null;
  }
}

export function setProfilePhoto(url) {
  try {
    const v = (url && String(url).trim()) || '';
    if (v) localStorage.setItem(PHOTO_KEY, v);
    else localStorage.removeItem(PHOTO_KEY);
  } catch (_) {}
}

export const AVATAR_EMOJI_LIST = ['😀', '😎', '🦊', '🐻', '🐼', '🦁', '🐯', '🐸', '🐵', '🐶', '🐱', '🦄', '🐲', '⭐', '🔥', '💎', '🎮', '🎯', '🏆', '👤'];
