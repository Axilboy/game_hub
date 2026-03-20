export default function Tooltip({ text, children }) {
  return (
    <span title={text} style={{ display: 'inline-flex', alignItems: 'center' }}>
      {children}
    </span>
  );
}

