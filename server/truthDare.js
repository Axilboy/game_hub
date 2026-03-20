const DEFAULT_SETTINGS = {
  mode: 'mixed', // 'truth' | 'dare' | 'mixed'
  show18Plus: false,
  safeMode: true,
  roundsCount: 5,
  timerSeconds: 60,
  categorySlugs: ['classic_truth', 'classic_dare'],
};

export const TRUTH_DARE_CATEGORIES = [
  // Free, all ages.
  { slug: 'classic_truth', name: 'Классика — правда', type: 'truth', is18Plus: false, safe: true, premium: false, tags: ['classic'] },
  { slug: 'classic_dare', name: 'Классика — действие', type: 'dare', is18Plus: false, safe: true, premium: false, tags: ['classic'] },
  { slug: 'friends_truth', name: 'Друзья — правда', type: 'truth', is18Plus: false, safe: true, premium: false, tags: ['friends'] },
  { slug: 'friends_dare', name: 'Друзья — действие', type: 'dare', is18Plus: false, safe: true, premium: false, tags: ['friends'] },

  // 18+ (age-gated).
  { slug: '18_truth', name: '18+ — правда', type: 'truth', is18Plus: true, safe: false, premium: false, tags: ['18plus'] },
  { slug: '18_dare', name: '18+ — действие', type: 'dare', is18Plus: true, safe: false, premium: false, tags: ['18plus'] },

  // Party / drunk (premium).
  { slug: 'drunk_truth', name: 'Пьяное — правда', type: 'truth', is18Plus: false, safe: false, premium: true, tags: ['drunk', 'party'] },
  { slug: 'drunk_dare', name: 'Пьяное — действие', type: 'dare', is18Plus: false, safe: false, premium: true, tags: ['drunk', 'party'] },
];

const TRUTH_DARE_CARDS = [
  // classic_truth
  { id: 'ct1', categorySlug: 'classic_truth', type: 'truth', is18Plus: false, safe: true, premium: false, text: 'Какой секрет вы готовы признать только в компании?' },
  { id: 'ct2', categorySlug: 'classic_truth', type: 'truth', is18Plus: false, safe: true, premium: false, text: 'Кого вы считаете самым смелым в этой комнате?' },
  { id: 'ct3', categorySlug: 'classic_truth', type: 'truth', is18Plus: false, safe: true, premium: false, text: 'Какой поступок вы бы повторили — если бы было можно?' },

  // classic_dare
  { id: 'cd1', categorySlug: 'classic_dare', type: 'dare', is18Plus: false, safe: true, premium: false, text: 'Сделайте 30-секундный танец в стиле “мы уверены в себе”.' },
  { id: 'cd2', categorySlug: 'classic_dare', type: 'dare', is18Plus: false, safe: true, premium: false, text: 'Скажите тост за кого-то из игроков, кого выберет ведущий.' },
  { id: 'cd3', categorySlug: 'classic_dare', type: 'dare', is18Plus: false, safe: true, premium: false, text: 'Покажите пантомимой, какую “способность” хотите получить.' },

  // friends_truth
  { id: 'ft1', categorySlug: 'friends_truth', type: 'truth', is18Plus: false, safe: true, premium: false, text: 'Какая шутка в вашей голове звучит каждый день?' },
  { id: 'ft2', categorySlug: 'friends_truth', type: 'truth', is18Plus: false, safe: true, premium: false, text: 'Кого вы знаете лучше всего среди присутствующих?' },
  { id: 'ft3', categorySlug: 'friends_truth', type: 'truth', is18Plus: false, safe: true, premium: false, text: 'Какой момент за последний месяц вы бы пересказали в 1 фразе?' },

  // friends_dare
  { id: 'fd1', categorySlug: 'friends_dare', type: 'dare', is18Plus: false, safe: true, premium: false, text: 'Поздоровайтесь так, как если бы вы были роботом.' },
  { id: 'fd2', categorySlug: 'friends_dare', type: 'dare', is18Plus: false, safe: true, premium: false, text: 'Скажите “я выбираю…”, назовите одного игрока и выполните для него мини-миссию: улыбка + комплимент.' },
  { id: 'fd3', categorySlug: 'friends_dare', type: 'dare', is18Plus: false, safe: true, premium: false, text: 'Сделайте 5 глубоких вдохов с видом “сейчас будет важный разговор”.' },

  // 18+ truth
  { id: '18t1', categorySlug: '18_truth', type: 'truth', is18Plus: true, safe: false, premium: false, text: 'Самое неловкое признание, которое вы когда-либо делали?' },
  { id: '18t2', categorySlug: '18_truth', type: 'truth', is18Plus: true, safe: false, premium: false, text: 'Какой вопрос вы бы боялись задать вживую?' },
  { id: '18t3', categorySlug: '18_truth', type: 'truth', is18Plus: true, safe: false, premium: false, text: 'Что вы скрываете от “слишком строгих” людей?' },

  // 18+ dare
  { id: '18d1', categorySlug: '18_dare', type: 'dare', is18Plus: true, safe: false, premium: false, text: 'Скажите одну смелую фразу, которую обычно держите в голове.' },
  { id: '18d2', categorySlug: '18_dare', type: 'dare', is18Plus: true, safe: false, premium: false, text: 'Сделайте пантомиму “представьте, что вы выиграли спор”. Без слов.' },
  { id: '18d3', categorySlug: '18_dare', type: 'dare', is18Plus: true, safe: false, premium: false, text: 'Расскажите, какую роль хотели бы сыграть на сцене — и почему.' },

  // drunk_truth (premium)
  { id: 'dt1', categorySlug: 'drunk_truth', type: 'truth', is18Plus: false, safe: false, premium: true, text: 'Какой тост вы бы предложили другу после “второй попытки быть смелым”?' },
  { id: 'dt2', categorySlug: 'drunk_truth', type: 'truth', is18Plus: false, safe: false, premium: true, text: 'Какая ваша самая абсурдная история с вечеринки?' },
  { id: 'dt3', categorySlug: 'drunk_truth', type: 'truth', is18Plus: false, safe: false, premium: true, text: 'О чём бы вы мечтали, если бы сегодня точно не было последствий?' },

  // drunk_dare (premium)
  { id: 'dd1', categorySlug: 'drunk_dare', type: 'dare', is18Plus: false, safe: false, premium: true, text: 'Скажите короткий “спич” на 10 секунд, будто вы ведущий вечеринки.' },
  { id: 'dd2', categorySlug: 'drunk_dare', type: 'dare', is18Plus: false, safe: false, premium: true, text: 'Сделайте “случайный выбор”: закройте глаза и назовите одного игрока — он получит ваш комплимент.' },
  { id: 'dd3', categorySlug: 'drunk_dare', type: 'dare', is18Plus: false, safe: false, premium: true, text: 'Изобразите рекламный ролик за 15 секунд для “самой смешной идеи” этой компании.' },
];

const cardsByCategory = new Map();
for (const c of TRUTH_DARE_CARDS) {
  const arr = cardsByCategory.get(c.categorySlug) || [];
  arr.push(c);
  cardsByCategory.set(c.categorySlug, arr);
}

export function normalizeTruthDareSettings(input) {
  const v = input && typeof input === 'object' ? input : {};
  const mode = v.mode === 'truth' || v.mode === 'dare' || v.mode === 'mixed' ? v.mode : DEFAULT_SETTINGS.mode;
  const show18Plus = Boolean(v.show18Plus);
  const safeMode = v.safeMode === false ? false : Boolean(v.safeMode);
  const roundsCount = Math.min(50, Math.max(1, Number(v.roundsCount) || DEFAULT_SETTINGS.roundsCount));
  const timerSeconds = Math.min(300, Math.max(10, Number(v.timerSeconds) || DEFAULT_SETTINGS.timerSeconds));
  const categorySlugs = Array.isArray(v.categorySlugs) && v.categorySlugs.length ? v.categorySlugs.map(String) : DEFAULT_SETTINGS.categorySlugs;
  return { mode, show18Plus, safeMode, roundsCount, timerSeconds, categorySlugs };
}

export function getTruthDareCatalog({ playerHasPro = false } = {}) {
  return TRUTH_DARE_CATEGORIES.map((c) => ({
    slug: c.slug,
    name: c.name,
    type: c.type,
    is18Plus: c.is18Plus,
    safe: c.safe,
    premium: c.premium,
    lockedByPro: c.premium && !playerHasPro,
    tags: c.tags || [],
  }));
}

function pickOne(arr) {
  if (!arr.length) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

export function pickTruthDareCard({
  mode = 'mixed',
  categorySlugs = DEFAULT_SETTINGS.categorySlugs,
  include18Plus = false,
  safeMode = true,
  playerHasPro = false,
  excludeCardIds = [],
} = {}) {
  const exclude = new Set(excludeCardIds || []);
  const selectedCats = new Set((categorySlugs || []).map(String));

  const candidates = TRUTH_DARE_CARDS.filter((card) => {
    if (!selectedCats.has(card.categorySlug)) return false;
    if (exclude.has(card.id)) return false;
    if (mode !== 'mixed' && card.type !== mode) return false;
    if (!include18Plus && card.is18Plus) return false;
    if (safeMode && !card.safe) return false;
    if (card.premium && !playerHasPro) return false;
    return true;
  });

  return pickOne(candidates);
}

export function createTruthDareState(room, settings) {
  const gs = {};
  const s = normalizeTruthDareSettings(settings);

  const playerOrder = (room.players || []).map((p) => p.id);
  const roomInventories = room.playerInventories || {};
  const currentPlayerIndex = 0;
  const firstPlayerId = playerOrder[currentPlayerIndex] || null;
  const firstHasPro = firstPlayerId ? Boolean(roomInventories[firstPlayerId]?.hasPro) : false;

  // Age gate (per player). Auto-confirm the lobby host so the game can start immediately.
  const ageConfirmedByPlayerId = {};
  for (const pid of playerOrder) ageConfirmedByPlayerId[pid] = false;
  if (room.hostId && ageConfirmedByPlayerId[room.hostId] !== undefined) {
    ageConfirmedByPlayerId[room.hostId] = true;
  }

  const currentCard = pickTruthDareCard({
    mode: s.mode,
    categorySlugs: s.categorySlugs,
    include18Plus: s.show18Plus && Boolean(ageConfirmedByPlayerId[firstPlayerId]),
    safeMode: s.safeMode,
    playerHasPro: firstHasPro,
    excludeCardIds: [],
  });

  gs.phase = 'round';
  gs.settings = s;
  gs.playerOrder = playerOrder;
  gs.ageConfirmedByPlayerId = ageConfirmedByPlayerId;
  gs.currentPlayerIndex = currentPlayerIndex;
  gs.roundIndex = 0; // turn number (0-based)
  gs.currentPlayerId = firstPlayerId;
  gs.usedCardIds = currentCard ? [currentCard.id] : [];
  gs.currentCard = currentCard || null;
  gs.readyIds = [];
  gs.createdAt = Date.now();

  // Turn timer (server-driven).
  gs.turnToken = 1;
  gs.turnStartedAt = gs.createdAt;
  gs.turnEndsAt = gs.turnStartedAt + s.timerSeconds * 1000;
  gs.turnTimeoutId = null; // filled by rooms.js scheduler
  return gs;
}

