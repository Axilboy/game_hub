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
      ? 'var(--gh-color-primary, var(--tg-theme-button-color, #3a7bd5))'
      : variant === 'secondary'
        ? 'var(--gh-color-muted, #555)'
        : variant === 'danger'
          ? 'var(--gh-color-danger, #a44)'
          : variant === 'ghost'
            ? 'transparent'
            : 'var(--gh-color-primary, var(--tg-theme-button-color, #3a7bd5))';

  const color =
    variant === 'ghost'
      ? 'var(--tg-theme-button-text-color, #fff)'
      : 'var(--tg-theme-button-text-color, #fff)';

  const mergedStyle = {
    padding: 'var(--gh-space-3, 12px) var(--gh-space-5, 20px)',
    fontSize: 'var(--gh-font-size-md, 16px)',
    borderRadius: 'var(--gh-radius-sm, 8px)',
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

