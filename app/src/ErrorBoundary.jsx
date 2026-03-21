import React from 'react';

/**
 * Ловит падения React при рендере, чтобы не оставлять пустой экран без объяснения.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { err: null };
  }

  static getDerivedStateFromError(err) {
    return { err };
  }

  componentDidCatch(err, info) {
    // eslint-disable-next-line no-console
    console.error('[GameHub]', err, info?.componentStack);
  }

  render() {
    if (this.state.err) {
      return (
        <div style={{ padding: 24, maxWidth: 420, margin: '48px auto', fontFamily: 'system-ui, sans-serif' }}>
          <h1 style={{ fontSize: 18, marginBottom: 12 }}>Что-то пошло не так</h1>
          <p style={{ opacity: 0.88, lineHeight: 1.5, marginBottom: 16 }}>
            Обновите страницу. Если ошибка повторяется — напишите через форму обратной связи (когда она снова откроется).
          </p>
          <button
            type="button"
            style={{
              padding: '12px 20px',
              borderRadius: 10,
              border: 'none',
              background: '#3a7bd5',
              color: '#fff',
              cursor: 'pointer',
              fontSize: 16,
            }}
            onClick={() => window.location.reload()}
          >
            Обновить страницу
          </button>
          {import.meta.env.DEV ? (
            <pre style={{ marginTop: 16, fontSize: 11, opacity: 0.75, whiteSpace: 'pre-wrap' }}>
              {String(this.state.err?.message || this.state.err)}
            </pre>
          ) : null}
        </div>
      );
    }
    return this.props.children;
  }
}
