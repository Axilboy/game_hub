import { useState, useEffect } from 'react';

const WEB_NAMES = [
  'Весёлые Плясуны',
  'Жопокрылые Барабашки',
  'Пьяные Финтиплюшки',
  'Сонный Пельмень',
  'Шустрый Енот',
  'Кислый Огурчик',
  'Плюшевый Дирижабль',
  'Танцующий Крендель',
  'Бодрый Бублик',
  'Туманный Сырник',
  'Озорной Котлета',
  'Быстрый Вареник',
  'Ленивый Багель',
  'Хрустящий Крендель',
];

function pickWebName() {
  return WEB_NAMES[Math.floor(Math.random() * WEB_NAMES.length)];
}

export function useTelegram() {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const tg = window.Telegram?.WebApp;
      if (tg) {
        try {
          tg.ready();
        } catch (_) {}
        try {
          tg.expand();
        } catch (_) {}
        const u = tg.initDataUnsafe?.user;
        if (u) {
          setUser({
            id: u.id,
            first_name: u.first_name,
            last_name: u.last_name,
            username: u.username,
            photo_url: u.photo_url,
          });
        } else {
          setUser({ id: `web_${Math.random().toString(36).slice(2, 9)}`, first_name: pickWebName() });
        }
      } else {
        setUser({ id: `web_${Math.random().toString(36).slice(2, 9)}`, first_name: pickWebName() });
      }
    } catch (_) {
      setUser({ id: `web_${Math.random().toString(36).slice(2, 9)}`, first_name: pickWebName() });
    } finally {
      setReady(true);
    }
  }, []);

  return { user, ready };
}
