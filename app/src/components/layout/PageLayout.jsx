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
      <footer style={{ padding: '8px 12px 14px', opacity: 0.82 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: 12 }}>
          <a href="/seo">SEO</a>
          <a href="/how-to-play">Как играть</a>
          <a href="/games/spy">Шпион</a>
          <a href="/games/mafia">Мафия</a>
          <a href="/games/elias">Элиас</a>
          <a href="/games/truth_dare">Правда/Действие</a>
          <a href="/games/bunker">Бункер</a>
          <a href="/privacy">Приватность</a>
          <a href="/rules">Правила</a>
        </div>
      </footer>
      {stickyBottom ? <div className="gh-actionbar">{stickyBottom}</div> : null}
    </div>
  );
}

