import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ErrorBoundary from './ErrorBoundary';
import { registerPwa } from './registerPwa';
import './index.css';
import { applyTheme, resolveInitialTheme } from './theme';

registerPwa();

try {
  applyTheme(resolveInitialTheme());
  const d = localStorage.getItem('gh_density');
  document.documentElement.dataset.density = d === 'compact' ? 'compact' : 'default';
} catch (_) {}

const rootEl = document.getElementById('root');
if (!rootEl) {
  document.body.innerHTML = '<p style="padding:24px;color:#e88;font-family:system-ui">Ошибка: нет #root</p>';
} else {
  try {
    ReactDOM.createRoot(rootEl).render(
      <React.StrictMode>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </React.StrictMode>
    );
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[GameHub boot]', e);
    rootEl.innerHTML = `<div style="padding:24px;color:#eaa;font-family:system-ui;max-width:420px;margin:0 auto;line-height:1.5">
      <strong>Не удалось запустить приложение.</strong><br/><br/>
      Обновите страницу с полным сбросом кэша (Ctrl+F5). Если не помогло — откройте сайт в другом браузере или в режиме инкогнито.
    </div>`;
  }
}
