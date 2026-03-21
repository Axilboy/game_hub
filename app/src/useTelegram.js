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

const WEB_PLAYER_ID_KEY = 'gameHub_webPlayerId';
const WEB_NAME_KEY = 'gameHub_webDisplayName';

function getOrCreateWebIdentity() {
  try {
    let id = localStorage.getItem(WEB_PLAYER_ID_KEY);
    if (!id || !String(id).startsWith('web_')) {
      id = `web_${Math.random().toString(36).slice(2, 9)}`;
      localStorage.setItem(WEB_PLAYER_ID_KEY, id);
    }
    let name = localStorage.getItem(WEB_NAME_KEY);
    if (!name) {
      name = pickWebName();
      localStorage.setItem(WEB_NAME_KEY, name);
    }
    return { id, first_name: name };
  } catch {
    return { id: `web_${Math.random().toString(36).slice(2, 9)}`, first_name: pickWebName() };
  }
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
          setUser(getOrCreateWebIdentity());
        }
      } else {
        setUser(getOrCreateWebIdentity());
      }
    } catch (_) {
      setUser(getOrCreateWebIdentity());
    } finally {
      setReady(true);
    }
  }, []);

  return { user, ready };
}
