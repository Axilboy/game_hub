import Modal from '../ui/Modal';
import './lobbySettingsSheet.css';

/**
 * Шторка настроек режима: вкладки + скролл + опциональный футер.
 */
export default function LobbySettingsSheet({
  open,
  onClose,
  title,
  tabs = [],
  activeTab,
  onTabChange,
  children,
  footer,
}) {
  return (
    <Modal open={open} onClose={onClose} title={title} width={520} className="lobby-settings-sheet-modal">
      {tabs.length > 0 ? (
        <div className="lobby-settings-tabs" role="tablist">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={activeTab === t.id}
              className={`lobby-settings-tabs__btn${activeTab === t.id ? ' lobby-settings-tabs__btn--active' : ''}`}
              onClick={() => onTabChange(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      ) : null}
      <div className="lobby-settings-sheet-body">{children}</div>
      {footer ? <div className="lobby-settings-sheet-footer">{footer}</div> : null}
    </Modal>
  );
}
