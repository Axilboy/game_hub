const DEFAULT_SETTINGS = {
  mode: 'mixed', // 'truth' | 'dare' | 'mixed'
  show18Plus: false,
  safeMode: true,
  roundsCount: 5,
  timerSeconds: 60,
  skipLimitPerPlayer: 2,
  randomStartPlayer: true,
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
  { slug: 'couples_truth', name: 'Пары — правда', type: 'truth', is18Plus: false, safe: true, premium: false, tags: ['couples'] },
  { slug: 'couples_dare', name: 'Пары — действие', type: 'dare', is18Plus: false, safe: true, premium: false, tags: ['couples'] },
  { slug: 'company_truth', name: 'Компания — правда', type: 'truth', is18Plus: false, safe: true, premium: false, tags: ['company'] },
  { slug: 'company_dare', name: 'Компания — действие', type: 'dare', is18Plus: false, safe: true, premium: false, tags: ['company'] },
  { slug: 'hard_truth', name: 'Жесткие вопросы', type: 'truth', is18Plus: false, safe: false, premium: true, tags: ['hard'] },
  { slug: 'romance_truth', name: 'Романтика — правда', type: 'truth', is18Plus: false, safe: true, premium: true, tags: ['romance'] },
  { slug: 'romance_dare', name: 'Романтика — действие', type: 'dare', is18Plus: false, safe: true, premium: true, tags: ['romance'] },
  { slug: 'corporate_truth', name: 'Корпоратив SFW — правда', type: 'truth', is18Plus: false, safe: true, premium: false, tags: ['corporate'] },
  { slug: 'corporate_dare', name: 'Корпоратив SFW — действие', type: 'dare', is18Plus: false, safe: true, premium: false, tags: ['corporate'] },
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
  { id: 'cp1', categorySlug: 'couples_truth', type: 'truth', is18Plus: false, safe: true, premium: false, text: 'Что в партнере вас всегда вдохновляет?' },
  { id: 'cp2', categorySlug: 'couples_dare', type: 'dare', is18Plus: false, safe: true, premium: false, text: 'Скажите партнеру короткий комплимент в 3 словах.' },
  { id: 'co1', categorySlug: 'company_truth', type: 'truth', is18Plus: false, safe: true, premium: false, text: 'Какой формат вечеринки вы бы повторили завтра?' },
  { id: 'co2', categorySlug: 'company_dare', type: 'dare', is18Plus: false, safe: true, premium: false, text: 'Назовите “кодовое имя” каждому игроку по очереди.' },
  { id: 'h1', categorySlug: 'hard_truth', type: 'truth', is18Plus: false, safe: false, premium: true, text: 'Какую правду о себе вам сложно говорить вслух?' },
  { id: 'r1', categorySlug: 'romance_truth', type: 'truth', is18Plus: false, safe: true, premium: true, text: 'Что для вас самый теплый жест внимания?' },
  { id: 'r2', categorySlug: 'romance_dare', type: 'dare', is18Plus: false, safe: true, premium: true, text: 'Скажите одну фразу как из романтического фильма.' },
  { id: 'cw1', categorySlug: 'corporate_truth', type: 'truth', is18Plus: false, safe: true, premium: false, text: 'Какой рабочий навык больше всего помог вам в жизни?' },
  { id: 'cw2', categorySlug: 'corporate_dare', type: 'dare', is18Plus: false, safe: true, premium: false, text: 'Сделайте 20-секундную “презентацию” случайного предмета рядом.' },
];

const cardsByCategory = new Map();
for (const c of TRUTH_DARE_CARDS) {
  const arr = cardsByCategory.get(c.categorySlug) || [];
  arr.push(c);
  cardsByCategory.set(c.categorySlug, arr);
}

const TD_ITEM_TO_CATEGORIES = {
  td_party: ['drunk_truth', 'drunk_dare', 'hard_truth'],
  td_romance: ['romance_truth', 'romance_dare'],
  td_18plus: ['18_truth', '18_dare'],
};

export function getUnlockedTruthDareCategorySlugs(unlockedItems = []) {
  const ids = Array.isArray(unlockedItems) ? unlockedItems.map(String) : [];
  const out = new Set();
  for (const id of ids) {
    const cats = TD_ITEM_TO_CATEGORIES[id] || [];
    for (const slug of cats) out.add(slug);
  }
  return [...out];
}

export function getTruthDareCardById(cardId) {
  const id = String(cardId || '').trim();
  if (!id) return null;
  return TRUTH_DARE_CARDS.find((c) => c.id === id) || null;
}

export function normalizeTruthDareSettings(input) {
  const v = input && typeof input === 'object' ? input : {};
  const mode = v.mode === 'truth' || v.mode === 'dare' || v.mode === 'mixed' ? v.mode : DEFAULT_SETTINGS.mode;
  const show18Plus = Boolean(v.show18Plus);
  const safeMode = v.safeMode === false ? false : Boolean(v.safeMode);
  const roundsCount = Math.min(50, Math.max(1, Number(v.roundsCount) || DEFAULT_SETTINGS.roundsCount));
  const timerSeconds = Math.min(300, Math.max(10, Number(v.timerSeconds) || DEFAULT_SETTINGS.timerSeconds));
  const skipLimitPerPlayer = Math.min(10, Math.max(0, Number(v.skipLimitPerPlayer) || DEFAULT_SETTINGS.skipLimitPerPlayer));
  const randomStartPlayer = v.randomStartPlayer !== false;
  const categorySlugs = Array.isArray(v.categorySlugs) && v.categorySlugs.length ? v.categorySlugs.map(String) : DEFAULT_SETTINGS.categorySlugs;
  return { mode, show18Plus, safeMode, roundsCount, timerSeconds, skipLimitPerPlayer, randomStartPlayer, categorySlugs };
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
  unlockedCategorySlugs = [],
  excludeCardIds = [],
} = {}) {
  const exclude = new Set(excludeCardIds || []);
  const selectedCats = new Set((categorySlugs || []).map(String));
  const unlockedCats = new Set((unlockedCategorySlugs || []).map(String));

  const candidates = TRUTH_DARE_CARDS.filter((card) => {
    if (!selectedCats.has(card.categorySlug)) return false;
    if (exclude.has(card.id)) return false;
    if (mode !== 'mixed' && card.type !== mode) return false;
    if (!include18Plus && card.is18Plus) return false;
    if (safeMode && !card.safe) return false;
    if (card.premium && !playerHasPro && !unlockedCats.has(card.categorySlug)) return false;
    return true;
  });

  return pickOne(candidates);
}

export function createTruthDareState(room, settings) {
  const gs = {};
  const s = normalizeTruthDareSettings(settings);

  const playerOrder = (room.players || []).map((p) => p.id);
  const roomInventories = room.playerInventories || {};
  const currentPlayerIndex = s.randomStartPlayer && playerOrder.length
    ? Math.floor(Math.random() * playerOrder.length)
    : 0;
  const firstPlayerId = playerOrder[currentPlayerIndex] || null;
  const firstHasPro = firstPlayerId ? Boolean(roomInventories[firstPlayerId]?.hasPro) : false;
  const firstUnlockedCategorySlugs = firstPlayerId
    ? getUnlockedTruthDareCategorySlugs(roomInventories[firstPlayerId]?.unlockedItems || [])
    : [];

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
    unlockedCategorySlugs: firstUnlockedCategorySlugs,
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
  gs.skipCountByPlayerId = {};
  gs.playerStats = {};
  for (const pid of playerOrder) {
    gs.skipCountByPlayerId[pid] = 0;
    gs.playerStats[pid] = { done: 0, skip: 0, timeout: 0 };
  }
  gs.turnHistory = [];
  gs.likesByPlayerId = {};
  gs.favoritesByPlayerId = {};
  gs.cardLikes = {};
  gs.cardReports = {};
  gs.reportedByPlayerAndCard = {};
  gs.reportLog = [];
  gs.readyIds = [];
  gs.createdAt = Date.now();

  // Turn timer (server-driven).
  gs.turnToken = 1;
  gs.turnStartedAt = gs.createdAt;
  gs.turnEndsAt = gs.turnStartedAt + s.timerSeconds * 1000;
  gs.turnTimeoutId = null; // filled by rooms.js scheduler
  return gs;
}

