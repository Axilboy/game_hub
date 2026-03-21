import { useCallback, useEffect, useState } from 'react';
import { applyTheme, getDocumentTheme } from '../../theme';

export default function ThemeToggle() {
  const [mode, setMode] = useState(getDocumentTheme);

  useEffect(() => {
    const onChange = () => setMode(getDocumentTheme());
    window.addEventListener('gh-theme-change', onChange);
    return () => window.removeEventListener('gh-theme-change', onChange);
  }, []);

  const toggle = useCallback(() => {
    const next = mode === 'light' ? 'dark' : 'light';
    applyTheme(next);
    setMode(next);
  }, [mode]);

  const isLight = mode === 'light';

  return (
    <button
      type="button"
      className="gh-theme-toggle"
      onClick={toggle}
      aria-label={isLight ? 'Включить тёмную тему' : 'Включить светлую тему'}
      title={isLight ? 'Тёмная тема' : 'Светлая тема'}
    >
      {isLight ? '🌙' : '☀️'}
    </button>
  );
}
