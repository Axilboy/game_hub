import BackArrow from '../BackArrow';
import AppHeaderRight from '../layout/AppHeaderRight';
import '../landing/gamePromoLanding.css';

/**
 * Единая оболочка экрана игры: градиент и токены темы как на промо-лендингах (.gpl--*).
 * @param {'spy'|'mafia'|'elias'|'truth_dare'|'bunker'} theme
 */
export default function GameplayScreen({
  theme,
  user,
  onBack,
  backTitle = 'Назад',
  title,
  children,
  headerExtra,
}) {
  return (
    <div className={`gameplay gpl--${theme}`}>
      <div className="gameplay__inner">
        <header className="gameplay__topbar">
          <BackArrow onClick={onBack} title={backTitle} />
          <span className="gameplay__title">{title || '\u00a0'}</span>
          <AppHeaderRight user={user} />
        </header>
        {headerExtra}
        {children}
      </div>
    </div>
  );
}
