const KEY = 'gameHub_displayName';
const AVATAR_KEY = 'gameHub_avatar';

export function getDisplayName() {
  try {
    const s = localStorage.getItem(KEY);
    return (s && s.trim()) || null;
  } catch {
    return null;
  }
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

export const AVATAR_EMOJI_LIST = ['😀', '😎', '🦊', '🐻', '🐼', '🦁', '🐯', '🐸', '🐵', '🐶', '🐱', '🦄', '🐲', '⭐', '🔥', '💎', '🎮', '🎯', '🏆', '👤'];
