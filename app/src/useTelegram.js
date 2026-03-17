import { useState, useEffect } from 'react';

export function useTelegram() {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (tg) {
      tg.ready();
      tg.expand();
      const u = tg.initDataUnsafe?.user;
      if (u) {
        setUser({
          id: u.id,
          first_name: u.first_name,
          last_name: u.last_name,
          username: u.username,
        });
      } else {
        setUser({ id: 'dev', first_name: 'Тест' });
      }
    } else {
      setUser({ id: 'dev', first_name: 'Тест' });
    }
    setReady(true);
  }, []);

  return { user, ready };
}
