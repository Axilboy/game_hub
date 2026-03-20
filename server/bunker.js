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

const PROFESSIONS = ['Врач', 'Инженер', 'Архивариус', 'Навигатор', 'Психолог', 'Электрик', 'Агроном', 'Биохимик', 'Повар', 'Пожарный', 'Механик', 'Пилот'];
const SKILLS = ['Мастер ремонта', 'Спокойствие', 'Смекалка', 'Наблюдательность', 'Коммуникация', 'Лидерство', 'Первая помощь', 'Выживание', 'Переговоры', 'Точная стрельба', 'Планирование', 'Обучаемость'];
const PHOBIAS = ['Темнота', 'Высота', 'Одиночество', 'Громкие звуки', 'Замкнутое пространство', 'Кровь', 'Насекомые', 'Огонь', 'Вода', 'Толпа', 'Болезни', 'Шторм'];
const BAGGAGES = ['Фотография', 'Аптечка', 'Книга', 'Фляга', 'Компас', 'Блокнот', 'Рация', 'Фонарь', 'Набор инструментов', 'Фильтр воды', 'Сухпаек', 'Семена'];

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
    characters[p.id] = {
      profession: pickOne(PROFESSIONS),
      skill: pickOne(SKILLS),
      phobia: pickOne(PHOBIAS),
      baggage: pickOne(BAGGAGES),
    };
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
    roundIndex: 0, // сколько раундов уже завершено

    playerOrder,
    alive: [...playerOrder],
    eliminated: [], // { id, by, at }

    characters,
    currentCrisis: initialCrisis,
    crisisHistory: initialCrisis ? [{ id: initialCrisis.id, name: initialCrisis.name, at: Date.now() }] : [],

    discussionNotes: null,
    votes: {}, // voterId -> targetId
    tieCandidates: null, // [playerId, ...] if tie in voting
  };
}

export function pickNextCrisis() {
  return pickOne(CRISES);
}

