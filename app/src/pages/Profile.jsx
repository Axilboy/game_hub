import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useSeo from '../hooks/useSeo';
import { api } from '../api';
import { getLevelProgress, getStats } from '../stats';
import { getInventory } from '../inventory';
import { AVATAR_EMOJI_LIST, getAvatar, getDisplayName, getProfilePhoto, setAvatar, setDisplayName, setProfilePhoto } from '../displayName';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import EmptyState from '../components/ui/EmptyState';
import Chip from '../components/ui/Chip';
import Segmented from '../components/ui/Segmented';
import { getFunnelSummary } from '../analytics';
import { PRO_VALUE_MATRIX } from '../proValueMatrix';
import PageLayout from '../components/layout/PageLayout';

const THEMES = [
  { id: 'dark', label: 'Тёмная (Telegram)' },
  { id: 'light', label: 'Светлая' },
];
const DENSITIES = [
  { id: 'default', label: 'Обычная' },
  { id: 'compact', label: 'Компактная' },
];

const GAME_LABELS = {
  spy: 'Шпион',
  mafia: 'Мафия',
  elias: 'Элиас',
  truth_dare: 'Правда/Действие',
  bunker: 'Бункер',
  unknown: 'Другое',
};

function applyTheme(id) {
  const v = id === 'light' ? 'light' : 'dark';
  document.documentElement.dataset.theme = v;
  try {
    localStorage.setItem('gh_theme', v);
  } catch (_) {}
}

function applyDensity(id) {
  const v = id === 'compact' ? 'compact' : 'default';
  document.documentElement.dataset.density = v;
  try {
    localStorage.setItem('gh_density', v);
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
  const [density, setDensity] = useState(() => {
    try {
      return localStorage.getItem('gh_density') === 'compact' ? 'compact' : 'default';
    } catch (_) {
      return 'default';
    }
  });
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [photo, setPhoto] = useState(() => getProfilePhoto());

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
  useEffect(() => {
    setNameDraft(getDisplayName() || user?.first_name || 'Игрок');
  }, [user?.first_name]);

  const gamesPlayed = local.gamesPlayed ?? 0;
  const level = getLevelProgress(local);
  const name = getDisplayName() || user?.first_name || 'Игрок';
  const avatar = getAvatar();
  const topGameKey = Object.entries(local.gamesByType || {}).sort((a, b) => (b[1] || 0) - (a[1] || 0))[0]?.[0] || '—';
  const topGame = GAME_LABELS[topGameKey] || topGameKey;
  const bestGameRecord = Object.entries(local.gamesByType || {}).sort((a, b) => (b[1] || 0) - (a[1] || 0))[0];
  const totalMins = Math.round((local.totalTimeSpent || 0) / 60);
  const currentStreak = local.currentStreak || 0;
  const bestStreak = local.bestStreak || 0;
  const weeklyGamesGoal = 12;
  const weeklyMinutesGoal = 90;
  const weeklyGamesProgress = Math.min(100, Math.round((gamesPlayed / Math.max(1, weeklyGamesGoal)) * 100));
  const weeklyMinutesProgress = Math.min(100, Math.round((totalMins / Math.max(1, weeklyMinutesGoal)) * 100));
  const profileCardText =
    `GameHub профайл: ${name}\n` +
    `Уровень: ${level.level}\n` +
    `Сыграно матчей: ${gamesPlayed}\n` +
    `Любимая игра: ${topGame}\n` +
    `Streak: ${currentStreak} (рекорд ${bestStreak})\n` +
    `Про: ${inv.hasPro ? 'да' : 'нет'}`;

  const saveName = () => {
    const v = String(nameDraft || '').trim();
    setDisplayName(v);
    setNameDraft(v || (user?.first_name || 'Игрок'));
  };

  const onUploadPhoto = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result || '');
      setProfilePhoto(url);
      setPhoto(url);
    };
    reader.readAsDataURL(f);
  };

  const exportProfileCard = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Моя карточка GameHub',
          text: profileCardText,
        });
        return;
      }
    } catch (_) {}
    try {
      await navigator.clipboard.writeText(profileCardText);
      alert('Карточка профиля скопирована в буфер обмена');
    } catch (_) {
      alert(profileCardText);
    }
  };

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
    <PageLayout
      title="Профиль"
      onBack={() => navigate(-1)}
      stickyBottom={(
        <Button variant="secondary" fullWidth onClick={() => navigate('/')}>
          На главную
        </Button>
      )}
    >
      <header className="gh-card" style={{ padding: 14, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {avatar ? (
            <div style={{ fontSize: 36, lineHeight: 1 }}>{avatar}</div>
          ) : photo ? (
            <img src={photo} alt="" style={{ width: 52, height: 52, borderRadius: '50%', objectFit: 'cover' }} />
          ) : user?.photo_url ? (
            <img src={user.photo_url} alt="" style={{ width: 52, height: 52, borderRadius: '50%' }} />
          ) : (
            <div style={{ fontSize: 36, lineHeight: 1 }}>👤</div>
          )}
          <div style={{ minWidth: 0 }}>
            {editingName ? (
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  className="gh-input gh-input--full"
                  style={{ maxWidth: 220 }}
                />
                <Button variant="secondary" onClick={() => { saveName(); setEditingName(false); }} style={{ padding: '6px 10px' }}>
                  OK
                </Button>
              </div>
            ) : (
              <div style={{ fontWeight: 800, fontSize: 18 }}>{name}</div>
            )}
            <div style={{ fontSize: 14, opacity: 0.85, marginTop: 4 }}>
              {inv.hasPro ? <Badge tone="success">Про активна</Badge> : <Badge>Без Про</Badge>}
            </div>
          </div>
        </div>
        <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <Button variant="secondary" onClick={() => setEditingName((v) => !v)} style={{ padding: '8px 10px' }}>
            {editingName ? 'Отмена' : 'Изменить имя'}
          </Button>
          <label className="gh-btn gh-btn--muted" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}>
            Загрузить фото
            <input type="file" accept="image/*" onChange={onUploadPhoto} style={{ display: 'none' }} />
          </label>
          <Button variant="secondary" onClick={() => { setProfilePhoto(''); setPhoto(null); }} style={{ padding: '8px 10px' }}>
            Сброс фото
          </Button>
        </div>
        <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {AVATAR_EMOJI_LIST.slice(0, 12).map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => setAvatar(e)}
              style={{ border: 'none', borderRadius: 8, padding: '6px 8px', cursor: 'pointer', background: avatar === e ? 'rgba(90,160,90,0.35)' : 'rgba(255,255,255,0.08)' }}
            >
              {e}
            </button>
          ))}
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
        <div style={{ fontSize: 14, opacity: 0.9, marginTop: 6 }}>Время в приложении: <strong>{totalMins}</strong> мин</div>
        <div style={{ fontSize: 14, opacity: 0.9, marginTop: 6 }}>Любимая игра: <strong>{topGame}</strong></div>
        <div style={{ fontSize: 14, opacity: 0.9, marginTop: 6 }}>Streak: <strong>{currentStreak}</strong> дн. · Рекорд: <strong>{bestStreak}</strong> дн.</div>
      </section>

      <section className="gh-card" style={{ padding: 14, marginBottom: 16 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Цели недели</div>
        <div style={{ fontSize: 14, opacity: 0.9, marginBottom: 6 }}>
          Сыграть {weeklyGamesGoal} матчей: <strong>{gamesPlayed}/{weeklyGamesGoal}</strong>
        </div>
        <div style={{ width: '100%', height: 8, borderRadius: 999, background: 'rgba(255,255,255,0.1)', overflow: 'hidden', marginBottom: 10 }}>
          <div style={{ width: `${weeklyGamesProgress}%`, height: '100%', background: 'var(--tg-theme-button-color, #3a7bd5)' }} />
        </div>
        <div style={{ fontSize: 14, opacity: 0.9, marginBottom: 6 }}>
          Провести {weeklyMinutesGoal} минут в игре: <strong>{totalMins}/{weeklyMinutesGoal}</strong>
        </div>
        <div style={{ width: '100%', height: 8, borderRadius: 999, background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
          <div style={{ width: `${weeklyMinutesProgress}%`, height: '100%', background: 'var(--tg-theme-button-color, #3a7bd5)' }} />
        </div>
      </section>

      <section className="gh-card" style={{ padding: 14, marginBottom: 16 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Рекорды и история</div>
        <div style={{ fontSize: 14, opacity: 0.92 }}>
          Лучший режим: <strong>{bestGameRecord ? `${GAME_LABELS[bestGameRecord[0]] || bestGameRecord[0]} (${bestGameRecord[1]})` : '—'}</strong>
        </div>
        <div style={{ fontSize: 14, opacity: 0.92, marginTop: 6 }}>
          Последняя игра: <strong>{GAME_LABELS[local.lastPlayedGame] || local.lastPlayedGame || '—'}</strong>
        </div>
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {Object.entries(local.gamesByType || {})
            .sort((a, b) => (b[1] || 0) - (a[1] || 0))
            .slice(0, 6)
            .map(([k, v]) => (
              <div key={k} style={{ fontSize: 13, opacity: 0.9 }}>
                {GAME_LABELS[k] || k}: <strong>{v}</strong>
              </div>
            ))}
          {Object.keys(local.gamesByType || {}).length === 0 && (
            <div style={{ fontSize: 13, opacity: 0.8 }}>История матчей пока пустая.</div>
          )}
        </div>
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
          <EmptyState title="Нет данных" message="Серверная статистика временно недоступна." />
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
        <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Chip active>Уровень {level.level}</Chip>
          <Chip active={inv.hasPro}>Про</Chip>
          <Chip>{topGame === '—' ? 'Без любимой игры' : `Любимая: ${topGame}`}</Chip>
          <Chip active={currentStreak >= 3}>Серия {currentStreak} дн.</Chip>
          <Chip active={gamesPlayed >= 50}>50+ матчей</Chip>
        </div>
        <div style={{ marginTop: 10 }}>
          <Button variant="secondary" fullWidth onClick={exportProfileCard}>
            Экспорт карточки профиля
          </Button>
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
        <div style={{ fontSize: 13, opacity: 0.85, marginTop: 8 }}>
          Инвайт-шеры: <strong>{funnel.inviteShares || 0}</strong> (TG: {funnel.inviteShareTelegram || 0}, буфер: {funnel.inviteShareClipboard || 0})
        </div>
        <div style={{ fontSize: 13, opacity: 0.85, marginTop: 4 }}>
          Магазин CTR: <strong>{funnel.storeCtr || 0}%</strong> · API ошибок: <strong>{funnel.apiErrors || 0}</strong> · timeout: <strong>{funnel.apiTimeouts || 0}</strong>
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
        <Segmented
          value={theme}
          onChange={(id) => {
            setTheme(id);
            applyTheme(id);
          }}
          options={THEMES.map((t) => ({ value: t.id, label: t.label }))}
        />
        <div style={{ fontWeight: 700, marginTop: 12, marginBottom: 8 }}>Плотность интерфейса</div>
        <Segmented
          value={density}
          onChange={(id) => {
            setDensity(id);
            applyDensity(id);
          }}
          options={DENSITIES.map((d) => ({ value: d.id, label: d.label }))}
        />
      </section>
    </PageLayout>
  );
}
