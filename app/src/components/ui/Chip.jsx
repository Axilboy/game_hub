export default function Chip({ children, active = false, onClick, disabled = false, title }) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      style={{
        width: 'auto',
        padding: '6px 10px',
        borderRadius: 999,
        border: '1px solid var(--gh-border, rgba(255,255,255,0.2))',
        background: active ? 'rgba(58,123,213,0.22)' : 'rgba(255,255,255,0.06)',
        color: 'inherit',
        fontSize: 12,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {children}
    </button>
  );
}

