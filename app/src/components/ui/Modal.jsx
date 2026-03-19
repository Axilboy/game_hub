import { useEffect } from 'react';

export default function Modal({ open, onClose, title, children, width = 360 }) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10,
        padding: 24,
      }}
      onClick={() => onClose?.()}
      role="dialog"
      aria-modal="true"
      aria-label={title || 'modal'}
    >
      <div
        style={{
          background: 'var(--tg-theme-bg-color, #1a1a1a)',
          padding: 24,
          borderRadius: 12,
          maxWidth: width,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {title ? <h3 style={{ marginTop: 0, marginBottom: 12 }}>{title}</h3> : null}
        {children}
      </div>
    </div>
  );
}

