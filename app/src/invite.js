export const INVITE_TEMPLATES = [
  { id: 'classic', label: 'Классика' },
  { id: 'quick', label: 'Быстрый старт' },
  { id: 'party', label: 'Вечеринка' },
];

export function buildInviteLinks({ inviteToken, baseUrl, botUsername }) {
  const token = String(inviteToken || '').trim();
  if (!token) return { miniAppLink: '', webLink: '', inviteLink: '' };
  const cleanBase = String(baseUrl || '').replace(/\/$/, '');
  const miniAppLink = botUsername ? `https://t.me/${botUsername}?start=${encodeURIComponent(token)}` : '';
  const webLink = cleanBase ? `${cleanBase}?invite=${encodeURIComponent(token)}` : '';
  return {
    miniAppLink,
    webLink,
    inviteLink: miniAppLink || webLink || '',
  };
}

export function formatInviteText({ roomName, miniAppLink, webLink }) {
  const lines = [`GameHub - присоединиться к лобби: ${roomName || 'Комната'}`, ''];
  if (miniAppLink) lines.push('Открыть в Telegram:', miniAppLink, '');
  if (webLink) lines.push(miniAppLink ? 'Или в браузере:' : 'Ссылка:', webLink);
  return lines.join('\n').trim();
}

function getTemplateTitle(templateId, roomName) {
  if (templateId === 'quick') return `GameHub: быстрый старт в ${roomName || 'комнату'}`;
  if (templateId === 'party') return `Вечеринка в GameHub - залетай в ${roomName || 'лобби'}`;
  return `GameHub - присоединиться к лобби: ${roomName || 'Комната'}`;
}

export function formatInviteTextByTemplate({
  templateId = 'classic',
  roomName,
  miniAppLink,
  webLink,
}) {
  const title = getTemplateTitle(templateId, roomName);
  const lines = [title, ''];
  if (templateId === 'quick') {
    lines.push('1) Открой ссылку', '2) Войди в лобби', '3) Стартуем игру', '');
  } else if (templateId === 'party') {
    lines.push('Нужны только телефон и 1 минута. Дальше играем вместе.', '');
  }
  if (miniAppLink) lines.push('Открыть в Telegram:', miniAppLink, '');
  if (webLink) lines.push(miniAppLink ? 'Или в браузере:' : 'Ссылка:', webLink);
  return lines.join('\n').trim();
}

export async function shareInviteSmart({
  roomName,
  miniAppLink,
  webLink,
  templateId = 'classic',
  preferTelegram = true,
}) {
  const inviteLink = miniAppLink || webLink || '';
  if (!inviteLink) return { ok: false, reason: 'no_link' };

  const text = formatInviteTextByTemplate({ templateId, roomName, miniAppLink, webLink });
  const tg = typeof window !== 'undefined' ? window.Telegram?.WebApp : null;

  if (preferTelegram && tg?.openTelegramLink) {
    try {
      const shareText = getTemplateTitle(templateId, roomName);
      tg.openTelegramLink(
        `https://t.me/share/url?url=${encodeURIComponent(inviteLink)}&text=${encodeURIComponent(shareText)}`,
      );
      return { ok: true, mode: 'telegram' };
    } catch (_) {}
  }

  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({
        title: 'Приглашение в GameHub',
        text,
        url: inviteLink,
      });
      return { ok: true, mode: 'native_share' };
    } catch (_) {}
  }

  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return { ok: true, mode: 'clipboard' };
    } catch (_) {}
  }

  return { ok: false, reason: 'share_failed' };
}
