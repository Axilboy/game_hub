import Button from './Button';

export default function ErrorState({ title = 'Ошибка', message, actionLabel, onAction }) {
  return (
    <div className="gh-card" style={{ padding: 18, textAlign: 'center' }}>
      <p style={{ marginTop: 0, marginBottom: 10, fontWeight: 700 }}>{title}</p>
      {message ? <p style={{ marginTop: 0, marginBottom: 14, opacity: 0.9 }}>{message}</p> : null}
      {actionLabel && onAction ? (
        <Button variant="secondary" fullWidth onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}

