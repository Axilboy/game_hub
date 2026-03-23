/**
 * Общий блок внутренних SEO-ссылок для продвижения и перелинковки.
 * Используется в PageLayout и на публичных SEO-страницах.
 */
export default function SeoFooter({ style }) {
  const linkStyle = { color: 'var(--tg-theme-link-color, #7ab)', fontSize: 12, opacity: 0.9 };
  const wrapStyle = {
    padding: '12px 0 8px',
    marginTop: 20,
    borderTop: '1px solid rgba(255,255,255,0.08)',
    ...style,
  };
  return (
    <footer style={wrapStyle}>
      <nav aria-label="Дополнительные страницы" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 12px', lineHeight: 1.4 }}>
        <a href="/" style={linkStyle}>Главная</a>
        <a href="/games/spy" style={linkStyle}>Шпион</a>
        <a href="/games/mafia" style={linkStyle}>Мафия</a>
        <a href="/games/elias" style={linkStyle}>Элиас</a>
        <a href="/games/truth_dare" style={linkStyle}>Правда/Действие</a>
        <a href="/games/bunker" style={linkStyle}>Бункер</a>
        <a href="/games/munchkin" style={linkStyle}>Манчкин</a>
        <a href="/privacy" style={linkStyle}>Приватность</a>
        <a href="/rules" style={linkStyle}>Правила</a>
      </nav>
    </footer>
  );
}
