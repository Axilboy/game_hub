export default function Segmented({ value, onChange, options = [], size = 'md' }) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange?.(opt.value)}
            className="gh-btn"
            style={{
              width: 'auto',
              padding: size === 'sm' ? '8px 12px' : '10px 14px',
              fontSize: size === 'sm' ? 13 : 14,
              background: active ? 'var(--gh-color-primary, #3a7bd5)' : 'var(--gh-color-muted, #555)',
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

