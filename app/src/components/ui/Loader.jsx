export default function Loader({ label = 'Загрузка…', minHeight = '40vh' }) {
  return (
    <div
      className="gh-card"
      style={{
        minHeight,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        padding: 18,
      }}
    >
      <span
        style={{
          width: 14,
          height: 14,
          borderRadius: '50%',
          background: 'var(--tg-theme-button-color, #3a7bd5)',
          display: 'inline-block',
          boxShadow: '0 0 0 6px rgba(58,123,213,0.2)',
        }}
      />
      <span style={{ opacity: 0.92 }}>{label}</span>
    </div>
  );
}

