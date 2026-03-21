import { useRef, useState } from 'react';
import { track } from '../analytics';
import {
  isBrowserGuestUser,
  downloadAccountBackup,
  importAccountBackup,
  getTelegramBotUrl,
} from '../account';
import Button from './ui/Button';

/**
 * @param {'full' | 'compact'} variant
 * @param {boolean} showImport — только в полном режиме на профиле
 */
export default function SaveAccountPanel({ user, variant = 'full', showImport = false, className = '' }) {
  const guest = isBrowserGuestUser(user);
  const botUrl = getTelegramBotUrl();
  const fileRef = useRef(null);
  const [importMsg, setImportMsg] = useState(null);

  const copyId = async () => {
    const id = String(user?.id ?? '');
    try {
      await navigator.clipboard.writeText(id);
      track('account_copy_id', { guest: true });
      setImportMsg({ type: 'ok', text: 'ID скопирован в буфер' });
    } catch {
      setImportMsg({ type: 'err', text: 'Не удалось скопировать' });
    }
    setTimeout(() => setImportMsg(null), 2500);
  };

  const onDownload = () => {
    downloadAccountBackup(user);
    track('account_backup_download', { guest: true });
    setImportMsg({ type: 'ok', text: 'Файл сохранён' });
    setTimeout(() => setImportMsg(null), 2500);
  };

  const onPickImport = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const r = importAccountBackup(String(reader.result || ''));
      setImportMsg({
        type: r.ok ? 'ok' : 'err',
        text: r.ok ? 'Данные восстановлены. Обновите страницу при необходимости.' : r.error || 'Ошибка',
      });
      track('account_import', { ok: r.ok });
      e.target.value = '';
    };
    reader.readAsText(f, 'utf8');
  };

  if (!guest) {
    return (
      <section
        className={`gh-card ${className}`.trim()}
        style={{
          padding: variant === 'compact' ? 12 : 14,
          marginBottom: variant === 'compact' ? 12 : 16,
          border: '1px solid color-mix(in srgb, var(--tg-theme-button-color, #3a7bd5) 35%, transparent)',
          background: 'color-mix(in srgb, var(--tg-theme-button-color, #3a7bd5) 08%, transparent)',
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 6, fontSize: variant === 'compact' ? 14 : 15 }}>
          Аккаунт в Telegram
        </div>
        <p style={{ margin: 0, fontSize: 13, opacity: 0.9, lineHeight: 1.45 }}>
          Покупки и список друзей привязаны к вашему Telegram. На другом устройстве зайдите в тот же аккаунт — всё
          сохранится.
        </p>
      </section>
    );
  }

  if (variant === 'compact') {
    return (
      <div
        className={className}
        style={{
          padding: 12,
          marginBottom: 12,
          borderRadius: 10,
          background: 'color-mix(in srgb, var(--gh-warning, #d4a017) 12%, var(--gh-surface, #222))',
          border: '1px dashed color-mix(in srgb, var(--gh-warning, #d4a017) 45%, transparent)',
          fontSize: 13,
          lineHeight: 1.45,
        }}
      >
        <strong>Браузерный гость.</strong> Покупки и друзья хранятся только в этом браузере. Перед оплатой сохраните ID
        или файл бэкапа в{' '}
        <strong>Профиле</strong>, либо играйте через Telegram.
        {botUrl ? (
          <>
            {' '}
            <a href={botUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', fontWeight: 700 }}>
              Открыть бота
            </a>
          </>
        ) : null}
      </div>
    );
  }

  return (
    <section className={`gh-card ${className}`.trim()} style={{ padding: 14, marginBottom: 16 }}>
      <div style={{ fontWeight: 800, marginBottom: 8, fontSize: 16 }}>Сохранить аккаунт</div>
      <p style={{ margin: '0 0 12px', fontSize: 13, opacity: 0.9, lineHeight: 1.5 }}>
        Регистрация не нужна, чтобы играть. Она важна для <strong>покупок</strong> и <strong>друзей</strong>: в браузере
        всё привязано к этому устройству. Очистка сайта или другой браузер — другой «игрок».
      </p>
      <div
        style={{
          padding: 10,
          borderRadius: 8,
          marginBottom: 12,
          background: 'rgba(212, 160, 23, 0.12)',
          border: '1px solid rgba(212, 160, 23, 0.35)',
          fontSize: 12,
          fontFamily: 'ui-monospace, monospace',
          wordBreak: 'break-all',
        }}
      >
        Ваш игровой ID: <strong>{String(user?.id ?? '—')}</strong>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Button variant="secondary" fullWidth onClick={copyId} style={{ borderRadius: 10 }}>
          Скопировать ID
        </Button>
        <Button variant="secondary" fullWidth onClick={onDownload} style={{ borderRadius: 10 }}>
          Скачать бэкап (JSON)
        </Button>
        {botUrl ? (
          <a
            href={botUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="gh-btn gh-btn--primary"
            style={{
              display: 'block',
              textAlign: 'center',
              textDecoration: 'none',
              borderRadius: 10,
              padding: '10px 14px',
            }}
          >
            Играть в Telegram — стабильный аккаунт
          </a>
        ) : null}
        {showImport ? (
          <>
            <input ref={fileRef} type="file" accept="application/json,.json" style={{ display: 'none' }} onChange={onPickImport} />
            <Button variant="secondary" fullWidth onClick={() => fileRef.current?.click()} style={{ borderRadius: 10 }}>
              Восстановить из файла бэкапа
            </Button>
          </>
        ) : null}
      </div>
      {importMsg ? (
        <p
          style={{
            margin: '10px 0 0',
            fontSize: 13,
            color: importMsg.type === 'ok' ? 'var(--gh-success, #22c55e)' : 'var(--gh-danger, #f87171)',
          }}
        >
          {importMsg.text}
        </p>
      ) : null}
    </section>
  );
}
