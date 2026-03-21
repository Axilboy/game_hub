/**
 * Правда или действие: одна карточка = два варианта на выбор (правда ИЛИ действие).
 * Категории тематические, без разделения «только правда / только действие».
 */

const DEFAULT_SETTINGS = {
  mode: 'mixed', // legacy: игнорируется движком, оставлено для совместимости API
  show18Plus: false,
  safeMode: true,
  roundsCount: 5,
  timerSeconds: 60,
  skipLimitPerPlayer: 2,
  randomStartPlayer: true,
  categorySlugs: ['classic', 'friends'],
};

/** Миграция старых slug (пара «правда/действие» → одна тема) */
const LEGACY_CATEGORY_SLUG_MAP = {
  classic_truth: 'classic',
  classic_dare: 'classic',
  friends_truth: 'friends',
  friends_dare: 'friends',
  '18_truth': '18plus',
  '18_dare': '18plus',
  drunk_truth: 'drunk_party',
  drunk_dare: 'drunk_party',
  couples_truth: 'couples',
  couples_dare: 'couples',
  company_truth: 'company',
  company_dare: 'company',
  hard_truth: 'hard',
  romance_truth: 'romance',
  romance_dare: 'romance',
  corporate_truth: 'corporate',
  corporate_dare: 'corporate',
};

function migrateCategorySlugs(slugs) {
  /** Явный пустой список — «всё выключено», чтобы потом выбрать только нужное */
  if (Array.isArray(slugs) && slugs.length === 0) return [];
  const raw = Array.isArray(slugs) && slugs.length ? slugs.map(String) : [...DEFAULT_SETTINGS.categorySlugs];
  const out = [];
  const seen = new Set();
  for (const s of raw) {
    const m = LEGACY_CATEGORY_SLUG_MAP[s] || s;
    if (seen.has(m)) continue;
    seen.add(m);
    out.push(m);
  }
  return out;
}

export const TRUTH_DARE_CATEGORIES = [
  { slug: 'classic', name: 'Классика', type: 'pair', is18Plus: false, safe: true, premium: false, tags: ['classic'] },
  { slug: 'friends', name: 'Друзья', type: 'pair', is18Plus: false, safe: true, premium: false, tags: ['friends'] },
  { slug: '18plus', name: '18+', type: 'pair', is18Plus: true, safe: false, premium: false, tags: ['18plus'] },
  { slug: 'drunk_party', name: 'Пьяная вечеринка', type: 'pair', is18Plus: false, safe: false, premium: true, tags: ['drunk', 'party'] },
  { slug: 'couples', name: 'Пары', type: 'pair', is18Plus: false, safe: true, premium: false, tags: ['couples'] },
  { slug: 'company', name: 'Компания', type: 'pair', is18Plus: false, safe: true, premium: false, tags: ['company'] },
  { slug: 'hard', name: 'Без фильтра', type: 'pair', is18Plus: false, safe: false, premium: true, tags: ['hard'] },
  { slug: 'romance', name: 'Романтика', type: 'pair', is18Plus: false, safe: true, premium: true, tags: ['romance'] },
  { slug: 'corporate', name: 'Корпоратив SFW', type: 'pair', is18Plus: false, safe: true, premium: false, tags: ['corporate'] },
];

const TRUTH_DARE_CARDS = [
  // classic
  { id: 'td_c1', categorySlug: 'classic', is18Plus: false, safe: true, premium: false, truth: 'Какой мем из 2024–2025 ты до сих пор не можешь забыть?', dare: 'Покажи тренд из TikTok/Reels — без слов, 20 секунд, все угадывают.' },
  { id: 'td_c2', categorySlug: 'classic', is18Plus: false, safe: true, premium: false, truth: 'Что ты делал(а) вчера вечером, чего стыдно рассказать родителям?', dare: 'Изобрази свой «айфон на 1%» — пантомима 15 секунд.' },
  { id: 'td_c3', categorySlug: 'classic', is18Plus: false, safe: true, premium: false, truth: 'Кого в комнате ты бы взял(а) в напарники на выживание в зомби-апокалипсисе и почему?', dare: 'Скажи комплимент трём людям подряд, начиная фразой «официально заявляю:».' },
  { id: 'td_c4', categorySlug: 'classic', is18Plus: false, safe: true, premium: false, truth: 'Самый неловкий момент с телефоном (звонок, скрин, чужой чат)?', dare: 'Спой припев любимой песни, но только звуками «ла-ла-ла».' },
  { id: 'td_c5', categorySlug: 'classic', is18Plus: false, safe: true, premium: false, truth: 'Какая привычка у тебя есть, которую друзья терпят молча?', dare: 'Сделай «ходячую рекламу» случайного предмета рядом — 20 секунд.' },

  // friends
  { id: 'td_f1', categorySlug: 'friends', is18Plus: false, safe: true, premium: false, truth: 'Кто из присутствующих чаще всего пишет «я через 5 мин» и приезжает через час?', dare: 'Назови каждого игрока блюдом, которое он похож на характер.' },
  { id: 'td_f2', categorySlug: 'friends', is18Plus: false, safe: true, premium: false, truth: 'Какая общая тусовка или поездка у вас была самой абсурдной?', dare: 'Покажи, как ты выглядишь, когда читаешь чат после пьянки.' },
  { id: 'td_f3', categorySlug: 'friends', is18Plus: false, safe: true, premium: false, truth: 'Честно: кого бы ты выбрал(а) капитаном корабля в шторм — и кого НЕ взял(а)?', dare: 'Сделай групфото-позу «мы выиграли Оскар» втроём с соседями по кругу.' },
  { id: 'td_f4', categorySlug: 'friends', is18Plus: false, safe: true, premium: false, truth: 'Какой спор вы затевали чаще всего за последний год?', dare: 'Проведи мини-опрос: «кто тут главный хаос?» — и объяви вердикт с барабанной дробью.' },
  { id: 'td_f5', categorySlug: 'friends', is18Plus: false, safe: true, premium: false, truth: 'Какая шутка у вас «вечная» и уже не смешная, но вы всё равно её шутите?', dare: 'Изобрази эмодзи 🤡 только лицом и жестами — остальные угадывают.' },

  // 18+ (взрослые, откровенные)
  { id: 'td_18a', categorySlug: '18plus', is18Plus: true, safe: false, premium: false, truth: 'Опиши самый неловкий интимный или почти интимный момент из своей жизни (без имён, если не хочешь).', dare: 'Прошепчи на ухо игроку слева одну пошлую фантазию в трёх словах — или замени на комплимент, если так комфортнее.' },
  { id: 'td_18b', categorySlug: '18plus', is18Plus: true, safe: false, premium: false, truth: 'Что тебя заводит в человеке сильнее всего — и ты никогда вслух это не говорил(а)?', dare: 'Покажи «мой взгляд, когда хочу секса» — только глазами, 10 секунд.' },
  { id: 'td_18c', categorySlug: '18plus', is18Plus: true, safe: false, premium: false, truth: 'Самый странный поиск в браузере или в голове, связанный с 18+ темой?', dare: 'Сыграй сцену «утро после» в пантомиме — без слов, 20 секунд.' },
  { id: 'td_18d', categorySlug: '18plus', is18Plus: true, safe: false, premium: false, truth: 'С кем из знакомых ты бы хотел(а) провести ночь «без последствий» — если бы мир был игрой?', dare: 'Назови часть тела у себя, которой ты гордишься, и почему — одной фразой, серьёзным тоном.' },
  { id: 'td_18e', categorySlug: '18plus', is18Plus: true, safe: false, premium: false, truth: 'Что в постели тебе точно не нравится или надоело?', dare: 'Изобрази звук, который ты издаёшь в самый неподходящий момент (все смеются — ты молодец).' },
  { id: 'td_18f', categorySlug: '18plus', is18Plus: true, safe: false, premium: false, truth: 'Твоя самая грязная мысль о ком-то из этой комнаты (можно смягчить до «типа того»).', dare: 'Скажи двойное значение на любую бытовую фразу — три раза подряд, без повтора.' },

  // drunk_party (премium, пьяные — правда пошлее)
  { id: 'td_dp1', categorySlug: 'drunk_party', is18Plus: false, safe: false, premium: true, truth: 'После скольких «ещё по одной» ты начинаешь писать бывшим/бывшим подругам?', dare: 'Тост за «того, кто сегодня точно не встанет первым» — 15 секунд, с паузами для драмы.' },
  { id: 'td_dp2', categorySlug: 'drunk_party', is18Plus: false, safe: false, premium: true, truth: 'Самая стыдная ночь, о которой знаешь только ты и алкоголь?', dare: 'Танцуй под воображаемую музыку в стиле «я главный на кухне в 4 утра».' },
  { id: 'td_dp3', categorySlug: 'drunk_party', is18Plus: false, safe: false, premium: true, truth: 'Кого бы ты поцеловал(а) в этой комнате, если бы не было последствий и морали?', dare: 'Пройди «кошачью дорожку» между двумя игроками, стоя на четвереньках, и мяукни в конце.' },
  { id: 'td_dp4', categorySlug: 'drunk_party', is18Plus: false, safe: false, premium: true, truth: 'Честно: ты когда-нибудь занимался(ась) сексом под градусом и жалел(а)?', dare: 'Сделай селфи-лицо «я сейчас вру про количество шотов» — все оценивают по шкале 1–10.' },
  { id: 'td_dp5', categorySlug: 'drunk_party', is18Plus: false, safe: false, premium: true, truth: 'Какая твоя пьяная суперспособность и какой провал наутро?', dare: 'Изобрази, как ты флиртуешь с барной стойкой, когда стойки нет — только воздух.' },

  // couples
  { id: 'td_cp1', categorySlug: 'couples', is18Plus: false, safe: true, premium: false, truth: 'Что партнёр делает мелочью, а тебе это безумно нравится?', dare: 'Посмотри партнёру в глаза 30 секунд без слов — кто моргнёт первым, тот комплимент другому.' },
  { id: 'td_cp2', categorySlug: 'couples', is18Plus: false, safe: true, premium: false, truth: 'О чём ты молчишь, чтобы не портить идиллию?', dare: 'Сыграй сцену «первая встреча» за 20 секунд — оба участвуют, если пара в игре, иначе с воображаемым партнёром.' },
  { id: 'td_cp3', categorySlug: 'couples', is18Plus: false, safe: true, premium: false, truth: 'Какой бытовой спор у вас вечный?', dare: 'Обменяйтесь тремя комплиментами в стиле «я люблю тебя, потому что…» по очереди.' },
  { id: 'td_cp4', categorySlug: 'couples', is18Plus: false, safe: true, premium: false, truth: 'Когда ты последний раз ревновал(а) и к чему это привело?', dare: 'Сделай массаж плеч соседу справа 30 секунд или расскажи стих про любовь.' },

  // company
  { id: 'td_co1', categorySlug: 'company', is18Plus: false, safe: true, premium: false, truth: 'Какая игра или активность объединяет вашу компанию лучше всего?', dare: 'Придумай «девиз комнаты» из 5 слов — все хором повторяют трижды.' },
  { id: 'td_co2', categorySlug: 'company', is18Plus: false, safe: true, premium: false, truth: 'Кто тут самый ненадёжный в «я скоро буду»?', dare: 'Каждый по кругу добавляет одно слово к истории про вечеринку — ты начинаешь.' },
  { id: 'td_co3', categorySlug: 'company', is18Plus: false, safe: true, premium: false, truth: 'Какой формат посиделок ты бы повторил каждые выходные?', dare: 'Устрой «церемонию награждения» трём людям: самый смешной, самый спокойный, самый хаотичный.' },
  { id: 'td_co4', categorySlug: 'company', is18Plus: false, safe: true, premium: false, truth: 'О чём вы обычно спорите в групповом чате?', dare: 'Станцуй «общий успех» — все хлопают в такт, ты задаёшь ритм.' },

  // hard
  { id: 'td_h1', categorySlug: 'hard', is18Plus: false, safe: false, premium: true, truth: 'Какую правду о себе ты скрываешь, чтобы не разочаровывать людей?', dare: 'Скажи вслух то, о чём обычно думаешь, но молчишь — одно предложение.' },
  { id: 'td_h2', categorySlug: 'hard', is18Plus: false, safe: false, premium: true, truth: 'Кого ты считаешь фальшивым в этой комнате (можно уклончиво)?', dare: '30 секунд: отвечай на любой вопрос группы одним словом.' },
  { id: 'td_h3', categorySlug: 'hard', is18Plus: false, safe: false, premium: true, truth: 'За что тебе реально стыдно перед собой?', dare: 'Позволь кому угодно задать один «жёсткий» вопрос — ответь честно или пропусти раунд.' },
  { id: 'td_h4', categorySlug: 'hard', is18Plus: false, safe: false, premium: true, truth: 'Какую ошибку ты повторяешь снова и снова?', dare: 'Изобрази свою тревогу как персонажа — 15 секунд, без слов.' },

  // romance (premium)
  { id: 'td_r1', categorySlug: 'romance', is18Plus: false, safe: true, premium: true, truth: 'Какой жест для тебя = «я тебя выбираю» сильнее слов?', dare: 'Произнеси фразу из романтического фильма, глядя на игрока напротив — серьёзно, без смеха.' },
  { id: 'td_r2', categorySlug: 'romance', is18Plus: false, safe: true, premium: true, truth: 'Идеальное свидание в твоей голове — 3 пункта.', dare: 'Устрой «медленный танец» с пустым пространством или партнёром — 25 секунд.' },
  { id: 'td_r3', categorySlug: 'romance', is18Plus: false, safe: true, premium: true, truth: 'Что тебя цепляет в человеке в первые минуты?', dare: 'Напиши воздушное послание любви трём словам на выбор группы.' },
  { id: 'td_r4', categorySlug: 'romance', is18Plus: false, safe: true, premium: true, truth: 'Расскажи про поцелуй, который запомнился — без имён, если не хочешь.', dare: 'Сделай комплимент каждому в кругу в стиле «ты как…» (сравнение с чем угодно).' },

  // corporate
  { id: 'td_w1', categorySlug: 'corporate', is18Plus: false, safe: true, premium: false, truth: 'Какой софт или процесс реально спасает вашу команду каждый день?', dare: 'Презентуй ручку/кружку как стартап за 30 секунд — с проблемой, решением и CTA.' },
  { id: 'td_w2', categorySlug: 'corporate', is18Plus: false, safe: true, premium: false, truth: 'Самая смешная ситуация на созвоне за последний год?', dare: 'Изобрази «камера выключена, а ты ешь» — пантомима.' },
  { id: 'td_w3', categorySlug: 'corporate', is18Plus: false, safe: true, premium: false, truth: 'Какой коллеге ты благодарен за терпение — и за что?', dare: 'Сделай круг почёта: каждый называет одного «MVP недели» из присутствующих.' },
];

const cardsByCategory = new Map();
for (const c of TRUTH_DARE_CARDS) {
  const arr = cardsByCategory.get(c.categorySlug) || [];
  arr.push(c);
  cardsByCategory.set(c.categorySlug, arr);
}

const TD_ITEM_TO_CATEGORIES = {
  td_party: ['drunk_party', 'hard'],
  td_romance: ['romance'],
  td_18plus: ['18plus'],
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

/** Текст для модерации / отчётов */
export function getTruthDareCardSummary(card) {
  if (!card) return '';
  const t = card.truth != null ? String(card.truth) : '';
  const d = card.dare != null ? String(card.dare) : '';
  if (t && d) return `Правда: ${t} | Действие: ${d}`;
  return t || d || '';
}

export function getTruthDareCardById(cardId) {
  const id = String(cardId || '').trim();
  if (!id) return null;
  if (id.includes('__')) {
    const [a, b] = id.split('__');
    const ca = TRUTH_DARE_CARDS.find((c) => c.id === a);
    const cb = TRUTH_DARE_CARDS.find((c) => c.id === b);
    if (!ca || !cb) return null;
    return {
      id,
      truth: ca.truth,
      dare: cb.dare,
      categorySlug: ca.categorySlug,
      truthCardId: a,
      dareCardId: b,
      is18Plus: Boolean(ca.is18Plus || cb.is18Plus),
      safe: Boolean(ca.safe && cb.safe),
      premium: Boolean(ca.premium || cb.premium),
    };
  }
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
  const categorySlugs = migrateCategorySlugs(v.categorySlugs);
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
  mode: _mode = 'mixed', // legacy, не используется
  categorySlugs = DEFAULT_SETTINGS.categorySlugs,
  include18Plus = false,
  safeMode = true,
  playerHasPro = false,
  unlockedCategorySlugs = [],
  excludeCardIds = [],
} = {}) {
  const exclude = new Set(excludeCardIds || []);
  const selectedCats = new Set(migrateCategorySlugs(categorySlugs));
  const unlockedCats = new Set((unlockedCategorySlugs || []).map(String));

  const candidates = TRUTH_DARE_CARDS.filter((card) => {
    if (!selectedCats.has(card.categorySlug)) return false;
    if (exclude.has(card.id)) return false;
    if (!include18Plus && card.is18Plus) return false;
    if (safeMode && !card.safe) return false;
    if (card.premium && !playerHasPro && !unlockedCats.has(card.categorySlug)) return false;
    return true;
  });

  return pickOne(candidates);
}

/**
 * Правда и действие из разных карточек (больше разнообразия, не «жёсткая» пара).
 */
export function pickTruthDareDecoupled({
  mode: _mode = 'mixed',
  categorySlugs = DEFAULT_SETTINGS.categorySlugs,
  include18Plus = false,
  safeMode = true,
  playerHasPro = false,
  unlockedCategorySlugs = [],
  usedTruthCardIds = [],
  usedDareCardIds = [],
} = {}) {
  const selectedCats = new Set(migrateCategorySlugs(categorySlugs));
  const unlockedCats = new Set((unlockedCategorySlugs || []).map(String));
  const usedT = new Set(usedTruthCardIds || []);
  const usedD = new Set(usedDareCardIds || []);

  const eligible = TRUTH_DARE_CARDS.filter((card) => {
    if (!selectedCats.has(card.categorySlug)) return false;
    if (!include18Plus && card.is18Plus) return false;
    if (safeMode && !card.safe) return false;
    if (card.premium && !playerHasPro && !unlockedCats.has(card.categorySlug)) return false;
    return true;
  });

  if (!eligible.length) return null;

  let truthPool = eligible.filter((c) => !usedT.has(c.id));
  if (!truthPool.length) truthPool = [...eligible];

  const truthCard = pickOne(truthPool);
  if (!truthCard) return null;

  let dareCandidates = eligible.filter((c) => c.id !== truthCard.id);
  if (!dareCandidates.length) dareCandidates = [...eligible];

  let darePool = dareCandidates.filter((c) => !usedD.has(c.id));
  if (!darePool.length) darePool = [...dareCandidates];

  const dareCard = pickOne(darePool);
  if (!dareCard) return null;

  return {
    id: `${truthCard.id}__${dareCard.id}`,
    truth: truthCard.truth,
    dare: dareCard.dare,
    categorySlug: truthCard.categorySlug,
    truthCardId: truthCard.id,
    dareCardId: dareCard.id,
    is18Plus: Boolean(truthCard.is18Plus || dareCard.is18Plus),
    safe: Boolean(truthCard.safe && dareCard.safe),
    premium: Boolean(truthCard.premium || dareCard.premium),
  };
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

  const ageConfirmedByPlayerId = {};
  for (const pid of playerOrder) ageConfirmedByPlayerId[pid] = false;
  if (room.hostId && ageConfirmedByPlayerId[room.hostId] !== undefined) {
    ageConfirmedByPlayerId[room.hostId] = true;
  }

  const currentCard = pickTruthDareDecoupled({
    categorySlugs: s.categorySlugs,
    include18Plus: s.show18Plus && Boolean(ageConfirmedByPlayerId[firstPlayerId]),
    safeMode: s.safeMode,
    playerHasPro: firstHasPro,
    unlockedCategorySlugs: firstUnlockedCategorySlugs,
    usedTruthCardIds: [],
    usedDareCardIds: [],
  });

  gs.phase = 'round';
  gs.settings = s;
  gs.playerOrder = playerOrder;
  gs.ageConfirmedByPlayerId = ageConfirmedByPlayerId;
  gs.currentPlayerIndex = currentPlayerIndex;
  gs.roundIndex = 0;
  gs.currentPlayerId = firstPlayerId;
  gs.usedTruthCardIds = currentCard ? [currentCard.truthCardId] : [];
  gs.usedDareCardIds = currentCard ? [currentCard.dareCardId] : [];
  gs.currentCard = currentCard || null;
  gs.skipCountByPlayerId = {};
  gs.playerStats = {};
  for (const pid of playerOrder) {
    gs.skipCountByPlayerId[pid] = 0;
    gs.playerStats[pid] = { done: 0, skip: 0, timeout: 0, truth: 0, dare: 0 };
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

  gs.turnToken = 1;
  gs.turnStartedAt = gs.createdAt;
  gs.turnEndsAt = gs.turnStartedAt + s.timerSeconds * 1000;
  gs.turnTimeoutId = null;
  return gs;
}
