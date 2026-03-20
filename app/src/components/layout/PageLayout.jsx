import SeoFooter from './SeoFooter';

export default function PageLayout({
  title,
  onBack,
  right,
  children,
  stickyBottom,
}) {
  return (
    <div className="gh-shell">
      <header className="gh-topbar">
        <div className="gh-topbar__side">
          {onBack ? (
            <button type="button" className="gh-icon-btn" onClick={onBack} aria-label="Назад">
              ‹
            </button>
          ) : null}
        </div>
        <div className="gh-topbar__title">{title || ''}</div>
        <div className="gh-topbar__side" style={{ justifyContent: 'flex-end' }}>
          {right || null}
        </div>
      </header>
      <main className="gh-shell__content gh-page">{children}</main>
      <div style={{ padding: '0 12px 14px' }}>
        <SeoFooter style={{ marginTop: 8, paddingTop: 12 }} />
      </div>
      {stickyBottom ? <div className="gh-actionbar">{stickyBottom}</div> : null}
    </div>
  );
}

