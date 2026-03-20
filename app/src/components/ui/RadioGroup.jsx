export default function RadioGroup({ value, onChange, options = [], name = 'radio' }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {options.map((opt) => (
        <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <input
            type="radio"
            name={name}
            value={opt.value}
            checked={value === opt.value}
            onChange={() => onChange?.(opt.value)}
          />
          <span style={{ fontSize: 14 }}>{opt.label}</span>
        </label>
      ))}
    </div>
  );
}

