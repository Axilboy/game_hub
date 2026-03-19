import useSeo from '../hooks/useSeo';
import BackArrow from '../components/BackArrow';

const btnStyle = {
  padding: '12px 20px',
  fontSize: 16,
  borderRadius: 8,
  border: 'none',
  background: 'var(--tg-theme-button-color, #3a7bd5)',
  color: 'var(--tg-theme-button-text-color, #fff)',
  cursor: 'pointer',
  width: '100%',
};

export default function SeoLanding({ navigateToApp }) {
  useSeo({
    title: 'GameHub — мини-игры в Telegram',
    description: 'Собирайте друзей в одной комнате и играйте в «Шпион», «Элиас», «Мафию» и другие мини-игры прямо в Telegram.',
  });

  // If called not in a router context, just omit the back button.
  return (
    <div style={{ padding: 24, maxWidth: 520, margin: '0 auto' }}>
      {navigateToApp ? <BackArrow onClick={navigateToApp} title="Назад" /> : null}
      <h1 style={{ marginTop: 0 }}>Игровой хаб в Telegram</h1>
      <p style={{ opacity: 0.9, lineHeight: 1.4 }}>
        Нажмите кнопку «Открыть приложение», чтобы перейти в GameHub и начать игру в одной комнате с друзьями.
      </p>

      <div style={{ marginTop: 18 }}>
        <button
          type="button"
          onClick={() => navigateToApp?.()}
          style={btnStyle}
          disabled={!navigateToApp}
        >
          Открыть приложение
        </button>
      </div>

      <section style={{ marginTop: 22 }}>
        <h3 style={{ marginBottom: 10 }}>Доступно сейчас</h3>
        <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.6 }}>
          <li>Шпион</li>
          <li>Элиас</li>
          <li>Мафия</li>
        </ul>
      </section>
    </div>
  );
}

