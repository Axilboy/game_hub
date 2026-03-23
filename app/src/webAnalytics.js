const VISITOR_KEY = 'gh_visitor_id';
const SESSION_KEY = 'gh_session_id';
const SENT_SESSION_KEY = 'gh_session_started';

function randomId(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 11)}${Date.now().toString(36).slice(-4)}`;
}

export function getOrCreateVisitorId() {
  try {
    let id = localStorage.getItem(VISITOR_KEY);
    if (!id) {
      id = randomId('v');
      localStorage.setItem(VISITOR_KEY, id);
    }
    return id;
  } catch {
    return randomId('v');
  }
}

export function getOrCreateSessionId() {
  try {
    let sid = sessionStorage.getItem(SESSION_KEY);
    if (!sid) {
      sid = randomId('s');
      sessionStorage.setItem(SESSION_KEY, sid);
    }
    return sid;
  } catch {
    return randomId('s');
  }
}

export function markSessionStartedSent() {
  try {
    sessionStorage.setItem(SENT_SESSION_KEY, '1');
  } catch (_) {}
}

export function isSessionStartedSent() {
  try {
    return sessionStorage.getItem(SENT_SESSION_KEY) === '1';
  } catch {
    return false;
  }
}

function extractRefDomain(ref) {
  if (!ref) return '';
  try {
    const u = new URL(ref);
    return String(u.hostname || '').replace(/^www\./, '');
  } catch {
    return '';
  }
}

export function detectAcquisition(search = '', referrer = '') {
  const sp = new URLSearchParams(String(search || ''));
  const utmSource = (sp.get('utm_source') || '').trim().toLowerCase();
  const utmCampaign = (sp.get('utm_campaign') || '').trim().toLowerCase();
  const refDomain = extractRefDomain(referrer);

  if (utmSource) return { sourceType: 'utm', sourceName: utmSource, utmCampaign };
  if (!refDomain) return { sourceType: 'direct', sourceName: 'direct', utmCampaign: '' };
  if (refDomain.includes('google')) return { sourceType: 'organic', sourceName: 'google', utmCampaign: '' };
  if (refDomain.includes('yandex')) return { sourceType: 'organic', sourceName: 'yandex', utmCampaign: '' };
  if (refDomain.includes('t.me') || refDomain.includes('telegram')) return { sourceType: 'referral', sourceName: 'telegram', utmCampaign: '' };
  return { sourceType: 'referral', sourceName: refDomain, utmCampaign: '' };
}
