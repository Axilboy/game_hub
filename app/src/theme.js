/**
 * Глобальная тема сайта (светлая / тёмная), независимо от Telegram WebApp.
 */

export function resolveInitialTheme() {
  try {
    const s = localStorage.getItem('gh_theme');
    if (s === 'light' || s === 'dark') return s;
  } catch (_) {}
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: light)').matches) {
    return 'light';
  }
  return 'dark';
}

/** Текущее значение на <html> */
export function getDocumentTheme() {
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}

export function applyTheme(theme) {
  const v = theme === 'light' ? 'light' : 'dark';
  document.documentElement.dataset.theme = v;
  try {
    localStorage.setItem('gh_theme', v);
  } catch (_) {}
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('gh-theme-change', { detail: { theme: v } }));
  }
}
