export default function Button({
  children,
  onClick,
  type = 'button',
  disabled,
  variant = 'primary',
  fullWidth = false,
  style,
  className,
  title,
}) {
  const variantClass = {
    primary: 'gh-btn',
    secondary: 'gh-btn gh-btn--muted',
    danger: 'gh-btn gh-btn--danger',
    ghost: 'gh-btn gh-btn--ghost',
  };

  const mergedClass = [variantClass[variant] || 'gh-btn', className].filter(Boolean).join(' ');

  const mergedStyle = {
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1,
    width: fullWidth ? '100%' : undefined,
    ...style,
  };

  return (
    <button
      type={type}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      title={title}
      className={mergedClass}
      style={mergedStyle}
    >
      {children}
    </button>
  );
}
