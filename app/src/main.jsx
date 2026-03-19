import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

try {
  const t = localStorage.getItem('gh_theme');
  if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
} catch (_) {}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
