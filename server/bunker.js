const DEFAULT_BUNKER_PHASE_TIMERS = {
  intro: 15,
  reveals: 10,
  discussion: 25,
  voting: 25,
  tieBreak: 10,
  roundEvent: 15,
  final: 20,
};

const DEFAULT_MAX_ROUNDS = 3;
const DEFAULT_SCENARIO_ID = 'shelter_default';

/** Базовые поля карточки (есть у всех) */
export const BUNKER_BASE_FIELD_KEYS = ['profession', 'skill', 'phobia', 'baggage'];

/** Доп. поля для Pro / покупки «Расширенный профиль» */
export const BUNKER_PREMIUM_FIELD_KEYS = ['gender', 'age', 'disease', 'body', 'hobby', 'secret'];

export const BUNKER_EXTENDED_PROFILE_ITEM_ID = 'bunker_extended_profile';

export const BUNKER_FIELD_LABELS = {
  profession: 'Профессия',
  skill: 'Навык',
  phobia: 'Фобия',
  baggage: 'Багаж',
  gender: 'Пол',
  age: 'Возраст',
  disease: 'Здоровье',
  body: 'Телосложение',
  hobby: 'Хобби',
  secret: 'Секрет',
};

const PROFESSIONS = [
  'Врач',
  'Инженер',
  'Архивариус',
  'Навигатор',
  'Психолог',
  'Электрик',
  'Агроном',
  'Биохимик',
  'Повар',
  'Пожарный',
  'Механик',
  'Пилот',
];
const SKILLS = [
  'Мастер ремонта',
  'Спокойствие',
  'Смекалка',
  'Наблюдательность',
  'Коммуникация',
  'Лидерство',
  'Первая помощь',
  'Выживание',
  'Переговоры',
  'Точная стрельба',
  'Планирование',
  'Обучаемость',
];
const PHOBIAS = [
  'Темнота',
  'Высота',
  'Одиночество',
  'Громкие звуки',
  'Замкнутое пространство',
  'Кровь',
  'Насекомые',
  'Огонь',
  'Вода',
  'Толпа',
  'Болезни',
  'Шторм',
];
const BAGGAGES = [
  'Фотография',
  'Аптечка',
  'Книга',
  'Фляга',
  'Компас',
  'Блокнот',
  'Рация',
  'Фонарь',
  'Набор инструментов',
  'Фильтр воды',
  'Сухпаек',
  'Семена',
];

const GENDERS = ['Мужчина', 'Женщина', 'Небинарная персона'];
const AGES = ['18–25 лет', '26–35 лет', '36–45 лет', '46–60 лет', '60+ лет'];
const DISEASES = [
  'Астма (лёгкая)',
  'Аллергия на пыль',
  'Гипертония',
  'Сахарный диабет 2 типа',
  'Проблемы с сердцем',
  'Хроническая боль в спине',
  'Псориаз',
  'Сниженный иммунитет',
  'Мигрени',
  'Проблемы с зрением',
  'Анемия',
  'Бессонница',
];
const BODIES = [
  'Худощавое',
  'Атлетичное',
  'Крепкое',
  'Полное',
  'Высокий рост',
  'Низкий рост',
  'После травмы (хромает)',
  'Отличная выносливость',
];
const HOBBIES = [
  'Шахматы',
  'Гитара',
  'Вязание',
  'Бег',
  'Чтение',
  'Рисование',
  'Настольные игры',
  'Кулинария',
  'Фотография',
  'Йога',
  'Пение',
  'Охота за металлоломом',
];
const SECRETS = [
  'Бывший военный',
  'Сидел в тюрьме (мелочь)',
  'Потерял семью в катастрофе',
  'Врач без лицензии',
  'Шпион другой страны (легенда)',
  'Знает код от запасного выхода',
  'Виноват в смерти человека (случайно)',
  'Носитель редкой крови',
  'Боится признаться в болезни',
  'Когда-то предал команду',
  'Тайно влюблён в кого-то из группы',
  'Видел «что-то» снаружи',
];

const CRISES = [
  { id: 'cr1', name: 'Тяга вентиляции упала', description: 'Воздух хуже, но паники не будет — пока есть дисциплина.' },
  { id: 'cr2', name: 'Срыв поставок', description: 'Новые ресурсы не приходят. Придётся пересмотреть приоритеты.' },
  { id: 'cr3', name: 'Неизвестный сигнал', description: 'Кто-то слышит “эхо”. Время на проверку ограничено.' },
  { id: 'cr4', name: 'Тепловой контур дымит', description: 'Система перегревается. Нужно решать: чинить или экономить.' },
  { id: 'cr5', name: 'Нарушение режима хранения', description: 'Часть запасов оказалась под угрозой. Действуйте быстро.' },
  { id: 'cr6', name: 'Перебой генератора', description: 'Энергия падает рывками, требуется перераспределить нагрузку.' },
  { id: 'cr7', name: 'Риск заражения', description: 'Один из контуров мог быть заражен. Нужен строгий протокол.' },
  { id: 'cr8', name: 'Пыльная буря снаружи', description: 'Любой выход наружу крайне опасен в течение раунда.' },
  { id: 'cr9', name: 'Срыв связи', description: 'Внешний канал связи пропал, решения принимаются только локально.' },
  { id: 'cr10', name: 'Падение температуры', description: 'Система обогрева не справляется, важно сохранить ресурсы.' },
  { id: 'cr11', name: 'Протечка воды', description: 'Резервуар поврежден, команда должна сократить расход.' },
  { id: 'cr12', name: 'Конфликт в команде', description: 'Эмоциональное напряжение растет, нужен сильный медиатор.' },
];

export const BUNKER_SCENARIOS = [
  { id: 'shelter_default', name: 'Классический бункер', premium: false, itemId: null, mood: 'balanced' },
  { id: 'pandemic_plus', name: 'Пандемия+', premium: true, itemId: 'bunker_pandemic', mood: 'medical' },
  { id: 'orbital_station', name: 'Орбитальная станция', premium: true, itemId: 'bunker_space', mood: 'space' },
];

function pickOne(arr) {
  if (!arr?.length) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Pro или купленный пак «Расширенный профиль» */
export function playerHasExtendedBunkerProfile(playerId, room) {
  const inv = room?.playerInventories || {};
  const candidates = [playerId, String(playerId)];
  if (typeof playerId === 'string' && /^\d+$/.test(playerId)) {
    const n = Number(playerId);
    if (!Number.isNaN(n)) candidates.push(n);
  }
  for (const k of candidates) {
    const p = inv[k];
    if (!p) continue;
    if (p.hasPro) return true;
    const u = Array.isArray(p.unlockedItems) ? p.unlockedItems : [];
    if (u.includes(BUNKER_EXTENDED_PROFILE_ITEM_ID)) return true;
  }
  return false;
}

export function buildBunkerCharacter(extended) {
  const c = {
    profession: pickOne(PROFESSIONS),
    skill: pickOne(SKILLS),
    phobia: pickOne(PHOBIAS),
    baggage: pickOne(BAGGAGES),
  };
  if (extended) {
    c.gender = pickOne(GENDERS);
    c.age = pickOne(AGES);
    c.disease = pickOne(DISEASES);
    c.body = pickOne(BODIES);
    c.hobby = pickOne(HOBBIES);
    c.secret = pickOne(SECRETS);
  }
  return c;
}

/** Все ключи полей персонажа (для проверки «всё раскрыто») */
export function getCharacterFieldKeys(character) {
  if (!character || typeof character !== 'object') return [];
  return Object.keys(character).filter((k) => character[k] != null && character[k] !== '');
}

export function bunkerPlayerHasUnrevealed(gs, playerId) {
  const ch = gs.characters?.[playerId];
  const rev = gs.revealedFields?.[playerId] || {};
  for (const key of getCharacterFieldKeys(ch)) {
    if (!rev[key]) return true;
  }
  return false;
}

export function bunkerAllRevealsComplete(gs) {
  const alive = gs.alive || [];
  for (const pid of alive) {
    if (bunkerPlayerHasUnrevealed(gs, pid)) return false;
  }
  return alive.length > 0;
}

/** Следующий живой игрок по кругу с хотя бы одним нераскрытым полем (после currentId) */
export function bunkerNextRevealPlayerId(gs, currentPlayerId) {
  const order = gs.playerOrder || [];
  const alive = new Set(gs.alive || []);
  const startIdx = order.findIndex((id) => String(id) === String(currentPlayerId));
  if (startIdx < 0) return null;
  for (let step = 1; step <= order.length; step++) {
    const idx = (startIdx + step) % order.length;
    const pid = order[idx];
    if (!alive.has(pid)) continue;
    if (bunkerPlayerHasUnrevealed(gs, pid)) return pid;
  }
  return null;
}

export function getInitialRevealTurnPlayerId(gs) {
  const order = gs.playerOrder || [];
  const alive = new Set(gs.alive || []);
  for (const id of order) {
    if (alive.has(id) && bunkerPlayerHasUnrevealed(gs, id)) return id;
  }
  return order.find((id) => alive.has(id)) || null;
}

export function normalizeBunkerSettings(input) {
  const v = input && typeof input === 'object' ? input : {};
  const phaseTimersIn = v.phaseTimers && typeof v.phaseTimers === 'object' ? v.phaseTimers : {};
  const toSec = (val, fallback) => Math.min(120, Math.max(5, Number(val) || fallback));
  const phaseTimers = {
    intro: toSec(phaseTimersIn.intro, DEFAULT_BUNKER_PHASE_TIMERS.intro),
    reveals: toSec(phaseTimersIn.reveals, DEFAULT_BUNKER_PHASE_TIMERS.reveals),
    discussion: toSec(phaseTimersIn.discussion, DEFAULT_BUNKER_PHASE_TIMERS.discussion),
    voting: toSec(phaseTimersIn.voting, DEFAULT_BUNKER_PHASE_TIMERS.voting),
    tieBreak: toSec(phaseTimersIn.tieBreak, DEFAULT_BUNKER_PHASE_TIMERS.tieBreak),
    roundEvent: toSec(phaseTimersIn.roundEvent, DEFAULT_BUNKER_PHASE_TIMERS.roundEvent),
    final: toSec(phaseTimersIn.final, DEFAULT_BUNKER_PHASE_TIMERS.final),
  };
  const maxRounds = Math.min(10, Math.max(1, Number(v.maxRounds) || DEFAULT_MAX_ROUNDS));
  const scenarioId = typeof v.scenarioId === 'string' ? v.scenarioId : DEFAULT_SCENARIO_ID;
  return { maxRounds, phaseTimers, scenarioId };
}

export function canUseBunkerScenario({ scenarioId, playerHasPro = false, unlockedItems = [] } = {}) {
  const scenario = BUNKER_SCENARIOS.find((s) => s.id === scenarioId) || BUNKER_SCENARIOS[0];
  if (!scenario.premium) return true;
  if (playerHasPro) return true;
  return Array.isArray(unlockedItems) && !!scenario.itemId && unlockedItems.includes(scenario.itemId);
}

export function createBunkerState(room, settings = {}) {
  const normalized = normalizeBunkerSettings(settings);
  const playerOrder = (room.players || []).map((p) => p.id);

  const characters = {};
  for (const p of room.players || []) {
    const ext = playerHasExtendedBunkerProfile(p.id, room);
    characters[p.id] = buildBunkerCharacter(ext);
  }

  const initialCrisis = pickOne(CRISES);
  return {
    phase: 'intro',
    phaseStartedAt: Date.now(),
    phaseDurationSec: normalized.phaseTimers.intro,
    phaseToken: 1,
    bunkerPhaseTimeoutId: null,

    settings: normalized,
    scenarioId: normalized.scenarioId || DEFAULT_SCENARIO_ID,
    maxRounds: normalized.maxRounds,
    roundIndex: 0,

    playerOrder,
    alive: [...playerOrder],
    eliminated: [],

    characters,
    revealedFields: {}, // playerId -> { fieldKey: true }
    revealTurnPlayerId: null,

    currentCrisis: initialCrisis,
    crisisHistory: initialCrisis ? [{ id: initialCrisis.id, name: initialCrisis.name, at: Date.now() }] : [],

    discussionNotes: null,
    votes: {},
    tieCandidates: null,
  };
}

export function pickNextCrisis() {
  return pickOne(CRISES);
}
