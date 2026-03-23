import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useSeo from '../hooks/useSeo';
import { api } from '../api';
import BackArrow from '../components/BackArrow';
import SeoFooter from '../components/layout/SeoFooter';
import { useToast } from '../components/ui/ToastProvider';

const ADMIN_PASS_KEY = 'gameHub_adminPass';
const BOT_USERNAME = import.meta.env.VITE_BOT_USERNAME || '';
const APP_LINK = BOT_USERNAME ? `https://t.me/${BOT_USERNAME}` : (import.meta.env.VITE_BASE_URL || window.location.origin);
const API_BASE = (import.meta.env.VITE_API_URL !== undefined && import.meta.env.VITE_API_URL !== '')
  ? import.meta.env.VITE_API_URL
  : (typeof window !== 'undefined' ? window.location.origin : '');

export default function Admin() {
  useSeo({ title: 'Админ — GameHub', robots: 'noindex, nofollow', siteName: 'GameHub' });
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [password, setPassword] = useState(() => sessionStorage.getItem(ADMIN_PASS_KEY) || '');
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');
  const [promoView, setPromoView] = useState(false);
  const [promoType, setPromoType] = useState('day');
  const [createdPromo, setCreatedPromo] = useState(null);
  const [feedbackItems, setFeedbackItems] = useState(null);
  const [feedbackLoading, setFeedbackLoading] = useState(false);

  useEffect(() => {
    if (!password) {
      navigate('/', { replace: true });
      return;
    }
    api.post('/admin/stats', { password })
      .then(setStats)
      .catch(() => setError('Неверный пароль'));
  }, [password, navigate]);

  const loadStats = () => {
    api.post('/admin/stats', { password }).then(setStats).catch(() => setError('Ошибка'));
  };

  const loadFeedback = async () => {
    setFeedbackLoading(true);
    setError('');
    try {
      const r = await api.post('/admin/feedback/list', { password });
      setFeedbackItems(Array.isArray(r.items) ? r.items : []);
    } catch (e) {
      setError(e.message || 'Не удалось загрузить отзывы');
      showToast({ type: 'error', message: 'Ошибка загрузки отзывов' });
    } finally {
      setFeedbackLoading(false);
    }
  };

  const exportFeedbackFile = async () => {
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/admin/feedback/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) throw new Error('export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `gamehub-feedback-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast({ type: 'success', message: 'Файл выгружен' });
    } catch (e) {
      showToast({ type: 'error', message: 'Не удалось выгрузить файл' });
    }
  };

  const createPromo = async () => {
    setError('');
    try {
      const r = await api.post('/admin/promocode', { password, type: promoType });
      setCreatedPromo(r);
    } catch (e) {
      setError(e.message || 'Ошибка');
    }
  };

  const sharePromo = () => {
    const text = `GameHub — промокод на Премиум: ${createdPromo.code}\nПерейди в приложение и введи промокод: ${APP_LINK}`;
    const tg = window.Telegram?.WebApp;
    if (tg?.openTelegramLink) {
      tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(APP_LINK)}&text=${encodeURIComponent('GameHub — промокод на Премиум: ' + createdPromo.code + '\nПерейди в приложение и введи промокод.')}`);
      showToast({ type: 'info', message: 'Выберите чат для отправки' });
    } else {
      navigator.clipboard.writeText(text).then(() => {
        showToast({ type: 'success', message: 'Промокод скопирован' });
      });
    }
  };

  const exitAdmin = () => {
    sessionStorage.removeItem(ADMIN_PASS_KEY);
    navigate('/', { replace: true });
  };

  const renderTopList = (title, arr, valueSuffix = '') => {
    if (!Array.isArray(arr) || arr.length === 0) return null;
    return (
      <section style={{ marginBottom: 16, padding: 14, background: 'rgba(255,255,255,0.06)', borderRadius: 8 }}>
        <p style={{ margin: '0 0 10px', fontWeight: 700 }}>{title}</p>
        {arr.slice(0, 10).map((x) => (
          <div key={x.key} style={{ fontSize: 13, marginBottom: 4 }}>
            <strong>{x.key}</strong>: {x.value}{valueSuffix}
          </div>
        ))}
      </section>
    );
  };

  const buildHealthAlerts = (s) => {
    if (!s) return [];
    const alerts = [];
    const weekSessionsAvg = Math.max(0, Number(s.siteSessionsWeek || 0) / 7);
    const weekVisitorsAvg = Math.max(0, Number(s.siteVisitorsWeek || 0) / 7);
    const sessionsToday = Number(s.siteSessionsToday || 0);
    const visitorsToday = Number(s.siteVisitorsToday || 0);
    const startsToday = Number(s.gamesStartedDay || 0);
    const viewsToday = Number(s.pageViewsToday || 0);
    const adToday = Number(s.adImpressionsDay || 0);

    const startFromSession = sessionsToday > 0 ? startsToday / sessionsToday : 0;
    const viewsPerSession = sessionsToday > 0 ? viewsToday / sessionsToday : 0;
    const adPerStart = startsToday > 0 ? adToday / startsToday : 0;
    const homeDwell = Array.isArray(s.topPageDwell)
      ? Number((s.topPageDwell.find((x) => x.key === '/') || {}).value || 0)
      : 0;

    if (weekSessionsAvg >= 10 && sessionsToday < weekSessionsAvg * 0.6) {
      alerts.push({
        level: 'high',
        text: `Трафик просел: сессии за сутки ${sessionsToday}, среднее за неделю ~${Math.round(weekSessionsAvg)}.`,
        action: 'Проверьте рекламные кампании/UTM и доступность лендингов.',
      });
    }
    if (weekVisitorsAvg >= 10 && visitorsToday < weekVisitorsAvg * 0.6) {
      alerts.push({
        level: 'high',
        text: `Уникальные посетители просели: ${visitorsToday} против недельного среднего ~${Math.round(weekVisitorsAvg)}.`,
        action: 'Проверьте источники трафика и креативы.',
      });
    }
    if (sessionsToday >= 20 && startFromSession < 0.08) {
      alerts.push({
        level: 'high',
        text: `Низкая конверсия в старт игры: ${(startFromSession * 100).toFixed(1)}% от сессий.`,
        action: 'Упростите первый экран и CTA, проверьте скорость загрузки.',
      });
    }
    if (sessionsToday >= 20 && viewsPerSession < 1.2) {
      alerts.push({
        level: 'medium',
        text: `Слабая глубина просмотра: ${viewsPerSession.toFixed(2)} стр./сессию (возможен отвал на входе).`,
        action: 'Проверьте релевантность посадочных страниц и UX первого шага.',
      });
    }
    if (startsToday >= 10 && adPerStart < 0.25) {
      alerts.push({
        level: 'medium',
        text: `Низкий ad-fill proxy: ${(adPerStart * 100).toFixed(0)} показов на 100 стартов игр.`,
        action: 'Проверьте рекламный SDK и сценарии показа перед игрой.',
      });
    }
    if (sessionsToday >= 20 && homeDwell > 0 && homeDwell < 12) {
      alerts.push({
        level: 'medium',
        text: `Низкое время на главной: ~${homeDwell} сек (возможна нерелевантная реклама/трафик).`,
        action: 'Проверьте соответствие объявления и контента главной страницы.',
      });
    }
    return alerts;
  };
  const healthAlerts = buildHealthAlerts(stats);
  const healthHighCount = healthAlerts.filter((a) => a.level === 'high').length;
  const healthMediumCount = healthAlerts.filter((a) => a.level === 'medium').length;

  if (stats === null && !error) return <div style={{ padding: 24 }}>Загрузка…</div>;
  if (error && !stats) {
    return (
      <div style={{ padding: 24 }}>
        <p style={{ color: '#f88' }}>{error}</p>
        <button type="button" onClick={() => navigate('/')} style={btnStyle}>На главную</button>
      </div>
    );
  }

  if (promoView && !createdPromo) {
    return (
      <div style={{ padding: 24, maxWidth: 400, margin: '0 auto' }}>
        <h2 style={{ marginTop: 0 }}>Создать промокод</h2>
        <p style={{ marginBottom: 12 }}>Срок действия:</p>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {['day', 'week', 'month'].map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setPromoType(t)}
              style={{ ...btnStyle, flex: 1, background: promoType === t ? '#5a4' : '#444' }}
            >
              {t === 'day' ? 'День' : t === 'week' ? 'Неделя' : 'Месяц'}
            </button>
          ))}
        </div>
        {error && <p style={{ color: '#f88' }}>{error}</p>}
        <button type="button" onClick={createPromo} style={btnStyle}>Сгенерировать</button>
        <button type="button" onClick={() => { setPromoView(false); setError(''); }} style={{ ...btnStyle, marginTop: 8, background: '#555' }}>Отмена</button>
      </div>
    );
  }

  if (createdPromo) {
    return (
      <div style={{ padding: 24, maxWidth: 400, margin: '0 auto' }}>
        <h2 style={{ marginTop: 0 }}>Промокод создан</h2>
        <p style={{ fontSize: 24, fontWeight: 'bold', letterSpacing: 4 }}>{createdPromo.code}</p>
        <p style={{ fontSize: 14, opacity: 0.8 }}>Срок: {promoType === 'day' ? '1 день' : promoType === 'week' ? '1 неделя' : '1 месяц'}</p>
        <button type="button" onClick={sharePromo} style={{ ...btnStyle, marginTop: 16, background: '#6a5' }}>Поделиться</button>
        <button type="button" onClick={() => { setCreatedPromo(null); setPromoView(false); loadStats(); }} style={{ ...btnStyle, marginTop: 8 }}>К списку</button>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 400, margin: '0 auto' }}>
      <BackArrow onClick={exitAdmin} title="Выйти из админки" />
      <h2 style={{ marginTop: 0 }}>Админка</h2>
      <section style={{ marginBottom: 24, padding: 16, background: 'rgba(255,255,255,0.06)', borderRadius: 8 }}>
        <p style={{ marginBottom: 12 }}>Уникальные игроки</p>
        <p style={{ fontSize: 12, opacity: 0.8, marginBottom: 8 }}>Количество разных пользователей, создавших или вошедших в комнату</p>
        <div>За сутки: <strong>{stats?.day ?? 0}</strong></div>
        <div>За неделю: <strong>{stats?.week ?? 0}</strong></div>
        <div>За месяц: <strong>{stats?.month ?? 0}</strong></div>
        <div>Всего: <strong>{stats?.total ?? 0}</strong></div>
      </section>
      <section style={{ marginBottom: 24, padding: 16, background: 'rgba(255,255,255,0.06)', borderRadius: 8 }}>
        <p style={{ marginBottom: 12 }}>Трафик сайта (воронка рекламы)</p>
        <p style={{ fontSize: 12, opacity: 0.8, marginBottom: 8 }}>
          Уникальные посетители, сессии и просмотры страниц. Это отдельная метрика от «игроков в комнатах».
        </p>
        <div>Посетители за сутки: <strong>{stats?.siteVisitorsToday ?? 0}</strong></div>
        <div>Посетители за неделю: <strong>{stats?.siteVisitorsWeek ?? 0}</strong></div>
        <div>Посетители за месяц: <strong>{stats?.siteVisitorsMonth ?? 0}</strong></div>
        <div>Посетители всего: <strong>{stats?.siteVisitorsTotal ?? 0}</strong></div>
        <div style={{ marginTop: 8 }}>Сессии за сутки: <strong>{stats?.siteSessionsToday ?? 0}</strong></div>
        <div>Сессии за месяц: <strong>{stats?.siteSessionsMonth ?? 0}</strong></div>
        <div>Сессии всего: <strong>{stats?.siteSessionsTotal ?? 0}</strong></div>
        <div style={{ marginTop: 8 }}>Просмотры страниц за сутки: <strong>{stats?.pageViewsToday ?? 0}</strong></div>
        <div>Просмотры за неделю: <strong>{stats?.pageViewsWeek ?? 0}</strong></div>
        <div>Просмотры за месяц: <strong>{stats?.pageViewsMonth ?? 0}</strong></div>
        <div style={{ marginTop: 8 }}>Сессий на посетителя: <strong>{stats?.avgSessionsPerVisitor ?? 0}</strong></div>
      </section>
      <section
        style={{
          marginBottom: 24,
          padding: 16,
          background: healthAlerts.length > 0 ? 'rgba(220, 80, 80, 0.12)' : 'rgba(70,160,90,0.12)',
          border: healthAlerts.length > 0 ? '1px solid rgba(220, 80, 80, 0.4)' : '1px solid rgba(70,160,90,0.4)',
          borderRadius: 8,
        }}
      >
        <p style={{ margin: '0 0 10px', fontWeight: 700 }}>
          Health Alerts {healthAlerts.length > 0 ? `(${healthAlerts.length})` : '(ok)'}
        </p>
        {healthAlerts.length > 0 ? (
          <p style={{ margin: '0 0 10px', fontSize: 12, opacity: 0.9 }}>
            High: <strong>{healthHighCount}</strong> · Medium: <strong>{healthMediumCount}</strong>
          </p>
        ) : null}
        {healthAlerts.length === 0 ? (
          <p style={{ margin: 0, fontSize: 13, opacity: 0.9 }}>
            Критичных сигналов по воронке не обнаружено: трафик и базовые конверсии в рабочем диапазоне.
          </p>
        ) : (
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.5 }}>
            {healthAlerts.map((al, idx) => (
              <li key={`${al.text}-${idx}`} style={{ marginBottom: 8 }}>
                <strong style={{ color: al.level === 'high' ? '#ff8f8f' : '#ffd98f' }}>
                  {al.level.toUpperCase()}
                </strong>{' '}
                {al.text}
                <div style={{ fontSize: 12, opacity: 0.85, marginTop: 2 }}>
                  Что сделать: {al.action}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      {renderTopList('Топ источников (тип)', stats?.topSourceTypes)}
      {renderTopList('Топ источников (канал)', stats?.topSourceNames)}
      {renderTopList('UTM кампании', stats?.topCampaigns)}
      {renderTopList('Точки входа (entry page)', stats?.topEntryPages)}
      {renderTopList('Самые посещаемые страницы', stats?.topPages)}
      {renderTopList('Среднее время на странице (сек)', stats?.topPageDwell, ' c')}
      <section style={{ marginBottom: 24, padding: 16, background: 'rgba(255,255,255,0.06)', borderRadius: 8 }}>
        <p style={{ marginBottom: 12 }}>Старты игр (сессий)</p>
        <p style={{ fontSize: 12, opacity: 0.8, marginBottom: 8 }}>Каждый запуск игры в комнате (+1 за сутки / сумма за месяц)</p>
        <div>Сегодня: <strong>{stats?.gamesStartedDay ?? 0}</strong></div>
        <div>За 30 дней: <strong>{stats?.gamesStartedMonth ?? 0}</strong></div>
        <div style={{ marginTop: 10, fontSize: 12, opacity: 0.85 }}>Всего стартов (накопительно): <strong>{stats?.gamesStartedLifetime ?? 0}</strong></div>
      </section>
      {stats?.gamesByGame && Object.keys(stats.gamesByGame).length > 0 ? (
        <section style={{ marginBottom: 24, padding: 16, background: 'rgba(255,255,255,0.06)', borderRadius: 8 }}>
          <p style={{ marginBottom: 12 }}>Старты по играм (всего за всё время)</p>
          <p style={{ fontSize: 12, opacity: 0.8, marginBottom: 8 }}>
            Счётчик в файле stats.json на сервере; не сбрасывается при деплое, если задан постоянный каталог данных (GAMEHUB_DATA_DIR).
          </p>
          {Object.entries(stats.gamesByGame)
            .sort((a, b) => (b[1] || 0) - (a[1] || 0))
            .map(([k, n]) => (
              <div key={k} style={{ fontSize: 14, marginBottom: 4 }}>
                <strong>{k}</strong>: {n}
              </div>
            ))}
        </section>
      ) : null}
      <section style={{ marginBottom: 24, padding: 16, background: 'rgba(255,255,255,0.06)', borderRadius: 8 }}>
        <p style={{ marginBottom: 12 }}>Завершённые показы рекламы</p>
        <p style={{ fontSize: 12, opacity: 0.8, marginBottom: 8 }}>Клиент подтверждает после вызова рекламного SDK (честный минимум, без умножения на число игроков)</p>
        <div>За сутки: <strong>{stats?.adImpressionsDay ?? 0}</strong></div>
        <div>За месяц: <strong>{stats?.adImpressionsMonth ?? 0}</strong></div>
        <div>Всего: <strong>{stats?.adImpressionsTotal ?? 0}</strong></div>
      </section>
      <a href="https://publishers.monetag.com/statistics?group_by=date_time&date_from=2026-02-19&date_to=2026-03-19&format_type=ALL&rate_model=1" target="_blank" rel="noopener noreferrer" style={{ display: 'block', ...btnStyle, marginBottom: 8, textAlign: 'center', textDecoration: 'none' }}>Monetag — статистика рекламы</a>
      <button type="button" onClick={() => setPromoView(true)} style={btnStyle}>Создать промокод</button>
      <button type="button" onClick={loadStats} style={{ ...btnStyle, marginTop: 8, background: '#555' }}>Обновить статистику</button>
      <button type="button" onClick={exitAdmin} style={{ ...btnStyle, marginTop: 8, background: '#333' }}>Выйти из админки</button>

      <section style={{ marginTop: 28, padding: 16, background: 'rgba(255,255,255,0.06)', borderRadius: 8 }}>
        <h3 style={{ marginTop: 0, marginBottom: 12 }}>Обратная связь</h3>
        <p style={{ fontSize: 13, opacity: 0.85, marginBottom: 12, lineHeight: 1.45 }}>
          Сообщения с главной страницы (текст, контакт, время, id игрока).
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button type="button" onClick={loadFeedback} disabled={feedbackLoading} style={{ ...btnStyle, background: '#4a6a8a' }}>
            {feedbackLoading ? 'Загрузка…' : 'Загрузить отзывы'}
          </button>
          <button type="button" onClick={exportFeedbackFile} style={{ ...btnStyle, background: '#3d5c3d' }}>
            Выгрузить JSON со всеми ответами
          </button>
        </div>
        {feedbackItems != null && (
          <div style={{ marginTop: 14, maxHeight: 280, overflow: 'auto', fontSize: 12, lineHeight: 1.45 }}>
            <p style={{ margin: '0 0 8px', opacity: 0.85 }}>Всего: {feedbackItems.length}</p>
            {[...feedbackItems].reverse().slice(0, 40).map((f, i) => (
              <div
                key={`${f.receivedAt}-${i}`}
                style={{
                  marginBottom: 10,
                  padding: 10,
                  borderRadius: 8,
                  background: 'rgba(0,0,0,0.2)',
                  borderLeft: '3px solid var(--tg-theme-button-color, #3a7bd5)',
                }}
              >
                <div style={{ opacity: 0.8, marginBottom: 4 }}>
                  {f.receivedAt ? new Date(f.receivedAt).toLocaleString() : '—'}
                  {f.displayName ? ` · ${f.displayName}` : ''}
                  {f.playerId ? ` · id:${f.playerId}` : ''}
                  {f.contact ? ` · ${f.contact}` : ''}
                  {f.game ? ` · игра:${f.game}` : ''}
                  {f.source ? ` · ${f.source}` : ''}
                </div>
                <div style={{ whiteSpace: 'pre-wrap' }}>{f.message || ''}</div>
              </div>
            ))}
            {feedbackItems.length > 40 ? <p style={{ opacity: 0.75 }}>…и ещё {feedbackItems.length - 40} (см. выгрузку JSON)</p> : null}
          </div>
        )}
      </section>

      <SeoFooter style={{ marginTop: 24 }} />
    </div>
  );
}

const btnStyle = {
  padding: '12px 20px',
  fontSize: 16,
  borderRadius: 8,
  border: 'none',
  background: 'var(--tg-theme-button-color, #3a7bd5)',
  color: 'var(--tg-theme-button-text-color, #fff)',
  cursor: 'pointer',
  width: '100%',
};
