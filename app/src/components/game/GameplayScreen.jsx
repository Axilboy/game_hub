import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import BackArrow from '../BackArrow';
import AppHeaderRight from '../layout/AppHeaderRight';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { api } from '../../api';
import { track } from '../../analytics';
import '../landing/gamePromoLanding.css';

const GAME_REPORT_LABELS = {
  spy: 'Шпион',
  mafia: 'Мафия',
  elias: 'Элиас',
  truth_dare: 'Правда или действие',
  bunker: 'Бункер',
};

/**
 * Единая оболочка экрана игры: градиент и токены темы как на промо-лендингах (.gpl--*).
 * @param {'spy'|'mafia'|'elias'|'truth_dare'|'bunker'} theme
 * @param {boolean} [showHomeButton] — отдельная кнопка «на главную» справа (у мафии обычно false — выход в левой кнопке).
 * @param {boolean} [showReportBug] — кнопка «Сообщить об ошибке» внизу (по умолчанию true для игровых тем)
 */
export default function GameplayScreen({
  theme,
  user,
  onBack,
  backTitle = 'Назад',
  /** Необязательный символ левой кнопки (например ⌂) */
  backIcon,
  showHomeButton = true,
  showReportBug = true,
  title,
  children,
  headerExtra,
}) {
  const navigate = useNavigate();
  const [reportOpen, setReportOpen] = useState(false);
  const [reportText, setReportText] = useState('');
  const [reportContact, setReportContact] = useState('');
  const [reportSending, setReportSending] = useState(false);
  const [reportDone, setReportDone] = useState(false);

  const closeReport = useCallback(() => {
    setReportOpen(false);
    setReportText('');
    setReportContact('');
    setReportDone(false);
  }, []);

  const submitReport = async () => {
    const text = reportText.trim();
    if (text.length < 3) return;
    setReportSending(true);
    try {
      await api.post('/feedback', {
        message: text,
        contact: reportContact.trim(),
        playerId: user?.id,
        displayName: user?.first_name || user?.username || '',
        category: 'bug',
        game: String(theme || ''),
        source: 'in_game',
      });
      track('feedback_submit', { ok: true, len: text.length, game: theme, source: 'in_game' });
      setReportDone(true);
      setReportText('');
      setReportContact('');
    } catch (_) {
      track('feedback_submit', { ok: false, game: theme });
    } finally {
      setReportSending(false);
    }
  };

  const gameLabel = GAME_REPORT_LABELS[theme] || 'Игра';
  const showFooter = showReportBug && theme && Object.prototype.hasOwnProperty.call(GAME_REPORT_LABELS, theme);

  return (
    <div className={`gameplay gpl--${theme}`}>
      <div className="gameplay__inner">
        <header className="gameplay__topbar">
          <div className="gameplay__topbarSlot gameplay__topbarSlot--start">
            {onBack ? <BackArrow onClick={onBack} title={backTitle} inline icon={backIcon} /> : <span className="gameplay__topbarPad" aria-hidden />}
          </div>
          <span className="gameplay__title">{title || '\u00a0'}</span>
          <div className="gameplay__topbarSlot gameplay__topbarSlot--end">
            {showHomeButton ? (
              <button
                type="button"
                className="gameplay__homeBtn"
                onClick={() => navigate('/')}
                title="На главную"
                aria-label="На главную"
              >
                ⌂
              </button>
            ) : null}
            <AppHeaderRight />
          </div>
        </header>
        {headerExtra}
        {children}
        {showFooter ? (
          <footer className="gameplay__report">
            <button type="button" className="gameplay__reportBtn" onClick={() => setReportOpen(true)}>
              Сообщить об ошибке
            </button>
          </footer>
        ) : null}
      </div>

      <Modal open={reportOpen} onClose={closeReport} title="Сообщить об ошибке" width={400}>
        <>
          <p style={{ marginTop: 0, fontSize: 13, opacity: 0.88, lineHeight: 1.45 }}>
            Игра: <strong>{gameLabel}</strong>. Опишите, что пошло не так — сообщение уйдёт команде проекта.
          </p>
          {reportDone ? (
            <p style={{ color: '#22c55e', fontSize: 14 }}>Спасибо! Сообщение отправлено.</p>
          ) : (
            <>
              <label style={{ display: 'block', fontSize: 13, marginBottom: 6 }}>Текст</label>
              <textarea
                className="gh-input gh-input--full"
                rows={5}
                value={reportText}
                onChange={(e) => setReportText(e.target.value)}
                placeholder="Например: кнопка не нажимается, зависло на фазе…"
                style={{ resize: 'vertical', minHeight: 100, marginBottom: 12 }}
              />
              <label style={{ display: 'block', fontSize: 13, marginBottom: 6 }}>Контакт (необязательно)</label>
              <input
                type="text"
                className="gh-input gh-input--full"
                value={reportContact}
                onChange={(e) => setReportContact(e.target.value)}
                placeholder="@username или email"
                style={{ marginBottom: 12 }}
              />
              <Button
                variant="primary"
                fullWidth
                disabled={reportSending || reportText.trim().length < 3}
                onClick={submitReport}
                className="gameplay__btn gameplay__btn--primary"
                style={{ borderRadius: 10, marginBottom: 8 }}
              >
                {reportSending ? 'Отправка…' : 'Отправить'}
              </Button>
            </>
          )}
          <button type="button" className="gameplay__reportBtn" style={{ marginTop: 8 }} onClick={closeReport}>
            {reportDone ? 'Закрыть' : 'Отмена'}
          </button>
        </>
      </Modal>
    </div>
  );
}
