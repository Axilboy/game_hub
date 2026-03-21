import { useState, useEffect } from 'react';

/**
 * Нужны ли жесты смахивания (Элиас и т.д.): Android, iOS, планшеты с тачем.
 * На обычном ПК с мышью — false (только кнопки), чтобы не было ложных срабатываний.
 */
function computeSwipeGesturesEnabled() {
  if (typeof window === 'undefined') return false;
  try {
    if (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0) return true;
    return window.matchMedia('(pointer: coarse)').matches;
  } catch (_) {
    return false;
  }
}

export function useSwipeGesturesEnabled() {
  const [enabled, setEnabled] = useState(() => computeSwipeGesturesEnabled());

  useEffect(() => {
    const update = () => setEnabled(computeSwipeGesturesEnabled());
    update();
    const mq = window.matchMedia('(pointer: coarse)');
    mq.addEventListener?.('change', update);
    return () => mq.removeEventListener?.('change', update);
  }, []);

  return enabled;
}
