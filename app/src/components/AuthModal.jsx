import { useState } from 'react';
import Modal from './ui/Modal';
import { useAuth } from '../authContext';
import { getTelegramBotUrl } from '../account';
import Button from './ui/Button';

/**
 * Регистрация по почте / вход. Для гостей браузера — из шапки.
 */
export default function AuthModal() {
  const { authModalOpen, closeAuthModal, login, register, authBusy } = useAuth();
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [formError, setFormError] = useState('');

  const botUrl = getTelegramBotUrl();

  const onSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!email.trim() || !password) {
      setFormError('Введите email и пароль');
      return;
    }
    if (mode === 'register') {
      const r = await register(email.trim(), password, displayName.trim());
      if (!r.ok) setFormError(r.error || 'Ошибка');
      return;
    }
    const r = await login(email.trim(), password);
    if (!r.ok) setFormError(r.error || 'Ошибка');
  };

  return (
    <Modal open={authModalOpen} onClose={closeAuthModal} title="Вход и регистрация" width={420}>
      <p style={{ marginTop: 0, fontSize: 13, opacity: 0.9, lineHeight: 1.5 }}>
        Без входа вы можете играть в комнатах, но{' '}
        <strong>друзья, магазин и премиум</strong> доступны после регистрации по почте или при открытии приложения в
        Telegram.
      </p>

      {botUrl ? (
        <a
          href={botUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="gh-btn gh-btn--primary"
          style={{
            display: 'block',
            textAlign: 'center',
            textDecoration: 'none',
            borderRadius: 10,
            padding: '10px 14px',
            marginBottom: 16,
          }}
        >
          Войти через Telegram (открыть бота)
        </a>
      ) : null}

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button
          type="button"
          className={`gh-btn gh-btn--compact ${mode === 'login' ? 'gh-btn--primary' : 'gh-btn--muted'}`}
          onClick={() => {
            setMode('login');
            setFormError('');
          }}
        >
          Вход
        </button>
        <button
          type="button"
          className={`gh-btn gh-btn--compact ${mode === 'register' ? 'gh-btn--primary' : 'gh-btn--muted'}`}
          onClick={() => {
            setMode('register');
            setFormError('');
          }}
        >
          Регистрация
        </button>
      </div>

      <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <label style={{ fontSize: 13, opacity: 0.9 }}>
          Email
          <input
            type="email"
            className="gh-input gh-input--full"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ marginTop: 4 }}
          />
        </label>
        <label style={{ fontSize: 13, opacity: 0.9 }}>
          Пароль (не короче 8 символов)
          <input
            type="password"
            className="gh-input gh-input--full"
            autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ marginTop: 4 }}
          />
        </label>
        {mode === 'register' ? (
          <label style={{ fontSize: 13, opacity: 0.9 }}>
            Имя в игре (необязательно)
            <input
              type="text"
              className="gh-input gh-input--full"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value.slice(0, 80))}
              style={{ marginTop: 4 }}
            />
          </label>
        ) : null}
        {formError ? (
          <p style={{ margin: 0, fontSize: 13, color: 'var(--gh-danger, #f87171)' }}>{formError}</p>
        ) : null}
        <Button variant="primary" fullWidth type="submit" disabled={authBusy}>
          {authBusy ? '…' : mode === 'register' ? 'Зарегистрироваться' : 'Войти'}
        </Button>
      </form>
    </Modal>
  );
}
