export default function Select({
  value,
  onChange,
  options = [],
  className = '',
  style,
  disabled = false,
  'aria-label': ariaLabel,
  ...rest
}) {
  return (
    <select
      value={value}
      onChange={onChange}
      disabled={disabled}
      className={`gh-input gh-input--full ${className}`.trim()}
      style={style}
      aria-label={ariaLabel}
      {...rest}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

