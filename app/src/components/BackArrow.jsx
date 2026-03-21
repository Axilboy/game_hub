/** Стрелка «Назад». `inline` — в шапке игры (не fixed), иначе плавающая кнопка для экранов без topbar. */
export default function BackArrow({ onClick, title = 'Назад', inline = false }) {
  if (!onClick) return null;
  if (inline) {
    return (
      <button type="button" className="gameplay__backBtn" onClick={onClick} title={title} aria-label={title}>
        ‹
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
      ‹
    </button>
  );
}
