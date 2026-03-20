const KEY = 'gh_custom_dicts_v1';

export function getCustomDictionaries() {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    const elias = Array.isArray(parsed?.elias) ? parsed.elias : [];
    return { elias };
  } catch (_) {
    return { elias: [] };
  }
}

export function saveCustomEliasWords(words) {
  const normalized = [...new Set((Array.isArray(words) ? words : []).map((w) => String(w || '').trim()).filter(Boolean))].slice(0, 400);
  const next = { ...getCustomDictionaries(), elias: normalized };
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch (_) {}
  return next;
}

export function exportCustomDictionariesText() {
  return JSON.stringify(getCustomDictionaries(), null, 2);
}

export function importCustomDictionariesText(text) {
  const parsed = JSON.parse(String(text || '{}'));
  const words = Array.isArray(parsed?.elias) ? parsed.elias : [];
  return saveCustomEliasWords(words);
}
