import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useSeo from '../hooks/useSeo';
import { api } from '../api';
import { getStats } from '../stats';
import { getInventory } from '../inventory';
import { getDisplayName, getAvatar } from '../displayName';
import BackArrow from '../components/BackArrow';
import Button from '../components/ui/Button';

const THEMES = [
  { id: 'dark', label: 'Тёмная (Telegram)' },
  { id: 'light', label: 'Светлая' },
];

function applyTheme(id) {
  const v = id === 'light' ? 'light' : 'dark';
  document.documentElement.dataset.theme = v;
  try {
    localStorage.setItem('gh_theme', v);
  } catch (_) {}
}

export default function Profile({ user }) {
  const navigate = useNavigate();
  const baseUrl = import.meta.env.VITE_BASE_URL || (typeof window !== 'undefined' ? window.location.origin : '');
  const canonical = baseUrl ? `${baseUrl.replace(/\/$/, '')}/profile` : undefined;

  useSeo({
    title: 'Профиль — GameHub',
    description: 'Имя, статистика, подписка Про и настройки темы.',
    canonical,
    robots: 'noindex, nofollow',
  });

  const [pub, setPub] = useState(null);
  const [local, setLocal] = useState(getStats);
  const [inv] = useState(getInventory);
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('gh_theme') === 'light' ? 'light' : 'dark';
    } catch (_) {
      return 'dark';
    }
  });

  useEffect(() => {
    api
      .get('/stats/public')
      .then(setPub)
      .catch(() => setPub(null));
  }, []);

  useEffect(() => {
    setLocal(getStats());
  }, []);

  const gamesPlayed = local.gamesPlayed ?? 0;
  const name = getDisplayName() || user?.first_name || 'Игрок';
  const avatar = getAvatar();

  const achievements = [
    { id: 'first', label: 'Первый визит', done: Boolean(local.firstVisitAt) },
    { id: 'player', label: '10+ игр', done: gamesPlayed >= 10 },
    { id: 'veteran', label: '50+ игр', done: gamesPlayed >= 50 },
  ];

  return (
    <div className="gh-page gh-fade-in">
      <BackArrow onClick={() => navigate(-1)} title="Назад" />
      <header className="gh-card" style={{ padding: 14, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {avatar ? (
            <div style={{ fontSize: 36, lineHeight: 1 }}>{avatar}</div>
          ) : user?.photo_url ? (
            <img src={user.photo_url} alt="" style={{ width: 52, height: 52, borderRadius: '50%' }} />
          ) : (
            <div style={{ fontSize: 36, lineHeight: 1 }}>👤</div>
          )}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 18 }}>{name}</div>
            <div style={{ fontSize: 14, opacity: 0.85, marginTop: 4 }}>
              {inv.hasPro ? 'Про активна' : 'Без подписки Про'}
            </div>
          </div>
        </div>
      </header>

      <section className="gh-card" style={{ padding: 14, marginBottom: 16 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Статистика устройства</div>
        <div style={{ fontSize: 14, opacity: 0.9 }}>Сыграно игр (локально): <strong>{gamesPlayed}</strong></div>
        <div style={{ fontSize: 14, opacity: 0.9, marginTop: 6 }}>Время в приложении: <strong>{Math.round((local.totalTimeSpent || 0) / 60)}</strong> мин</div>
      </section>

      <section className="gh-card" style={{ padding: 14, marginBottom: 16 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Сообщество сегодня</div>
        <p style={{ fontSize: 12, opacity: 0.8, marginTop: 0 }}>Обезличенные счётчики с сервера</p>
        {pub ? (
          <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7, fontSize: 14 }}>
            <li>Уникальных игроков за сутки: <strong>{pub.playersToday ?? '—'}</strong></li>
            <li>Стартов игр сегодня: <strong>{pub.gamesStartedToday ?? '—'}</strong></li>
            <li>Завершённых показов рекламы за сутки: <strong>{pub.adCompletedToday ?? '—'}</strong></li>
          </ul>
        ) : (
          <div style={{ fontSize: 14, opacity: 0.8 }}>Нет данных</div>
        )}
      </section>

      <section className="gh-card" style={{ padding: 14, marginBottom: 16 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Достижения</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {achievements.map((a) => (
            <div
              key={a.id}
              style={{
                padding: 10,
                borderRadius: 8,
                background: a.done ? 'rgba(80,160,80,0.2)' : 'rgba(255,255,255,0.05)',
                fontSize: 14,
              }}
            >
              {a.done ? '✓' : '○'} {a.label}
            </div>
          ))}
        </div>
      </section>

      <section className="gh-card" style={{ padding: 14, marginBottom: 16 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Тема интерфейса</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {THEMES.map((t) => (
            <Button
              key={t.id}
              type="button"
              variant={theme === t.id ? 'primary' : 'secondary'}
              onClick={() => {
                setTheme(t.id);
                applyTheme(t.id);
              }}
            >
              {t.label}
            </Button>
          ))}
        </div>
      </section>

      <Button variant="secondary" fullWidth onClick={() => navigate('/')}>
        На главную
      </Button>
    </div>
  );
}
