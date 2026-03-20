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

const PROFESSIONS = ['Врач', 'Инженер', 'Архивариус', 'Навигатор', 'Психолог', 'Электрик'];
const SKILLS = ['Мастер ремонта', 'Спокойствие', 'Смекалка', 'Наблюдательность', 'Коммуникация', 'Лидерство'];
const PHOBIAS = ['Темнота', 'Высота', 'Одиночество', 'Громкие звуки', 'Замкнутое пространство', 'Кровь'];
const BAGGAGES = ['Фотография', 'Аптечка', 'Книга', 'Фляга', 'Компас', 'Блокнот'];

const CRISES = [
  { id: 'cr1', name: 'Тяга вентиляции упала', description: 'Воздух хуже, но паники не будет — пока есть дисциплина.' },
  { id: 'cr2', name: 'Срыв поставок', description: 'Новые ресурсы не приходят. Придётся пересмотреть приоритеты.' },
  { id: 'cr3', name: 'Неизвестный сигнал', description: 'Кто-то слышит “эхо”. Время на проверку ограничено.' },
  { id: 'cr4', name: 'Тепловой контур дымит', description: 'Система перегревается. Нужно решать: чинить или экономить.' },
  { id: 'cr5', name: 'Нарушение режима хранения', description: 'Часть запасов оказалась под угрозой. Действуйте быстро.' },
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
  return { maxRounds, phaseTimers };
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

  return {
    phase: 'intro',
    phaseStartedAt: Date.now(),
    phaseDurationSec: normalized.phaseTimers.intro,
    phaseToken: 1,
    bunkerPhaseTimeoutId: null,

    settings: normalized,
    maxRounds: normalized.maxRounds,
    roundIndex: 0, // сколько раундов уже завершено

    playerOrder,
    alive: [...playerOrder],
    eliminated: [], // { id, by, at }

    characters,
    currentCrisis: pickOne(CRISES),

    discussionNotes: null,
    votes: {}, // voterId -> targetId
    tieCandidates: null, // [playerId, ...] if tie in voting
  };
}

export function pickNextCrisis() {
  return pickOne(CRISES);
}

