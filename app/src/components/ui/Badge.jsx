export default function Badge({ children, tone = 'default' }) {
  const bg =
    tone === 'success'
      ? 'rgba(90,164,70,0.25)'
      : tone === 'danger'
        ? 'rgba(170,68,68,0.25)'
        : tone === 'warning'
          ? 'rgba(176,122,27,0.25)'
          : tone === 'info'
            ? 'rgba(69,119,187,0.25)'
            : 'rgba(255,255,255,0.12)';
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '3px 8px',
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 700,
        background: bg,
      }}
    >
      {children}
    </span>
  );
}

