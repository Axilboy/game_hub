import { useEffect, useRef, useCallback } from 'react';

export default function Modal({
  open,
  onClose,
  title,
  titleId,
  children,
  width = 360,
  className = '',
  /** Если false — клик по фону не закрывает окно (только Escape и явные кнопки). */
  closeOnOverlayClick = true,
}) {
  const panelRef = useRef(null);
  const prevActive = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  /** Чтобы при каждом ре-рендере родителя не срабатывала автофокусировка (на мобильных закрывает клавиатуру в полях ввода). */
  const didFocusOnOpenRef = useRef(false);

  const handleTab = useCallback(
    (e) => {
      if (e.key !== 'Tab' || !panelRef.current) return;
      const root = panelRef.current;
      const focusable = root.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      const list = [...focusable].filter((el) => !el.hasAttribute('disabled'));
      if (list.length === 0) return;
      const first = list[0];
      const last = list[list.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    },
    [],
  );

  useEffect(() => {
    if (!open) {
      didFocusOnOpenRef.current = false;
      return;
    }

    prevActive.current = document.activeElement;

    const onKeyDown = (e) => {
      if (e.key === 'Escape') onCloseRef.current?.();
      handleTab(e);
    };
    window.addEventListener('keydown', onKeyDown);

    let t = 0;
    if (!didFocusOnOpenRef.current) {
      didFocusOnOpenRef.current = true;
      t = requestAnimationFrame(() => {
        const root = panelRef.current;
        if (!root) return;
        const first = root.querySelector(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        (first || root).focus?.();
      });
    }

    return () => {
      cancelAnimationFrame(t);
      window.removeEventListener('keydown', onKeyDown);
      if (prevActive.current && typeof prevActive.current.focus === 'function') {
        try {
          prevActive.current.focus();
        } catch (_) {}
      }
    };
  }, [open, handleTab]);

  if (!open) return null;

  const tid = titleId || 'gh-modal-title';

  return (
    <div
      className={`gh-modal-overlay gh-fade-in ${className}`.trim()}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        padding: 'var(--gh-space-6, 24px)',
      }}
      onClick={() => {
        if (closeOnOverlayClick !== false) onCloseRef.current?.();
      }}
      role="presentation"
    >
      <div
        ref={panelRef}
        className="gh-card gh-modal-panel"
        style={{
          background: 'var(--tg-theme-bg-color, #1a1a1a)',
          padding: 'var(--gh-space-6, 24px)',
          borderRadius: 'var(--gh-radius, 12px)',
          maxWidth: width,
          width: '100%',
          maxHeight: '90vh',
          overflow: 'auto',
          outline: 'none',
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? tid : undefined}
      >
        {title ? (
          <h3 id={tid} style={{ marginTop: 0, marginBottom: 12 }}>
            {title}
          </h3>
        ) : null}
        {children}
      </div>
    </div>
  );
}
