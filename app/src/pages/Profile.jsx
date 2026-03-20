import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useSeo from '../hooks/useSeo';
import { api } from '../api';
import { getLevelProgress, getStats } from '../stats';
import { getInventory } from '../inventory';
import { getDisplayName, getAvatar } from '../displayName';
import BackArrow from '../components/BackArrow';
import Button from '../components/ui/Button';
import { getFunnelSummary } from '../analytics';
import { PRO_VALUE_MATRIX } from '../proValueMatrix';

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
  const [funnel, setFunnel] = useState(getFunnelSummary);
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
    setFunnel(getFunnelSummary());
  }, []);

  const gamesPlayed = local.gamesPlayed ?? 0;
  const level = getLevelProgress(local);
  const name = getDisplayName() || user?.first_name || 'Игрок';
  const avatar = getAvatar();
  const topGame = Object.entries(local.gamesByType || {}).sort((a, b) => (b[1] || 0) - (a[1] || 0))[0]?.[0] || '—';

  const achievements = [
    { id: 'first', label: 'Первый визит', done: Boolean(local.firstVisitAt) },
    { id: 'player10', label: '10+ игр', done: gamesPlayed >= 10 },
    { id: 'player25', label: '25+ игр', done: gamesPlayed >= 25 },
    { id: 'player50', label: '50+ игр', done: gamesPlayed >= 50 },
    { id: 'player100', label: '100+ игр', done: gamesPlayed >= 100 },
    { id: 'creator', label: 'Создатель комнат (5+)', done: (funnel.roomCreate || 0) >= 5 },
    { id: 'starter', label: 'Запуск игр (10+)', done: (funnel.gameStart || 0) >= 10 },
    { id: 'finisher', label: 'Завершённые матчи (10+)', done: (funnel.matchCompleted || 0) >= 10 },
    { id: 'pro', label: 'Про активна', done: Boolean(inv.hasPro) },
    { id: 'spy_fan', label: 'Фанат Шпиона (10+)', done: (local.gamesByType?.spy || 0) >= 10 },
    { id: 'mafia_fan', label: 'Фанат Мафии (10+)', done: (local.gamesByType?.mafia || 0) >= 10 },
    { id: 'elias_fan', label: 'Фанат Элиаса (10+)', done: (local.gamesByType?.elias || 0) >= 10 },
    { id: 'td_fan', label: 'Фанат Правда/Действие (10+)', done: (local.gamesByType?.truth_dare || 0) >= 10 },
    { id: 'bunker_fan', label: 'Фанат Бункера (10+)', done: (local.gamesByType?.bunker || 0) >= 10 },
    { id: 'engaged', label: '200+ событий аналитики', done: (funnel.eventsCount || 0) >= 200 },
    { id: 'conversion', label: 'Completion rate 60%+', done: (funnel.completionFromStartRate || 0) >= 60 },
    { id: 'host_master', label: 'Host conversion 60%+', done: (funnel.startFromCreateRate || 0) >= 60 },
    { id: 'time30', label: '30+ минут в приложении', done: ((local.totalTimeSpent || 0) / 60) >= 30 },
    { id: 'time120', label: '120+ минут в приложении', done: ((local.totalTimeSpent || 0) / 60) >= 120 },
    { id: 'collector', label: 'Коллекционер достижений (10+)', done: false },
  ];
  const completedAchievements = achievements.filter((a) => a.done).length;
  const normalizedAchievements = achievements.map((a) => (
    a.id === 'collector' ? { ...a, done: completedAchievements >= 10 } : a
  ));

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
        <div style={{ fontSize: 14, opacity: 0.9, marginBottom: 6 }}>
          Уровень: <strong>{level.level}</strong> · До следующего: <strong>{level.nextLevelIn}</strong> игр
        </div>
        <div style={{ width: '100%', height: 8, borderRadius: 999, background: 'rgba(255,255,255,0.1)', overflow: 'hidden', marginBottom: 8 }}>
          <div style={{ width: `${level.progressPercent}%`, height: '100%', background: 'var(--tg-theme-button-color, #3a7bd5)' }} />
        </div>
        <div style={{ fontSize: 14, opacity: 0.9 }}>Сыграно игр (локально): <strong>{gamesPlayed}</strong></div>
        <div style={{ fontSize: 14, opacity: 0.9, marginTop: 6 }}>Время в приложении: <strong>{Math.round((local.totalTimeSpent || 0) / 60)}</strong> мин</div>
        <div style={{ fontSize: 14, opacity: 0.9, marginTop: 6 }}>Любимая игра: <strong>{topGame}</strong></div>
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
        <p style={{ marginTop: 0, marginBottom: 8, fontSize: 12, opacity: 0.8 }}>
          Выполнено: {normalizedAchievements.filter((a) => a.done).length}/{normalizedAchievements.length}
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {normalizedAchievements.map((a) => (
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
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Аналитика воронки (локально)</div>
        <div style={{ fontSize: 14, opacity: 0.92 }}>Создано комнат: <strong>{funnel.roomCreate}</strong></div>
        <div style={{ fontSize: 14, opacity: 0.92, marginTop: 6 }}>Входов в комнаты: <strong>{funnel.roomJoin}</strong></div>
        <div style={{ fontSize: 14, opacity: 0.92, marginTop: 6 }}>Стартов игр: <strong>{funnel.gameStart}</strong></div>
        <div style={{ fontSize: 14, opacity: 0.92, marginTop: 6 }}>Завершено матчей: <strong>{funnel.matchCompleted}</strong></div>
        <div style={{ fontSize: 13, opacity: 0.85, marginTop: 8 }}>
          Конверсия стартов из созданных: <strong>{funnel.startFromCreateRate}%</strong> ·
          Завершение из стартов: <strong>{funnel.completionFromStartRate}%</strong>
        </div>
      </section>

      <section className="gh-card" style={{ padding: 14, marginBottom: 16 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Матрица ценности Pro</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {PRO_VALUE_MATRIX.map((row) => (
            <div key={row.game} style={{ padding: 10, borderRadius: 8, background: 'rgba(255,255,255,0.05)' }}>
              <div style={{ fontWeight: 700 }}>{row.title}</div>
              <div style={{ fontSize: 12, opacity: 0.85, marginTop: 4 }}>Free: {row.free.join(', ')}</div>
              <div style={{ fontSize: 12, opacity: 0.92, marginTop: 4 }}>Pro: {row.pro.join(', ')}</div>
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
