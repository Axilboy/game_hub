import { Link } from 'react-router-dom';
import SeoFooter from './SeoFooter';

export default function PageLayout({
  title,
  /** Если задан — заголовок ведёт на эту страницу (например «/») */
  titleHref,
  onBack,
  right,
  children,
  stickyBottom,
  /** Уже читаемый текст (политика, статьи): до 720px вместо стандартных ~460px */
  wideContent = false,
}) {
  const hasTitle = Boolean(title);
  return (
    <div className="gh-shell">
      <header className={`gh-topbar${hasTitle ? '' : ' gh-topbar--no-title'}`}>
        <div className="gh-topbar__side">
          {onBack ? (
            <button type="button" className="gh-icon-btn" onClick={onBack} aria-label="Назад">
              ‹
            </button>
          ) : null}
        </div>
        {hasTitle ? (
          <div className="gh-topbar__title">
            {titleHref ? (
              <Link to={titleHref} className="gh-topbar__brand" aria-label={`${title} — на главную`}>
                {title}
              </Link>
            ) : (
              title
            )}
          </div>
        ) : null}
        <div className="gh-topbar__side gh-topbar__side--end">
          {right || null}
        </div>
      </header>
      <main className={`gh-shell__content gh-page${wideContent ? ' gh-page--wide' : ''}`}>{children}</main>
      <div
        style={{
          paddingLeft: 12,
          paddingRight: 12,
          paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
        }}
      >
        <SeoFooter style={{ marginTop: 8, paddingTop: 12 }} />
      </div>
      {stickyBottom ? <div className="gh-actionbar">{stickyBottom}</div> : null}
    </div>
  );
}

