const ZONE_ID = import.meta.env.VITE_MONETAG_ZONE_ID || '10744376';

function getShowFn() {
  const fnName = `show_${ZONE_ID}`;
  return typeof window !== 'undefined' && typeof window[fnName] === 'function' ? window[fnName] : null;
}

const AD_WAIT_MS = 12000;

/**
 * Показать рекламу перед стартом игры (Rewarded interstitial).
 * @returns {Promise<{ adSdkShown: boolean }>} adSdkShown — SDK был и вызван (успех/ошибка показа не различаем).
 */
export function showAdIfNeeded() {
  const showFn = getShowFn();
  if (!showFn) return Promise.resolve({ adSdkShown: false });
  const p = showFn();
  if (!p || typeof p.then !== 'function') {
    return Promise.resolve({ adSdkShown: false });
  }
  const timeout = new Promise((resolve) => {
    setTimeout(() => resolve({ adSdkShown: false }), AD_WAIT_MS);
  });
  return Promise.race([
    p
      .then(() => ({ adSdkShown: true }))
      .catch(() => ({ adSdkShown: true })),
    timeout,
  ]);
}

export function hasAdSdk() {
  return Boolean(getShowFn());
}
