import { useEffect, useState } from 'react';

/**
 * Пока подгружается lazy-чанк маршрута (первый заход на экран дольше).
 */
export default function RouteLoadingFallback() {
  const [firstChunk] = useState(() => {
    try {
      return !sessionStorage.getItem('gh_lazy_chunk_seen');
    } catch (_) {
      return true;
    }
  });

  useEffect(() => {
    try {
      if (!sessionStorage.getItem('gh_lazy_chunk_seen')) {
        sessionStorage.setItem('gh_lazy_chunk_seen', '1');
      }
    } catch (_) {}
  }, []);

  return (
    <div
      className="gh-card"
      style={{
        margin: 'max(24px, env(safe-area-inset-top)) 20px 24px',
        padding: 20,
        maxWidth: 420,
        marginLeft: 'auto',
        marginRight: 'auto',
      }}
      role="status"
      aria-live="polite"
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <span
          style={{
            width: 14,
            height: 14,
            borderRadius: '50%',
            background: 'var(--tg-theme-button-color, #3a7bd5)',
            flexShrink: 0,
            boxShadow: '0 0 0 6px rgba(58,123,213,0.2)',
          }}
        />
        <span style={{ fontWeight: 700, fontSize: 16 }}>Загружаем экран…</span>
      </div>
      <p style={{ margin: 0, fontSize: 14, opacity: 0.88, lineHeight: 1.45 }}>
        {firstChunk
          ? 'Подождите — на медленном интернете первый раз дольше, это всего один раз за сессию. Дальше обычно быстрее.'
          : 'Секунду, подгружаем части интерфейса.'}
      </p>
    </div>
  );
}
