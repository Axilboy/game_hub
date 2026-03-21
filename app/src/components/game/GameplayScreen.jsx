import { useNavigate } from 'react-router-dom';
import BackArrow from '../BackArrow';
import AppHeaderRight from '../layout/AppHeaderRight';
import '../landing/gamePromoLanding.css';

/**
 * Единая оболочка экрана игры: градиент и токены темы как на промо-лендингах (.gpl--*).
 * @param {'spy'|'mafia'|'elias'|'truth_dare'|'bunker'} theme
 * @param {boolean} [showHomeButton] — отдельная кнопка «на главную» справа (у мафии обычно false — выход в левой кнопке).
 */
export default function GameplayScreen({
  theme,
  user,
  onBack,
  backTitle = 'Назад',
  /** Необязательный символ левой кнопки (например ⌂) */
  backIcon,
  showHomeButton = true,
  title,
  children,
  headerExtra,
}) {
  const navigate = useNavigate();
  return (
    <div className={`gameplay gpl--${theme}`}>
      <div className="gameplay__inner">
        <header className="gameplay__topbar">
          <div className="gameplay__topbarSlot gameplay__topbarSlot--start">
            {onBack ? <BackArrow onClick={onBack} title={backTitle} inline icon={backIcon} /> : <span className="gameplay__topbarPad" aria-hidden />}
          </div>
          <span className="gameplay__title">{title || '\u00a0'}</span>
          <div className="gameplay__topbarSlot gameplay__topbarSlot--end">
            {showHomeButton ? (
              <button
                type="button"
                className="gameplay__homeBtn"
                onClick={() => navigate('/')}
                title="На главную"
                aria-label="На главную"
              >
                ⌂
              </button>
            ) : null}
            <AppHeaderRight user={user} />
          </div>
        </header>
        {headerExtra}
        {children}
      </div>
    </div>
  );
}
