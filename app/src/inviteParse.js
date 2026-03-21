/**
 * Разбор текста из QR/ссылки приглашения → код комнаты или invite-токен.
 * @returns {{ kind: 'code'; value: string } | { kind: 'invite'; value: string } | null}
 */
export function parseInviteOrCodeFromText(raw) {
  const text = String(raw || '').trim();
  if (!text) return null;

  try {
    const u = new URL(text, typeof window !== 'undefined' ? window.location.origin : 'https://example.com');
    const invite = u.searchParams.get('invite');
    if (invite) return { kind: 'invite', value: invite.trim() };
    const start = u.searchParams.get('start');
    if (start && (u.hostname.includes('t.me') || u.hostname.includes('telegram'))) {
      return { kind: 'invite', value: start.trim() };
    }
  } catch (_) {
    // not a full URL
  }

  const inviteParam = text.match(/[?&]invite=([^&\s#]+)/i);
  if (inviteParam) {
    try {
      return { kind: 'invite', value: decodeURIComponent(inviteParam[1]) };
    } catch (_) {
      return { kind: 'invite', value: inviteParam[1] };
    }
  }

  const startParam = text.match(/[?&]start=([^&\s#]+)/i);
  if (startParam && /t\.me/i.test(text)) {
    try {
      return { kind: 'invite', value: decodeURIComponent(startParam[1]) };
    } catch (_) {
      return { kind: 'invite', value: startParam[1] };
    }
  }

  /** Код комнаты в GameHub — 6 цифр (см. roomManager). */
  const compact = text.replace(/\s+/g, '');
  if (/^\d{4,8}$/.test(compact)) {
    return { kind: 'code', value: compact };
  }

  return null;
}

/** То же + ручной ввод кода (без URL). */
export function resolveJoinPayload(raw) {
  const fromParse = parseInviteOrCodeFromText(raw);
  if (fromParse) return fromParse;
  const t = String(raw || '').trim().replace(/\s+/g, '');
  if (!t) return null;
  if (/^\d{4,8}$/.test(t)) return { kind: 'code', value: t };
  return null;
}
