import { useState } from 'react';
import GameLayout from './GameLayout';
import Modal from '../ui/Modal';
import Button from '../ui/Button';

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

  return (
    <>
      <GameLayout
        top={top}
        center={center}
        padding={padding}
        bottom={
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button
              type="button"
              onClick={onPrimary}
              style={{ ...baseBtnStyle, background: primaryBg }}
            >
              {primaryLabel}
            </button>
            {secondaryLabel && onSecondary ? (
              <button
                type="button"
                onClick={handleSecondary}
                style={{ ...baseBtnStyle, background: secondaryBg, opacity: 1 }}
              >
                {secondaryLabel}
              </button>
            ) : null}
          </div>
        }
      >
        {children}
      </GameLayout>

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

