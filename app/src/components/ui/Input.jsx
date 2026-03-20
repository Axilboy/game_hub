export default function Input({
  value,
  onChange,
  placeholder,
  type = 'text',
  className = '',
  style,
  disabled = false,
  fullWidth = true,
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      className={`gh-input ${fullWidth ? 'gh-input--full' : ''} ${className}`.trim()}
      style={style}
    />
  );
}

