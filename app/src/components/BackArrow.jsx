/** Стрелка «Назад». `inline` — в шапке игры (не fixed), иначе плавающая кнопка для экранов без topbar. `icon` — например ⌂ для выхода на главную. */
export default function BackArrow({ onClick, title = 'Назад', inline = false, icon }) {
  if (!onClick) return null;
  const glyph = icon ?? '‹';
  if (inline) {
    return (
      <button type="button" className="gameplay__backBtn" onClick={onClick} title={title} aria-label={title}>
        {glyph}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      style={{
        position: 'fixed',
        top: 12,
        left: 12,
        zIndex: 5,
        width: 40,
        height: 40,
        borderRadius: '50%',
        border: 'none',
        background: 'rgba(0,0,0,0.4)',
        color: '#fff',
        fontSize: 20,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
      }}
      aria-label={title}
    >
      {glyph}
    </button>
  );
}
