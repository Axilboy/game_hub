const ZONE_ID = import.meta.env.VITE_MONETAG_ZONE_ID || '10744376';

/**
 * Показать рекламу перед стартом игры (Rewarded interstitial).
 * Пока что показывается всем (в т.ч. с подпиской Про).
 */
export function showAdIfNeeded() {
  const fnName = `show_${ZONE_ID}`;
  const showFn = typeof window !== 'undefined' && typeof window[fnName] === 'function' ? window[fnName] : null;
  if (!showFn) return Promise.resolve();
  return showFn().then(() => {}).catch(() => {});
}
