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
  const background =
    variant === 'primary'
      ? 'var(--tg-theme-button-color, #3a7bd5)'
      : variant === 'secondary'
        ? '#444'
        : variant === 'danger'
          ? '#a44'
          : variant === 'ghost'
            ? 'transparent'
            : 'var(--tg-theme-button-color, #3a7bd5)';

  const color =
    variant === 'ghost'
      ? 'var(--tg-theme-button-text-color, #fff)'
      : 'var(--tg-theme-button-text-color, #fff)';

  const mergedStyle = {
    padding: '12px 20px',
    fontSize: 16,
    borderRadius: 8,
    border: 'none',
    background,
    color,
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
      className={className}
      style={mergedStyle}
    >
      {children}
    </button>
  );
}

