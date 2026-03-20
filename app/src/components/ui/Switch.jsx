export default function Switch({ checked, onChange, label, disabled = false }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 10, opacity: disabled ? 0.65 : 1 }}>
      <button
        type="button"
        disabled={disabled}
        aria-pressed={checked}
        onClick={() => onChange?.(!checked)}
        style={{
          width: 44,
          height: 26,
          borderRadius: 999,
          border: '1px solid var(--gh-border, rgba(255,255,255,0.2))',
          background: checked ? 'var(--gh-color-primary, #3a7bd5)' : 'rgba(255,255,255,0.14)',
          position: 'relative',
          cursor: disabled ? 'not-allowed' : 'pointer',
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: 2,
            left: checked ? 20 : 2,
            width: 20,
            height: 20,
            borderRadius: '50%',
            background: '#fff',
            transition: 'left .18s ease',
          }}
        />
      </button>
      {label ? <span style={{ fontSize: 14 }}>{label}</span> : null}
    </label>
  );
}

