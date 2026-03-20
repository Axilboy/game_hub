export default function IconButton({ icon = '•', label, onClick, disabled = false, size = 36 }) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      aria-label={label || 'icon button'}
      title={label}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        border: '1px solid var(--gh-border, rgba(255,255,255,0.2))',
        background: 'rgba(255,255,255,0.08)',
        color: 'inherit',
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {icon}
    </button>
  );
}

