export default function Card({ children, style, className }) {
  return (
    <div
      className={className}
      style={{
        padding: 16,
        background: 'rgba(255,255,255,0.06)',
        borderRadius: 12,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

