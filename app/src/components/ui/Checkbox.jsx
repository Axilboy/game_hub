export default function Checkbox({ checked, onChange, label, disabled = false }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.65 : 1 }}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.checked)}
      />
      {label ? <span style={{ fontSize: 14 }}>{label}</span> : null}
    </label>
  );
}

