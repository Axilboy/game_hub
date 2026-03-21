/**
 * Глобальная тема сайта (светлая / тёмная).
 * Telegram WebApp подставляет --tg-theme-* через inline-стили на <html> и перебивает CSS —
 * поэтому при смене темы выставляем переменные явно через style.setProperty.
 */

const LIGHT_VARS = {
  '--tg-theme-bg-color': '#eef1f7',
  '--tg-theme-text-color': '#12151c',
  '--tg-theme-hint-color': '#5c6575',
  '--tg-theme-link-color': '#1d4ed8',
  '--tg-theme-button-color': '#2563eb',
  '--tg-theme-button-text-color': '#ffffff',
  '--tg-theme-secondary-bg-color': '#e2e8f0',
  '--tg-theme-section-bg-color': '#e8edf5',
  '--tg-theme-section-header-text-color': '#12151c',
  '--tg-theme-subtitle-text-color': '#5c6575',
  '--tg-theme-destructive-text-color': '#b91c1c',
  '--gh-surface': 'rgba(0, 0, 0, 0.05)',
  '--gh-surface-strong': 'rgba(0, 0, 0, 0.09)',
  '--gh-border': 'rgba(0, 0, 0, 0.12)',
  '--gh-shadow': '0 10px 28px rgba(0, 0, 0, 0.1)',
  '--gh-color-muted': '#5f6773',
};

const DARK_VARS = {
  '--tg-theme-bg-color': '#0c0e14',
  '--tg-theme-text-color': '#e8eaef',
  '--tg-theme-hint-color': '#9aa3b2',
  '--tg-theme-link-color': '#7ab3ff',
  '--tg-theme-button-color': '#4a8ae8',
  '--tg-theme-button-text-color': '#ffffff',
  '--tg-theme-secondary-bg-color': '#1a1f2e',
  '--tg-theme-section-bg-color': '#151a24',
  '--tg-theme-section-header-text-color': '#e8eaef',
  '--tg-theme-subtitle-text-color': '#9aa3b2',
  '--tg-theme-destructive-text-color': '#f87171',
  '--gh-surface': 'rgba(255, 255, 255, 0.07)',
  '--gh-surface-strong': 'rgba(255, 255, 255, 0.11)',
  '--gh-border': 'rgba(255, 255, 255, 0.14)',
  '--gh-shadow': '0 10px 32px rgba(0, 0, 0, 0.45)',
  '--gh-color-muted': '#8b95a8',
};

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

function applyCssVars(theme) {
  const vars = theme === 'light' ? LIGHT_VARS : DARK_VARS;
  const root = document.documentElement;
  Object.entries(vars).forEach(([key, val]) => {
    root.style.setProperty(key, val);
  });
}

/**
 * Применить тему: data-атрибут + inline CSS-переменные (перебивает Telegram).
 */
export function applyTheme(theme) {
  const v = theme === 'light' ? 'light' : 'dark';
  document.documentElement.dataset.theme = v;
  applyCssVars(v);
  try {
    localStorage.setItem('gh_theme', v);
  } catch (_) {}
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('gh-theme-change', { detail: { theme: v } }));
  }
}

/** Повторно применить текущую тему из localStorage (после загрузки Telegram WebApp). */
export function reapplyStoredTheme() {
  applyTheme(resolveInitialTheme());
}
