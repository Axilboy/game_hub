const ZONE_ID = import.meta.env.VITE_MONETAG_ZONE_ID || '10744376';

/**
 * Пауза рекламы только для локальной отладки. В проде оставьте `false`.
 * Полное отключение: `VITE_ADS_DISABLED=true` в .env.
 */
const ADS_PAUSED_FOR_TESTING = false;
const ADS_DISABLED_BY_ENV =
  import.meta.env.VITE_ADS_DISABLED === 'true' ||
  import.meta.env.VITE_ADS_DISABLED === '1';
const ADS_DISABLED = ADS_PAUSED_FOR_TESTING || ADS_DISABLED_BY_ENV;

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
  if (ADS_DISABLED) return Promise.resolve({ adSdkShown: false });
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
