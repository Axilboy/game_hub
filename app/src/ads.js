const ZONE_ID = import.meta.env.VITE_MONETAG_ZONE_ID || '10744376';

function getShowFn() {
  const fnName = `show_${ZONE_ID}`;
  return typeof window !== 'undefined' && typeof window[fnName] === 'function' ? window[fnName] : null;
}

/**
 * Показать рекламу перед стартом игры (Rewarded interstitial).
 * @returns {Promise<{ adSdkShown: boolean }>} adSdkShown — SDK был и вызван (успех/ошибка показа не различаем).
 */
export function showAdIfNeeded() {
  const showFn = getShowFn();
  if (!showFn) return Promise.resolve({ adSdkShown: false });
  return showFn()
    .then(() => ({ adSdkShown: true }))
    .catch(() => ({ adSdkShown: true }));
}

export function hasAdSdk() {
  return Boolean(getShowFn());
}
