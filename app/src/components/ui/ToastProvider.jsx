import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

const ToastContext = createContext(null);

function makeId() {
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef(new Map());

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) clearTimeout(timer);
    timersRef.current.delete(id);
  }, []);

  const showToast = useCallback(
    ({ type = 'info', message, durationMs = 2800 } = {}) => {
      if (!message) return;
      const id = makeId();
      setToasts((prev) => [...prev, { id, type, message }]);

      const timer = setTimeout(() => removeToast(id), durationMs);
      timersRef.current.set(id, timer);
    },
    [removeToast]
  );

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        style={{
          position: 'fixed',
          left: '50%',
          bottom: 18,
          transform: 'translateX(-50%)',
          zIndex: 30,
          width: 'min(92vw, 420px)',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          pointerEvents: 'none',
        }}
      >
        {toasts.map((t) => {
          const color =
            t.type === 'success'
              ? '#8f8'
              : t.type === 'error'
                ? '#f88'
                : t.type === 'warning'
                  ? '#fd8'
                  : '#7ab';
          return (
            <div
              key={t.id}
              className="gh-card"
              style={{
                padding: 14,
                borderRadius: 12,
                border: `1px solid rgba(255,255,255,0.12)`,
                background: 'rgba(0,0,0,0.35)',
                boxShadow: '0 14px 40px rgba(0,0,0,0.35)',
                pointerEvents: 'none',
              }}
            >
              <div style={{ fontSize: 14, color, fontWeight: 700, marginBottom: 6 }}>
                {t.type === 'success' ? 'Готово' : t.type === 'error' ? 'Ошибка' : t.type === 'warning' ? 'Важно' : 'Инфо'}
              </div>
              <div style={{ fontSize: 14, opacity: 0.95 }}>{t.message}</div>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return { showToast: () => {} };
  }
  return ctx;
}

