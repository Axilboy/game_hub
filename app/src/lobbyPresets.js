/** Единый источник дефолтных настроек лобби при выборе игры (как в модалке Lobby). */

import { generateTwoTeamNames } from './teamNames';

export const VALID_LOBBY_PRESET_IDS = new Set(['spy', 'mafia', 'elias', 'truth_dare', 'bunker', 'munchkin']);

export const BUNKER_DEFAULT_PHASE_TIMERS = {
  intro: 15,
  reveals: 10,
  discussion: 25,
  voting: 25,
  tieBreak: 10,
  roundEvent: 15,
  final: 20,
};

export const BUNKER_SPEED_PRESETS = [
  { id: 'fast', label: 'Быстро', mult: 0.75 },
  { id: 'standard', label: 'Стандарт', mult: 1 },
  { id: 'long', label: 'Длинно', mult: 1.3 },
];

/** Сценарии бункера (лобби + сводка для гостей) */
export const BUNKER_SCENARIOS = [
  { id: 'shelter_default', label: 'Классический', premium: false, itemId: null },
  { id: 'pandemic_plus', label: 'Пандемия+', premium: true, itemId: 'bunker_pandemic' },
  { id: 'orbital_station', label: 'Орбита', premium: true, itemId: 'bunker_space' },
];

export const BUNKER_ROUND_OPTIONS = [2, 3, 4];

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

export function bunkerPhaseTimersFromSpeed(speedId) {
  const preset = BUNKER_SPEED_PRESETS.find((p) => p.id === speedId) || BUNKER_SPEED_PRESETS[1];
  const mult = preset.mult;
  const toSec = (val) => clamp(Math.round(val * mult), 5, 120);
  return {
    intro: toSec(BUNKER_DEFAULT_PHASE_TIMERS.intro),
    reveals: toSec(BUNKER_DEFAULT_PHASE_TIMERS.reveals),
    discussion: toSec(BUNKER_DEFAULT_PHASE_TIMERS.discussion),
    voting: toSec(BUNKER_DEFAULT_PHASE_TIMERS.voting),
    tieBreak: toSec(BUNKER_DEFAULT_PHASE_TIMERS.tieBreak),
    roundEvent: toSec(BUNKER_DEFAULT_PHASE_TIMERS.roundEvent),
    final: toSec(BUNKER_DEFAULT_PHASE_TIMERS.final),
  };
}

/**
 * @param {string} gameId
 * @returns {object | undefined}
 */
export function getDefaultGameSettings(gameId) {
  switch (gameId) {
    case 'spy':
      return {
        timerEnabled: false,
        timerSeconds: 60,
        spyCount: 1,
        allSpiesChanceEnabled: false,
        spiesSeeEachOther: false,
        showLocationsList: false,
        dictionaryIds: ['free'],
      };
    case 'mafia':
      return {
        extended: false,
        revealRoleOnDeath: true,
        mafiaCanSkipKill: false,
        hostSelection: 'random',
        mafiaRolesMode: 'random',
        theme: 'default',
        phaseTimers: {
          prepDay: 90,
          nightMeet: 45,
          nightMafia: 45,
          nightCommissioner: 25,
          day: 90,
          voting: 45,
          roleSetup: 120,
        },
      };
    case 'elias': {
      const [e1, e2] = generateTwoTeamNames();
      return {
        timerSeconds: 60,
        scoreLimit: 10,
        skipPenalty: 1,
        dictionaryIds: ['basic', 'animals', 'memes'],
        eliasTeams: [
          { name: e1, playerIds: [] },
          { name: e2, playerIds: [] },
        ],
        eliasLobbyWins: [0, 0],
      };
    }
    case 'truth_dare': {
      return {
        mode: 'mixed',
        show18Plus: false,
        safeMode: true,
        roundsCount: 5,
        categorySlugs: ['classic', 'friends'],
        /** Порядок id игроков в лобби (ведущий перетаскивает карточки) */
        truthDareTurnOrder: [],
        /** host — по очереди; random — каждый ход случайный игрок */
        truthDareOrderMode: 'host',
      };
    }
    case 'bunker':
      return {
        maxRounds: 3,
        phaseSpeed: 'standard',
        phaseTimers: bunkerPhaseTimersFromSpeed('standard'),
        scenarioId: 'shelter_default',
      };
    case 'munchkin':
      return {
        mode: 'shared',
        winLevel: 10,
      };
    default:
      return undefined;
  }
}
