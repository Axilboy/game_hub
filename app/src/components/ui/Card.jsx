export default function Card({ children, style, className }) {
  return (
    <div
      className={className || 'gh-card'}
      style={{
        padding: 'var(--gh-space-4, 16px)',
        background: 'var(--gh-surface, rgba(255,255,255,0.06))',
        border: '1px solid var(--gh-border, rgba(255,255,255,0.12))',
        borderRadius: 'var(--gh-radius, 12px)',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

