import { useState } from 'react';
import GameLayout from './GameLayout';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import '../landing/gamePromoLanding.css';

const baseBtnStyle = {
  padding: 'var(--gh-space-3, 12px) var(--gh-space-5, 20px)',
  fontSize: 'var(--gh-font-size-md, 16px)',
  borderRadius: 'var(--gh-radius-sm, 8px)',
  border: 'none',
  color: '#fff',
  cursor: 'pointer',
  width: '100%',
};

export default function PostMatchScreen({
  theme, // 'spy' | 'mafia' | 'elias' | 'truth_dare' | 'bunker' — фон как на промо-лендинге
  top,
  children,
  center = true,
  padding = 24,
  primaryLabel = 'В лобби',
  onPrimary,
  secondaryLabel = 'Выйти',
  onSecondary,
  primaryBg = 'var(--tg-theme-button-color, #3a7bd5)',
  secondaryBg = '#333',
  confirmSecondary = false,
  confirmTitle = 'Вы уверены?',
  confirmText,
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleSecondary = () => {
    if (confirmSecondary) {
      setConfirmOpen(true);
      return;
    }
    onSecondary?.();
  };

  const primaryStyle = theme
    ? { ...baseBtnStyle, background: 'var(--gpl-accent)', color: 'var(--gpl-accent-text)' }
    : { ...baseBtnStyle, background: primaryBg };
  const secondaryStyle = theme
    ? { ...baseBtnStyle, background: 'rgba(0,0,0,0.32)', color: 'var(--gpl-hero-text)', border: '1px solid rgba(255,255,255,0.14)' }
    : { ...baseBtnStyle, background: secondaryBg, opacity: 1 };

  const layout = (
    <GameLayout
      top={top}
      center={center}
      padding={padding}
      minHeight={theme ? '100%' : '100vh'}
      bottom={
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button type="button" onClick={onPrimary} style={primaryStyle}>
            {primaryLabel}
          </button>
          {secondaryLabel && onSecondary ? (
            <button type="button" onClick={handleSecondary} style={secondaryStyle}>
              {secondaryLabel}
            </button>
          ) : null}
        </div>
      }
    >
      {children}
    </GameLayout>
  );

  return (
    <>
      {theme ? (
        <div className={`gameplay gpl--${theme}`}>
          <div className="gameplay__inner gameplay__inner--post">{layout}</div>
        </div>
      ) : (
        layout
      )}

      {confirmSecondary && onSecondary ? (
        <Modal
          open={confirmOpen}
          onClose={() => setConfirmOpen(false)}
          title={confirmTitle}
          width={360}
        >
          <p style={{ marginTop: 0, marginBottom: 16, opacity: 0.9 }}>
            {confirmText || 'Это действие приведет к выходу из комнаты.'}
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button
              variant="danger"
              fullWidth={false}
              style={{ flex: 1 }}
              onClick={() => {
                setConfirmOpen(false);
                onSecondary?.();
              }}
            >
              Да
            </Button>
            <Button
              variant="ghost"
              fullWidth={false}
              style={{ flex: 1, background: '#444' }}
              onClick={() => setConfirmOpen(false)}
            >
              Нет
            </Button>
          </div>
        </Modal>
      ) : null}
    </>
  );
}

