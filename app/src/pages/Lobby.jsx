import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import useSeo from '../hooks/useSeo';
import { api, getApiErrorMessage } from '../api';
import { track } from '../analytics';
import { showAdIfNeeded } from '../ads';
import { getInventory } from '../inventory';
import { getAvatar, getProfilePhoto, resolvePublicDisplayName } from '../displayName';
import { exportCustomDictionariesText, getCustomDictionaries, importCustomDictionariesText, saveCustomEliasWords } from '../customDictionaries';
import { buildInviteLinks, shareInviteSmart } from '../invite';
import ShopModal from '../components/ShopModal';
import { useToast } from '../components/ui/ToastProvider';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import PageLayout from '../components/layout/PageLayout';
import AppHeaderRight from '../components/layout/AppHeaderRight';
import Badge from '../components/ui/Badge';
import EmptyState from '../components/ui/EmptyState';
import {
  BUNKER_ROUND_OPTIONS,
  BUNKER_SCENARIOS,
  BUNKER_SPEED_PRESETS,
  bunkerPhaseTimersFromSpeed,
  getDefaultGameSettings,
} from '../lobbyPresets';
import { buildAutoPartyTeams, shufflePartyTeams } from '../lobbyTeamUtils';
import { generateOneTeamName } from '../teamNames';
import LobbyGameSummaryCard from '../components/lobby/LobbyGameSummaryCard';
import LobbySettingsSheet from '../components/lobby/LobbySettingsSheet';
import './lobbyPage.css';

/** Включить экран «Пользовательский словарь» Элиас (когда доработаем) */
const ELIAS_CUSTOM_DICT_UI_ENABLED = false;

const BASE_URL = import.meta.env.VITE_BASE_URL || window.location.origin;
const BOT_USERNAME = import.meta.env.VITE_BOT_USERNAME || '';

const TIMER_OPTIONS = [
  { label: '1 мин', value: 60 },
  { label: '2 мин', value: 120 },
  { label: '3 мин', value: 180 },
  { label: '5 мин', value: 300 },
];

const SPY_COUNT_OPTIONS = [1, 2, 3];
const DICT_NAMES = {
  free: 'Базовый',
  theme1: 'Детектив (Премиум)',
  theme2: 'Пираты (Премиум)',
  travel: 'Путешествия (Премиум)',
  food: 'Еда (Премиум)',
  sports: 'Спорт (Премиум)',
  movies: 'Кино (Премиум)',
  music: 'Музыка (Премиум)',
  nature: 'Природа (Премиум)',
  science: 'Наука (Премиум)',
  history: 'История (Премиум)',
  art: 'Искусство (Премиум)',
  tech: 'Технологии (Премиум)',
};
const MIN_PLAYERS = { mafia: 4, elias: 2, truth_dare: 2, bunker: 4 };
function minSpyPlayers(spyCount) {
  const n = Math.min(3, Math.max(1, parseInt(spyCount, 10) || 1));
  return n + 2;
}

const SPY_DICT_CARDS = [
  { id: 'free', name: 'Базовый', description: 'Классические локации: ресторан, больница, школа и др.', emoji: '📍', free: true },
  { id: 'theme1', name: 'Детектив', description: 'Шпионы, агенты, шифры и конспирация.', emoji: '🕵️', free: false },
  { id: 'theme2', name: 'Пираты', description: 'Корабли, сокровища, острова и море.', emoji: '🏴‍☠️', free: false },
  { id: 'travel', name: 'Путешествия', description: 'Аэропорт, отель, пляж, круиз, сафари.', emoji: '✈️', free: false },
  { id: 'food', name: 'Еда', description: 'Ресторан, кафе, пиццерия, кухня, бар.', emoji: '🍽️', free: false },
  { id: 'sports', name: 'Спорт', description: 'Стадион, спортзал, бассейн, каток, боулинг.', emoji: '⚽', free: false },
  { id: 'movies', name: 'Кино', description: 'Кинотеатр, премьера, блокбастер, Оскар.', emoji: '🎬', free: false },
  { id: 'music', name: 'Музыка', description: 'Концерт, опера, студия, фестиваль, караоке.', emoji: '🎵', free: false },
  { id: 'nature', name: 'Природа', description: 'Лес, море, парк, водопад, заповедник.', emoji: '🌲', free: false },
  { id: 'science', name: 'Наука', description: 'Лаборатория, обсерватория, музей науки.', emoji: '🔬', free: false },
  { id: 'history', name: 'История', description: 'Замок, музей, дворец, руины, памятник.', emoji: '🏛️', free: false },
  { id: 'art', name: 'Искусство', description: 'Галерея, выставка, ателье, вернисаж.', emoji: '🎨', free: false },
  { id: 'tech', name: 'Технологии', description: 'Офис, коворкинг, киберспорт, VR-зона.', emoji: '💻', free: false },
];

const ELIAS_DICT_CARDS = [
  { id: 'basic', name: 'Базовый', description: 'Быт, природа, город — универсальный микс.', emoji: '📦', free: true },
  { id: 'animals', name: 'Животные', description: 'Звери, птицы, морские обитатели.', emoji: '🦁', free: true },
  { id: 'memes', name: 'Интернет и мемы', description: 'Соцсети, стримы, сленг — без объяснения мемов словами мема.', emoji: '📱', free: true },
  { id: 'movies', name: 'Кино', description: 'Жанры, премьеры, съёмочный сленг.', emoji: '🎬', free: false },
  { id: 'science', name: 'Наука', description: 'Физика, биология, космос.', emoji: '🔬', free: false },
  { id: 'sport', name: 'Спорт', description: 'Дисциплины, турниры, эмоции.', emoji: '⚽', free: false },
  { id: 'travel', name: 'Путешествия', description: 'Поездки, транспорт, отдых.', emoji: '✈️', free: false },
  { id: 'food', name: 'Еда', description: 'Блюда, кухни, ресторанный мир.', emoji: '🍽️', free: false },
  { id: 'kids', name: 'Семейный', description: 'Мягко и понятно для детей.', emoji: '🧸', free: false },
];

const ELIAS_DICT_NAMES = Object.fromEntries(ELIAS_DICT_CARDS.map((c) => [c.id, c.name]));

const TD_CATEGORIES = [
  { slug: 'classic', name: 'Классика', emoji: '📗', description: 'Универсальные вопросы и задания для любой компании.', premium: false, is18Plus: false, safe: true },
  { slug: 'friends', name: 'Друзья', emoji: '👥', description: 'Про вашу тусовку, общие истории и внутренние шутки.', premium: false, is18Plus: false, safe: true },
  { slug: '18plus', name: '18+', emoji: '🔞', description: 'Откровенные темы — только после подтверждения возраста в игре.', premium: false, is18Plus: true, safe: false },
  { slug: 'drunk_party', name: 'Пьяная вечеринка', emoji: '🍻', description: 'Громко, весело, про алкоголь и ночные истории.', premium: true, is18Plus: false, safe: false, requiredItem: 'td_party' },
  { slug: 'couples', name: 'Пары', emoji: '💑', description: 'Отношения, нежность и бытовые сцены.', premium: false, is18Plus: false, safe: true },
  { slug: 'company', name: 'Компания', emoji: '🏢', description: 'Большая компания: чаты, тусовки, общие приключения.', premium: false, is18Plus: false, safe: true },
  { slug: 'hard', name: 'Без фильтра', emoji: '⚡', description: 'Острые вопросы и честность без смягчений.', premium: true, is18Plus: false, safe: false, requiredItem: 'td_party' },
  { slug: 'romance', name: 'Романтика', emoji: '🌹', description: 'Свидания, чувства, комплименты.', premium: true, is18Plus: false, safe: true, requiredItem: 'td_romance' },
  { slug: 'corporate', name: 'Корпоратив SFW', emoji: '💼', description: 'Офис, созвоны и коллеги — без пошлости.', premium: false, is18Plus: false, safe: true },
];

/** Карточки выбора режима в лобби (мин. игроков — ориентир для хоста) */
const LOBBY_GAMES = [
  { id: 'spy', name: 'Шпион', emoji: '🕵️', minPlayers: 3 },
  { id: 'mafia', name: 'Мафия', emoji: '🎭', minPlayers: 4 },
  { id: 'bunker', name: 'Бункер', emoji: '🛡️', minPlayers: 4 },
  { id: 'elias', name: 'Элиас', emoji: '📢', minPlayers: 2 },
  { id: 'truth_dare', name: 'Правда или действие', emoji: '🎲', minPlayers: 2 },
];

const EMPTY_GAME_SETTINGS_TABS = [];

/** Через сколько мс после ухода в офлайн хост автоматически исключает игрока */
const OFFLINE_KICK_MS = 30_000;

export default function Lobby({ room, roomId, user, onLeave, onRoomUpdate }) {
  useSeo({
    title: 'Лобби — GameHub',
    description: 'Игровая комната: настройки и приглашение только для участников.',
    robots: 'noindex, nofollow',
    siteName: 'GameHub',
  });
  const navigate = useNavigate();
  const { showToast } = useToast();
  const isHost = String(room?.hostId) === String(user?.id);
  const [gameSettingsSheetOpen, setGameSettingsSheetOpen] = useState(false);
  const [gameSettingsTab, setGameSettingsTab] = useState('presets');
  const [startingGame, setStartingGame] = useState(false);
  const [timerEnabled, setTimerEnabled] = useState(room?.gameSettings?.timerEnabled ?? false);
  const [timerSeconds, setTimerSeconds] = useState(room?.gameSettings?.timerSeconds ?? 60);
  const [spyCount, setSpyCount] = useState(room?.gameSettings?.spyCount ?? 1);
  const [allSpiesChanceEnabled, setAllSpiesChanceEnabled] = useState(!!room?.gameSettings?.allSpiesChanceEnabled);
  const [dictionaryIds, setDictionaryIds] = useState(room?.gameSettings?.dictionaryIds ?? ['free']);
  const [editingName, setEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState(room?.name || 'Лобби');
  const [shopOpen, setShopOpen] = useState(false);
  const [mafiaExtendedPopup, setMafiaExtendedPopup] = useState(false);
  const [mafiaClassicPopup, setMafiaClassicPopup] = useState(false);
  const [spyDictLockPopup, setSpyDictLockPopup] = useState(null);
  const [minPlayersWarning, setMinPlayersWarning] = useState(null);
  const [eliasCustomModalOpen, setEliasCustomModalOpen] = useState(false);
  const [eliasCustomWordsText, setEliasCustomWordsText] = useState('');
  const [eliasImportText, setEliasImportText] = useState('');
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  /** Выбранный в списке участников игрок (меню: хост / кик / друзья) */
  const [playerMenuPlayer, setPlayerMenuPlayer] = useState(null);
  /** id друзей текущего игрока (для кнопки «Уже в друзьях») */
  const [friendIds, setFriendIds] = useState(() => new Set());
  /** id игроков, которым уже отправлена заявка */
  const [outgoingPending, setOutgoingPending] = useState(() => new Set());
  /** Переименование команды Элиаса: { scope: 'elias', teamIndex, name } */
  const [teamRename, setTeamRename] = useState(null);
  /** Смена команды игрока: { targetId, targetName } */
  const [teamAssignOpen, setTeamAssignOpen] = useState(null);
  const [qrOpen, setQrOpen] = useState(false);
  /** Элиас: состав команд; П/Д — очередь `truthDareTurnOrder` (см. roomManager) */
  /** playerId → Date.now() при первом обнаружении offline (сброс при online) */
  const [offlineSince, setOfflineSince] = useState(() => ({}));
  /** Тик раз в секунду — обратный отсчёт на карточке офлайн-игрока */
  const [, setOfflineTick] = useState(0);
  const offlineKickInProgressRef = useRef(new Set());

  const roomName = room?.name || 'Лобби';
  const selectedGame = room?.selectedGame ?? null;
  const availableDictionaries = room?.availableDictionaries || ['free'];
  const roomHasPro = room?.players?.some((p) => p.hasPro) ?? false;
  const myInventory = getInventory();
  const hasCategoryPackAccess = (category) => {
    if (!category?.premium) return true;
    if (roomHasPro || myInventory?.hasPro) return true;
    const itemId = category.requiredItem;
    if (!itemId) return false;
    return Array.isArray(myInventory?.unlockedItems) && myInventory.unlockedItems.includes(itemId);
  };

  const tdGameSettings = room?.gameSettings || {};
  const tdSafeMode = tdGameSettings.safeMode !== false;
  const tdShow18Plus = Boolean(tdGameSettings.show18Plus);
  const tdRoundsCount = tdGameSettings.roundsCount ?? 5;
  const tdSkipLimitPerPlayer = tdGameSettings.skipLimitPerPlayer ?? 2;
  const tdCategorySlugs = Array.isArray(tdGameSettings.categorySlugs)
    ? tdGameSettings.categorySlugs
    : ['classic', 'friends'];

  const gameSettingsTabs = useMemo(() => {
    if (!selectedGame) return EMPTY_GAME_SETTINGS_TABS;
    switch (selectedGame) {
      case 'spy':
        return [
          { id: 'presets', label: 'Быстро' },
          { id: 'locations', label: 'Локации' },
          { id: 'timer', label: 'Таймер' },
          { id: 'more', label: 'Ещё' },
        ];
      case 'mafia':
        return [
          { id: 'mode', label: 'Режим' },
          { id: 'rules', label: 'Правила' },
          { id: 'host', label: 'Ведущий' },
        ];
      case 'elias':
        return [
          { id: 'timer', label: 'Счёт и время' },
          { id: 'dicts', label: 'Словари' },
          { id: 'teams', label: 'Команды' },
        ];
      case 'truth_dare':
        return [
          { id: 'main', label: 'Основное' },
          { id: 'cats', label: 'Категории' },
          { id: 'order', label: 'Очередь' },
        ];
      case 'bunker':
        return [
          { id: 'party', label: 'Раунды и фазы' },
          { id: 'scenario', label: 'Сценарий' },
        ];
      default:
        return [];
    }
  }, [selectedGame]);

  const gameSettingsSheetTitle = useMemo(() => {
    const t = { spy: 'Шпион', mafia: 'Мафия', elias: 'Элиас', truth_dare: 'Правда или действие', bunker: 'Бункер' };
    return selectedGame ? `Настройки: ${t[selectedGame] || selectedGame}` : 'Настройки';
  }, [selectedGame]);

  useEffect(() => {
    if (!selectedGame || gameSettingsTabs.length === 0) return;
    setGameSettingsTab(gameSettingsTabs[0].id);
  }, [selectedGame, gameSettingsTabs]);

  useEffect(() => {
    setEditNameValue(roomName);
  }, [roomName]);
  /** Синхронизация локального состояния шпиона только при изменении значений с сервера (не при каждом новом объекте gameSettings) */
  useEffect(() => {
    const gs = room?.gameSettings;
    if (!gs) return;
    setTimerEnabled(gs.timerEnabled ?? false);
    setTimerSeconds(gs.timerSeconds ?? 60);
    setSpyCount(gs.spyCount ?? 1);
    setAllSpiesChanceEnabled(!!gs.allSpiesChanceEnabled);
    const d = gs.dictionaryIds;
    setDictionaryIds(Array.isArray(d) ? [...d] : ['free']);
  }, [
    room?.gameSettings?.timerEnabled,
    room?.gameSettings?.timerSeconds,
    room?.gameSettings?.spyCount,
    room?.gameSettings?.allSpiesChanceEnabled,
    (room?.gameSettings?.dictionaryIds || []).join(','),
  ]);

  useEffect(() => {
    const players = room?.players || [];
    setOfflineSince((prev) => {
      const next = { ...prev };
      const ids = new Set(players.map((p) => p.id));
      Object.keys(next).forEach((id) => {
        if (!ids.has(id)) delete next[id];
      });
      for (const p of players) {
        if (p.online === false) {
          if (next[p.id] == null) next[p.id] = Date.now();
        } else {
          delete next[p.id];
        }
      }
      return next;
    });
  }, [room?.players]);

  useEffect(() => {
    const local = getCustomDictionaries();
    setEliasCustomWordsText((local.elias || []).join('\n'));
  }, []);

  const reloadFriendState = useCallback(async () => {
    if (!user?.id) return;
    try {
      const r = await api.get(`/friends/list?playerId=${encodeURIComponent(String(user.id))}`);
      setFriendIds(new Set((r.friends || []).map((x) => String(x.id))));
      setOutgoingPending(new Set((r.outgoingPendingIds || []).map((id) => String(id))));
    } catch (_) {
      setFriendIds(new Set());
      setOutgoingPending(new Set());
    }
  }, [user?.id]);

  useEffect(() => {
    reloadFriendState();
  }, [reloadFriendState, roomId]);

  useEffect(() => {
    const inv = getInventory();
    const avatarEmoji = getAvatar();
    const localPhoto = getProfilePhoto();
    api.patch(`/rooms/${roomId}/players/me`, {
      playerId: String(user?.id),
      inventory: { dictionaries: inv.dictionaries, unlockedItems: inv.unlockedItems || [], hasPro: inv.hasPro },
      photo_url: localPhoto || user?.photo_url || null,
      avatar_emoji: avatarEmoji || null,
    }).then((r) => {
      if (r.room) onRoomUpdate(r.room);
    }).catch(() => {});
  }, [roomId, user?.id]);

  let safeInviteToken = null;
  try {
    safeInviteToken = sessionStorage.getItem('inviteToken');
  } catch (_) {
    safeInviteToken = null;
  }
  const inviteToken = room?.inviteToken || safeInviteToken;
  const { miniAppLink, webLink, inviteLink } = buildInviteLinks({
    inviteToken,
    baseUrl: BASE_URL,
    botUsername: BOT_USERNAME,
  });
  const qrUrl = inviteLink ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(inviteLink)}` : '';

  const patchLobbyGame = async (updates) => {
    try {
      let payload = { ...updates };
      if (updates.gameSettings && room) {
        const mergedGs = { ...room.gameSettings, ...updates.gameSettings };
        if (Array.isArray(mergedGs.eliasTeams)) {
          const n = mergedGs.eliasTeams.length;
          let wins = [...(mergedGs.eliasLobbyWins || [])];
          while (wins.length < n) wins.push(0);
          if (wins.length > n) wins = wins.slice(0, n);
          mergedGs.eliasLobbyWins = wins;
        }
        payload = { ...payload, gameSettings: mergedGs };
      }
      const { room: r } = await api.patch(`/rooms/${roomId}`, {
        hostId: String(user?.id),
        ...payload,
      });
      if (r) onRoomUpdate(r);
    } catch (_) {}
  };

  /** Реклама у хоста перед переходом в игру (игроки — в App при уходе с лобби). */
  const showAdBeforeGameEnter = async () => {
    const uid = user?.id != null ? String(user.id) : '';
    const { adSdkShown } = await showAdIfNeeded();
    if (adSdkShown && uid) {
      try {
        await api.post('/stats/ad-shown', { playerId: uid });
      } catch (_) {}
    }
  };

  const startSpy = async () => {
    if (!isHost) return;
    const count = room?.players?.length ?? 0;
    const minSpy = minSpyPlayers(spyCount);
    if (count < minSpy) {
      setMinPlayersWarning(`Для игры в Шпион с ${spyCount} шпион${spyCount === 1 ? 'ом' : 'ами'} нужно минимум ${minSpy} игроков. Сейчас в лобби: ${count}.`);
      return;
    }
    if (!dictionaryIds?.length) {
      setMinPlayersWarning('Выберите хотя бы один набор локаций в настройках (можно сначала выключить все наборы, затем включить только нужные).');
      return;
    }
    setStartingGame(true);
    try {
      await api.post('/rooms/spy/start', {
        roomId,
        hostId: String(user?.id),
        timerEnabled,
        timerSeconds: timerEnabled ? timerSeconds : undefined,
        spyCount,
        allSpiesChanceEnabled,
        spiesSeeEachOther: !!room?.gameSettings?.spiesSeeEachOther,
        showLocationsList: !!room?.gameSettings?.showLocationsList,
        dictionaryIds: dictionaryIds?.length ? dictionaryIds : ['free'],
      });
      const { room: r } = await api.get(`/rooms/${roomId}`);
      onRoomUpdate(r);
      track('lobby_start_game', { game: 'spy' });
      await showAdBeforeGameEnter();
      navigate('/spy');
    } catch (e) {
      setStartingGame(false);
      setMinPlayersWarning(getApiErrorMessage(e, 'Не удалось запустить игру'));
    }
  };

  const startMafia = async (opts) => {
    if (!isHost) return;
    const count = room?.players?.length ?? 0;
    if (count < MIN_PLAYERS.mafia) {
      setMinPlayersWarning(`Для игры в Мафию нужно минимум ${MIN_PLAYERS.mafia} игроков. Сейчас в лобби: ${count}.`);
      return;
    }
    setStartingGame(true);
    try {
      const gs = room?.gameSettings || {};
      await api.post('/rooms/mafia/start', {
        roomId,
        hostId: String(user?.id),
        moderatorId: gs.hostSelection === 'choose' ? gs.moderatorId : undefined,
        extended: gs.extended ?? false,
        revealRoleOnDeath: gs.revealRoleOnDeath ?? true,
        mafiaCanSkipKill: gs.mafiaCanSkipKill ?? false,
        mafiaRolesMode: gs.mafiaRolesMode === 'moderator' ? 'moderator' : gs.mafiaRolesMode === 'player_vote' ? 'player_vote' : undefined,
        phaseTimers: gs.phaseTimers || {
          nightMafia: 45,
          nightCommissioner: 25,
          day: 90,
          voting: 45,
          roleSetup: 120,
        },
        ...opts,
      });
      const { room: r } = await api.get(`/rooms/${roomId}`);
      onRoomUpdate(r);
      track('lobby_start_game', { game: 'mafia' });
      await showAdBeforeGameEnter();
      navigate('/mafia');
    } catch (e) {
      setStartingGame(false);
      setMinPlayersWarning(getApiErrorMessage(e, 'Не удалось запустить игру'));
    }
  };

  const startElias = async () => {
    if (!isHost) return;
    const count = room?.players?.length ?? 0;
    if (count < MIN_PLAYERS.elias) {
      setMinPlayersWarning(`Для игры в Элиас нужно минимум ${MIN_PLAYERS.elias} игрока. Сейчас в лобби: ${count}.`);
      return;
    }
    const gs = room?.gameSettings || {};
    if (!Array.isArray(gs.dictionaryIds) || gs.dictionaryIds.length === 0) {
      setMinPlayersWarning('Выберите хотя бы один словарь в настройках (можно сначала выключить все, затем включить только нужные).');
      return;
    }
    const teams = gs.eliasTeams;
    /** Две пустые команды в настройках ≠ готовые команды: иначе сервер получает пустые массивы и ломает раскладку. */
    const eliasAssigned =
      Array.isArray(teams) && teams.reduce((sum, t) => sum + (t.playerIds?.length || 0), 0);
    const hasTeams = Array.isArray(teams) && teams.length >= 2 && eliasAssigned >= 2;
    if (hasTeams) {
      const totalPlaying = teams.reduce((sum, t) => sum + (t.playerIds?.length || 0), 0);
      const teamsWithPlayers = teams.filter((t) => (t.playerIds || []).length > 0).length;
      if (totalPlaying > 0 && totalPlaying < 2) {
        setMinPlayersWarning('В игре должно быть минимум 2 игрока. Добавьте игроков в команды.');
        return;
      }
      if (totalPlaying >= 2 && teamsWithPlayers < 2) {
        setMinPlayersWarning('Игроки должны быть минимум в двух разных командах. Распределите по командам.');
        return;
      }
    }
    try {
      setStartingGame(true);
      await api.post('/rooms/elias/start', {
      roomId,
      hostId: String(user?.id),
      timerSeconds: gs.timerSeconds ?? 60,
      scoreLimit: gs.scoreLimit ?? 10,
      skipPenalty: gs.skipPenalty ?? 1,
      dictionaryIds: gs.dictionaryIds?.length ? gs.dictionaryIds : ['basic', 'animals', 'memes'],
      customWords: Array.isArray(gs.eliasCustomWords) ? gs.eliasCustomWords : getCustomDictionaries().elias,
      teams: hasTeams ? teams : undefined,
      team1Ids: !hasTeams && gs.eliasTeam1Ids?.length ? gs.eliasTeam1Ids : undefined,
      team2Ids: !hasTeams && gs.eliasTeam2Ids?.length ? gs.eliasTeam2Ids : undefined,
    });
      const { room: r } = await api.get(`/rooms/${roomId}`);
      onRoomUpdate(r);
      track('lobby_start_game', { game: 'elias' });
      await showAdBeforeGameEnter();
      navigate('/elias');
    } catch (e) {
      setStartingGame(false);
      setMinPlayersWarning(getApiErrorMessage(e, 'Не удалось запустить игру'));
    }
  };

  const startBunker = async () => {
    if (!isHost) return;
    const count = room?.players?.length ?? 0;
    if (count < MIN_PLAYERS.bunker) {
      setMinPlayersWarning(`Для игры в Бункер нужно минимум ${MIN_PLAYERS.bunker} игроков. Сейчас в лобби: ${count}.`);
      return;
    }
    setStartingGame(true);
    try {
      const gs = room?.gameSettings || {};
      await api.post('/rooms/bunker/start', {
        roomId,
        hostId: String(user?.id),
        maxRounds: gs.maxRounds ?? 3,
        phaseTimers: gs.phaseTimers,
        scenarioId: gs.scenarioId || 'shelter_default',
      });
      const { room: r } = await api.get(`/rooms/${roomId}`);
      onRoomUpdate(r);
      track('lobby_start_game', { game: 'bunker' });
      await showAdBeforeGameEnter();
      navigate('/bunker');
    } catch (e) {
      setStartingGame(false);
      setMinPlayersWarning(getApiErrorMessage(e, 'Не удалось запустить игру'));
    }
  };

  const startTruthDare = async () => {
    if (!isHost) return;
    const count = room?.players?.length ?? 0;
    if (count < MIN_PLAYERS.truth_dare) {
      setMinPlayersWarning(`Для игры в Правда/действие нужно минимум ${MIN_PLAYERS.truth_dare} игроков. Сейчас в лобби: ${count}.`);
      return;
    }
    setStartingGame(true);
    try {
      const gs = room?.gameSettings || {};
      if (!Array.isArray(gs.categorySlugs) || gs.categorySlugs.length === 0) {
        setStartingGame(false);
        setMinPlayersWarning('Выберите хотя бы одну категорию карточек в настройках (можно сначала выключить все категории, затем включить только нужные).');
        return;
      }
      await api.post('/rooms/truth_dare/start', {
        roomId,
        hostId: String(user?.id),
        mode: gs.mode || 'mixed',
        categorySlugs: gs.categorySlugs,
        show18Plus: !!gs.show18Plus,
        safeMode: gs.safeMode !== false,
        roundsCount: gs.roundsCount ?? 5,
        timerSeconds: gs.timerSeconds ?? 60,
        skipLimitPerPlayer: gs.skipLimitPerPlayer ?? 2,
        randomStartPlayer: gs.randomStartPlayer !== false,
        truthDareOrderMode: gs.truthDareOrderMode,
        truthDareTurnOrder: gs.truthDareTurnOrder,
      });
      const { room: r } = await api.get(`/rooms/${roomId}`);
      onRoomUpdate(r);
      track('lobby_start_game', { game: 'truth_dare' });
      await showAdBeforeGameEnter();
      navigate('/truth_dare');
    } catch (e) {
      setStartingGame(false);
      setMinPlayersWarning(getApiErrorMessage(e, 'Не удалось запустить игру'));
    }
  };

  const saveRoomName = async () => {
    setEditingName(false);
    const name = (editNameValue || '').trim() || 'Лобби';
    if (name === roomName) return;
    try {
      await api.patch(`/rooms/${roomId}`, { hostId: String(user?.id), name });
      const { room: r } = await api.get(`/rooms/${roomId}`);
      onRoomUpdate(r);
    } catch (_) {}
  };

  const shareInvite = async () => {
    const result = await shareInviteSmart({
      roomName,
      miniAppLink,
      webLink,
      preferTelegram: true,
    });
    if (result.ok) {
      track('invite_share', { source: 'lobby', mode: result.mode || 'unknown' });
      showToast({
        type: result.mode === 'clipboard' ? 'success' : 'info',
        message: result.mode === 'clipboard' ? 'Ссылка скопирована — вставьте в чат' : 'Выберите чат для отправки',
      });
      return;
    }
    showToast({ type: 'error', message: 'Не удалось поделиться приглашением' });
  };

  const handleBack = () => {
    setLeaveConfirmOpen(true);
  };
  const confirmLeaveLobby = () => {
    setLeaveConfirmOpen(false);
    onLeave();
  };

  /** Системная «Назад» / жест не должны уводить на главную без выхода из комнаты — то же окно, что и в шапке */
  useEffect(() => {
    const guard = { ghLobbyBack: true };
    window.history.pushState(guard, '', window.location.href);

    const onPopState = () => {
      queueMicrotask(() => {
        navigate('/lobby', { replace: true });
        setLeaveConfirmOpen(true);
        window.history.pushState(guard, '', window.location.href);
      });
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [navigate]);

  const transferHostTo = async (newHostId) => {
    try {
      await api.post(`/rooms/${roomId}/transfer-host`, { playerId: String(user?.id), newHostId });
      showToast({ type: 'success', message: 'Хост передан' });
      setPlayerMenuPlayer(null);
      const { room: r } = await api.get(`/rooms/${roomId}`);
      onRoomUpdate(r);
    } catch (e) {
      showToast({ type: 'error', message: getApiErrorMessage(e, 'Не удалось передать хоста') });
    }
  };

  const kickPlayer = useCallback(
    async (playerIdToKick) => {
      try {
        await api.post(`/rooms/${roomId}/kick`, { hostId: String(user?.id), playerIdToKick });
        showToast({ type: 'success', message: 'Игрок исключён' });
        setPlayerMenuPlayer((m) => (m?.id === playerIdToKick ? null : m));
        const { room: r } = await api.get(`/rooms/${roomId}`);
        onRoomUpdate(r);
      } catch (e) {
        showToast({ type: 'error', message: getApiErrorMessage(e, 'Не удалось исключить игрока') });
      }
    },
    [roomId, user?.id, onRoomUpdate, showToast],
  );

  const addFriendFromLobby = async () => {
    const target = playerMenuPlayer;
    if (!target || !user?.id) return;
    if (String(target.id) === String(user.id)) return;
    try {
      await api.post('/friends/request', {
        playerId: String(user.id),
        targetId: String(target.id),
        requesterName: resolvePublicDisplayName(user),
      });
      showToast({ type: 'success', message: 'Заявка отправлена' });
      await reloadFriendState();
      setPlayerMenuPlayer(null);
    } catch (e) {
      showToast({ type: 'error', message: getApiErrorMessage(e, 'Не удалось отправить заявку') });
    }
  };

  useEffect(() => {
    const t = setInterval(() => {
      setOfflineTick((n) => n + 1);
      if (!isHost) return;
      const now = Date.now();
      const players = room?.players || [];
      for (const p of players) {
        if (p.online !== false || p.isHost) continue;
        if (p.id === String(user?.id)) continue;
        const start = offlineSince[p.id];
        if (start == null || now - start < OFFLINE_KICK_MS) continue;
        if (offlineKickInProgressRef.current.has(p.id)) continue;
        offlineKickInProgressRef.current.add(p.id);
        kickPlayer(p.id).finally(() => {
          offlineKickInProgressRef.current.delete(p.id);
        });
      }
    }, 1000);
    return () => clearInterval(t);
  }, [isHost, room?.players, offlineSince, user?.id, kickPlayer]);

  const copyRoomCode = useCallback(async () => {
    const code = room?.code != null ? String(room.code) : '';
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      showToast({ type: 'success', message: 'Код скопирован в буфер обмена' });
    } catch (_) {
      try {
        const ta = document.createElement('textarea');
        ta.value = code;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        showToast({ type: 'success', message: 'Код скопирован' });
      } catch (__) {
        showToast({ type: 'error', message: 'Не удалось скопировать код' });
      }
    }
  }, [room?.code, showToast]);

  const playersList = room.players || [];
  const lobbyPlayerCount = playersList.length;
  const minForSelectedGame = selectedGame
    ? (selectedGame === 'spy' ? minSpyPlayers(room?.gameSettings?.spyCount ?? 1) : MIN_PLAYERS[selectedGame] ?? 2)
    : 0;

  const ruPeopleWord = (n) => {
    const n10 = n % 10;
    const n100 = n % 100;
    if (n10 === 1 && n100 !== 11) return 'человек';
    if (n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20)) return 'человека';
    return 'человек';
  };

  const lobbyStatusText = (() => {
    if (!selectedGame) {
      if (!isHost) return 'Хост выбирает игру — подождите немного.';
      if (lobbyPlayerCount === 0) return 'Пока никого нет — отправьте друзьям код или ссылку.';
      return `В комнате ${lobbyPlayerCount} ${ruPeopleWord(lobbyPlayerCount)}. Выберите режим ниже.`;
    }
    const gameLabels = { spy: 'Шпион', mafia: 'Мафия', elias: 'Элиас', bunker: 'Бункер', truth_dare: 'Правда или действие' };
    const gn = gameLabels[selectedGame] || selectedGame;
    if (lobbyPlayerCount < minForSelectedGame) {
      return null;
    }
    return `${gn}: игроков достаточно — настройте режим и нажмите «Начать».`;
  })();

  const pp = playerMenuPlayer;
  const playerMenuIsSelf = Boolean(pp && pp.id === String(user?.id));
  const playerMenuCanHostActions = Boolean(isHost && pp && !playerMenuIsSelf && !pp.isHost);

  const partyTeams = selectedGame === 'elias' ? room?.gameSettings?.eliasTeams : null;
  const showPartyTeamsLayout =
    selectedGame === 'elias' && Array.isArray(partyTeams) && partyTeams.length >= 2;

  /** Порядок ходов П/Д: id из настроек + новые игроки в конце */
  const truthDareResolvedOrder = useMemo(() => {
    const players = room?.players || [];
    const ids = players.map((p) => String(p.id));
    const gs = room?.gameSettings;
    let order = Array.isArray(gs?.truthDareTurnOrder) ? gs.truthDareTurnOrder.map(String) : [];
    order = order.filter((id) => ids.includes(id));
    const seen = new Set(order);
    for (const id of ids) {
      if (!seen.has(id)) {
        order.push(id);
        seen.add(id);
      }
    }
    return order;
  }, [room?.gameSettings?.truthDareTurnOrder, room?.players]);
  const eliasLobbyWins = room?.gameSettings?.eliasLobbyWins;
  const myIdStr = user?.id != null ? String(user.id) : '';

  const submitTeamRename = async () => {
    if (!teamRename?.name?.trim()) return;
    try {
      await api.post(`/rooms/${roomId}/lobby/party-team-name`, {
        playerId: myIdStr,
        teamIndex: teamRename.teamIndex,
        name: teamRename.name.trim(),
        scope: teamRename.scope,
      });
      setTeamRename(null);
      const { room: r } = await api.get(`/rooms/${roomId}`);
      if (r) onRoomUpdate(r);
    } catch (e) {
      showToast({ type: 'error', message: getApiErrorMessage(e, 'Не удалось сохранить название') });
    }
  };

  const submitAssignTeam = async (teamIndex) => {
    if (!teamAssignOpen || !myIdStr) return;
    try {
      await api.post(`/rooms/${roomId}/lobby/assign-team`, {
        actorId: myIdStr,
        targetPlayerId: teamAssignOpen.targetId,
        teamIndex,
      });
      setTeamAssignOpen(null);
      const { room: r } = await api.get(`/rooms/${roomId}`);
      if (r) onRoomUpdate(r);
    } catch (e) {
      showToast({ type: 'error', message: getApiErrorMessage(e, 'Не удалось сменить команду') });
    }
  };

  const renderLobbyPlayerCard = (p) => {
    const offlineLeftSec =
      p.online === false && !p.isHost && offlineSince[p.id] != null
        ? Math.max(0, Math.ceil((OFFLINE_KICK_MS - (Date.now() - offlineSince[p.id])) / 1000))
        : null;
    return (
      <div
        role="button"
        tabIndex={0}
        className="gh-card lobby-player-card"
        onClick={() => setPlayerMenuPlayer(p)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setPlayerMenuPlayer(p);
          }
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            {p.avatar_emoji ? (
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
                {p.avatar_emoji}
              </div>
            ) : p.photo_url ? (
              <img src={p.photo_url} alt="" style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }} />
            ) : (
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--tg-theme-button-color, #3a7bd5)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 14 }}>
                {(p.name || '?')[0]}
              </div>
            )}
            {p.hasPro && !p.isHost && (
              <span style={{ position: 'absolute', bottom: -3, right: -3, fontSize: 14 }} title="Премиум">
                👑
              </span>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {p.name}
              <span style={{ marginLeft: 6 }}>
                {p.isHost ? <Badge tone="info">Хост</Badge> : null}
                {p.hasPro && !p.isHost ? (
                  <span style={{ marginLeft: 4 }}>
                    <Badge tone="warning">Премиум</Badge>
                  </span>
                ) : null}
                {p.online === false ? (
                  <span style={{ marginLeft: 4 }}>
                    <Badge tone="danger">Офлайн</Badge>
                  </span>
                ) : null}
              </span>
            </span>
            {offlineLeftSec != null ? (
              <span className="lobby-player-offline-countdown" aria-live="polite">
                Исключение через <strong className="lobby-player-offline-countdown__sec">{offlineLeftSec}</strong> с
              </span>
            ) : null}
          </div>
        </div>
      </div>
    );
  };

  return (
    <PageLayout
      title={roomName}
      onBack={handleBack}
      right={<AppHeaderRight user={user} />}
    >
      <div className="lobby-shell">
        <header className="lobby-room-head">
          {editingName && isHost ? (
            <input
              type="text"
              className="lobby-room-head__input"
              value={editNameValue}
              onChange={(e) => setEditNameValue(e.target.value)}
              onBlur={saveRoomName}
              onKeyDown={(e) => e.key === 'Enter' && saveRoomName()}
              autoFocus
            />
          ) : (
            <h2
              className={`lobby-room-head__title${isHost ? ' lobby-room-head__title--editable' : ''}`}
              onClick={() => isHost && setEditingName(true)}
              title={isHost ? 'Нажмите, чтобы изменить название' : ''}
            >
              {roomName}
            </h2>
          )}
        </header>

        <section className="lobby-invite" aria-label="Код и приглашение">
          <div className="lobby-invite__row">
            <button
              type="button"
              className="lobby-code-display lobby-code-display--clickable"
              aria-label={`Код комнаты ${room.code}, нажмите чтобы скопировать`}
              title="Нажмите, чтобы скопировать код"
              onClick={copyRoomCode}
            >
              <span className="lobby-code-display__label">Код комнаты</span>
              <span className="lobby-code-display__value">{room.code}</span>
            </button>
            <div className="lobby-invite__actions">
              <Button variant="primary" onClick={shareInvite}>
                Поделиться
              </Button>
              <Button variant="secondary" onClick={() => setQrOpen(true)} disabled={!inviteLink}>
                QR
              </Button>
            </div>
          </div>
          {inviteLink ? (
            <details className="lobby-invite__details">
              <summary>Показать ссылки-приглашения</summary>
              <div className="lobby-invite__link-body">
                {miniAppLink ? (
                  <p style={{ marginBottom: 8 }}>
                    <a href={miniAppLink} target="_blank" rel="noopener noreferrer">
                      Открыть в Telegram
                    </a>
                  </p>
                ) : null}
                {webLink ? (
                  <p style={{ marginBottom: 0 }}>
                    <a href={webLink} target="_blank" rel="noopener noreferrer">
                      {webLink}
                    </a>
                  </p>
                ) : null}
              </div>
            </details>
          ) : null}
        </section>

        {lobbyStatusText ? (
          <div className="lobby-status" role="status">
            {lobbyStatusText}
          </div>
        ) : null}

        {!isHost && !selectedGame ? (
          <div className="lobby-guest-wait">
            Ожидайте: хост должен выбрать игру. Позовите друзей через «Поделиться», QR или ссылку ниже.
          </div>
        ) : null}

      </div>

      <section className="lobby-section" aria-label="Участники">
        <h3 className="lobby-section__title">Участники</h3>
        {playersList.length === 0 ? (
          <EmptyState title="Игроков пока нет" message="Поделитесь кодом комнаты или ссылкой-приглашением." />
        ) : showPartyTeamsLayout ? (
          <>
            <div className="lobby-party-teams">
              {partyTeams.map((team, ti) => {
                const wins =
                  selectedGame === 'elias' && Array.isArray(eliasLobbyWins) ? eliasLobbyWins[ti] ?? 0 : null;
                const members = (team.playerIds || [])
                  .map((id) => playersList.find((pl) => String(pl.id) === String(id)))
                  .filter(Boolean);
                const canRename = (team.playerIds || []).some((id) => String(id) === myIdStr);
                const winWord =
                  wins == null
                    ? null
                    : (() => {
                        const n = wins;
                        const m = n % 10;
                        const h = n % 100;
                        if (h >= 11 && h <= 14) return 'побед';
                        if (m === 1) return 'победа';
                        if (m >= 2 && m <= 4) return 'победы';
                        return 'побед';
                      })();
                return (
                  <div key={`team-${ti}`} className="lobby-team-card gh-card">
                    <div className="lobby-team-card__head">
                      <button
                        type="button"
                        className={`lobby-team-card__title${canRename ? ' lobby-team-card__title--editable' : ''}`}
                        onClick={() =>
                          canRename &&
                          setTeamRename({
                            scope: 'elias',
                            teamIndex: ti,
                            name: team.name || `Команда ${ti + 1}`,
                          })
                        }
                        title={canRename ? 'Нажмите, чтобы изменить название (только для своей команды)' : ''}
                        disabled={!canRename}
                      >
                        {team.name || `Команда ${ti + 1}`}
                      </button>
                      {wins != null ? (
                        <span className="lobby-team-card__wins" title="Побед в Элиасе в этом лобби">
                          {wins} {winWord}
                        </span>
                      ) : (
                        <span className="lobby-team-card__wins lobby-team-card__wins--muted" title="Счёт побед — для Элиаса">
                          —
                        </span>
                      )}
                    </div>
                    <ul className="lobby-team-card__members">
                      {members.map((p) => (
                        <li key={p.id}>{renderLobbyPlayerCard(p)}</li>
                      ))}
                      {members.length === 0 ? <li className="lobby-team-card__empty">Пока никого</li> : null}
                    </ul>
                  </div>
                );
              })}
            </div>
            {(() => {
              const assigned = new Set();
              partyTeams.forEach((t) => (t.playerIds || []).forEach((id) => assigned.add(String(id))));
              const loose = playersList.filter((p) => !assigned.has(String(p.id)));
              if (!loose.length) return null;
              return (
                <div className="lobby-party-unassigned">
                  <p className="lobby-party-unassigned__label">Без команды</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {loose.map((p) => (
                      <div key={p.id}>{renderLobbyPlayerCard(p)}</div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 8 }}>
            {playersList.map((p) => (
              <div key={p.id}>{renderLobbyPlayerCard(p)}</div>
            ))}
          </div>
        )}
      </section>

      {isHost && !selectedGame ? (
        <section className="lobby-section lobby-section--games" aria-label="Выбор игры">
          <h3 className="lobby-section__title">Выберите игру</h3>
          <p className="lobby-section__hint">Карточка — режим комнаты. Ниже появятся настройки выбранной игры.</p>
          <div className="lobby-game-grid">
            {LOBBY_GAMES.map((g) => (
              <button
                key={g.id}
                type="button"
                className="lobby-game-card"
                onClick={() => patchLobbyGame({ selectedGame: g.id, gameSettings: getDefaultGameSettings(g.id) })}
              >
                <span className="lobby-game-card__emoji" aria-hidden>
                  {g.emoji}
                </span>
                <span className="lobby-game-card__name">{g.name}</span>
                <span className="lobby-game-card__meta">от {g.minPlayers} игроков</span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {selectedGame === 'spy' && (
        <>
          <div className="lobby-game-heading">
            <h3 className="lobby-game-heading__title">Шпион</h3>
          </div>
          {room?.gameSettings ? (
            <LobbyGameSummaryCard room={room} selectedGame="spy" dictNames={DICT_NAMES} />
          ) : null}
          {!isHost && room?.gameSettings ? (
            <p className="lobby-summary-hint">Изменить настройки может только хост.</p>
          ) : null}
          {isHost && (
            <div className="lobby-game-actions">
              <Button
                variant="secondary"
                fullWidth
                onClick={() => {
                  setGameSettingsTab('presets');
                  setGameSettingsSheetOpen(true);
                }}
              >
                Настроить
              </Button>
              <button type="button" onClick={startSpy} style={btnStyle}>
                Начать
              </button>
            </div>
          )}
        </>
      )}

      {selectedGame === 'mafia' && (
        <>
          <div className="lobby-game-heading">
            <h3 className="lobby-game-heading__title">Мафия</h3>
          </div>
          {room?.gameSettings ? (
            <LobbyGameSummaryCard room={room} selectedGame="mafia" dictNames={DICT_NAMES} />
          ) : null}
          {!isHost && room?.gameSettings ? (
            <p className="lobby-summary-hint">Изменить настройки может только хост.</p>
          ) : null}
          {isHost && (
            <div className="lobby-game-actions">
              <Button
                variant="secondary"
                fullWidth
                onClick={() => {
                  setGameSettingsTab('mode');
                  setGameSettingsSheetOpen(true);
                }}
              >
                Настроить
              </Button>
              <button type="button" onClick={() => startMafia()} style={btnStyle}>
                Начать
              </button>
            </div>
          )}
        </>
      )}

      {selectedGame === 'elias' && (
        <>
          <div className="lobby-game-heading">
            <h3 className="lobby-game-heading__title">Элиас</h3>
          </div>
          {room?.gameSettings ? (
            <LobbyGameSummaryCard room={room} selectedGame="elias" dictNames={DICT_NAMES} eliasDictNames={ELIAS_DICT_NAMES} />
          ) : null}
          {!isHost && room?.gameSettings ? (
            <p className="lobby-summary-hint">Изменить настройки может только хост.</p>
          ) : null}
          {isHost && (
            <div className="lobby-game-actions">
              <Button
                variant="secondary"
                fullWidth
                onClick={() => {
                  setGameSettingsTab('timer');
                  setGameSettingsSheetOpen(true);
                }}
              >
                Настроить
              </Button>
              <button type="button" onClick={startElias} style={btnStyle}>
                Начать
              </button>
            </div>
          )}
        </>
      )}

      {selectedGame === 'truth_dare' && (
        <>
          <div className="lobby-game-heading">
            <h3 className="lobby-game-heading__title">Правда или действие</h3>
          </div>
          {room?.gameSettings ? (
            <LobbyGameSummaryCard room={room} selectedGame="truth_dare" dictNames={DICT_NAMES} />
          ) : null}
          {!isHost && room?.gameSettings ? (
            <p className="lobby-summary-hint">Изменить настройки может только хост.</p>
          ) : null}
          {isHost && (
            <>
              <p style={{ margin: '0 0 12px', fontSize: 13, opacity: 0.88, lineHeight: 1.45 }}>
                Каждый ход — одна карточка с двумя заданиями. Игрок сам выбирает: ответить честно или выполнить действие.
              </p>
              <div className="lobby-game-actions">
                <Button
                  variant="secondary"
                  fullWidth
                  onClick={() => {
                    setGameSettingsTab('main');
                    setGameSettingsSheetOpen(true);
                  }}
                >
                  Настроить
                </Button>
                <button type="button" onClick={startTruthDare} disabled={startingGame} style={btnStyle}>
                  {startingGame ? 'Запуск...' : 'Начать'}
                </button>
              </div>
              <p style={{ margin: '10px 0 0', fontSize: 12, opacity: 0.85, lineHeight: 1.4 }}>
                Примечание: карточки подбираются под текущего игрока (Pro/18+ учёт на сервере).
              </p>
            </>
          )}
        </>
      )}

      {selectedGame === 'bunker' && (
        <>
          <div className="lobby-game-heading">
            <h3 className="lobby-game-heading__title">Бункер</h3>
          </div>
          {room?.gameSettings ? (
            <LobbyGameSummaryCard room={room} selectedGame="bunker" dictNames={DICT_NAMES} />
          ) : null}
          {!isHost && room?.gameSettings ? (
            <p className="lobby-summary-hint">Изменить настройки может только хост.</p>
          ) : null}
          {isHost && (
            <div className="lobby-game-actions">
              <Button
                variant="secondary"
                fullWidth
                onClick={() => {
                  setGameSettingsTab('party');
                  setGameSettingsSheetOpen(true);
                }}
              >
                Настроить
              </Button>
              <button type="button" onClick={startBunker} disabled={startingGame} style={btnStyle}>
                {startingGame ? 'Запуск...' : 'Начать'}
              </button>
            </div>
          )}
        </>
      )}

      <LobbySettingsSheet
        open={Boolean(gameSettingsSheetOpen && isHost && selectedGame)}
        onClose={() => setGameSettingsSheetOpen(false)}
        title={gameSettingsSheetTitle}
        tabs={gameSettingsTabs}
        activeTab={gameSettingsTab}
        onTabChange={setGameSettingsTab}
        footer={<Button fullWidth onClick={() => setGameSettingsSheetOpen(false)}>Готово</Button>}
      >
        {selectedGame === 'spy' && gameSettingsTab === 'presets' && (
          <div>
            <p style={{ marginTop: 0, fontSize: 13, opacity: 0.9, lineHeight: 1.45 }}>
              Готовые профили — детали можно изменить на других вкладках.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
              <Button
                variant="secondary"
                fullWidth
                onClick={() => {
                  const base = getDefaultGameSettings('spy');
                  patchLobbyGame({ gameSettings: { ...room?.gameSettings, ...base } });
                  setSpyCount(base.spyCount);
                  setTimerEnabled(base.timerEnabled);
                  setTimerSeconds(base.timerSeconds);
                  setAllSpiesChanceEnabled(base.allSpiesChanceEnabled);
                  setDictionaryIds(base.dictionaryIds);
                }}
              >
                Стандарт (1 шпион, без таймера)
              </Button>
              <Button
                variant="secondary"
                fullWidth
                onClick={() => {
                  patchLobbyGame({
                    gameSettings: {
                      ...room?.gameSettings,
                      timerEnabled: true,
                      timerSeconds: 120,
                      spyCount: 1,
                      dictionaryIds: (room?.gameSettings?.dictionaryIds?.length ? room.gameSettings.dictionaryIds : ['free']),
                    },
                  });
                  setTimerEnabled(true);
                  setTimerSeconds(120);
                  setSpyCount(1);
                }}
              >
                С таймером 2 мин
              </Button>
            </div>
            <p style={{ marginBottom: 8 }}>Количество шпионов</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
              {SPY_COUNT_OPTIONS.map((n) => {
                const enabled = n === 1 || roomHasPro;
                const on = (room?.gameSettings?.spyCount ?? spyCount) === n;
                return (
                  <button
                    key={n}
                    type="button"
                    disabled={!enabled}
                    title={!enabled ? 'Нужна подписка Премиум' : ''}
                    onClick={() => {
                      if (!enabled) return;
                      setSpyCount(n);
                      patchLobbyGame({ gameSettings: { ...room?.gameSettings, timerEnabled, timerSeconds, spyCount: n, allSpiesChanceEnabled, dictionaryIds } });
                    }}
                    style={{
                      ...(on ? btnStyle : btnStyleToggleOff),
                      width: 'auto',
                      padding: '8px 14px',
                      opacity: enabled ? 1 : 0.6,
                    }}
                  >
                    {n}
                    {n > 1 && <span style={{ fontSize: 10, marginLeft: 4 }}>Премиум</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {selectedGame === 'spy' && gameSettingsTab === 'locations' && (
          <div>
            <p style={{ marginTop: 0, fontSize: 13, opacity: 0.9, marginBottom: 12 }}>
              Выберите наборы локаций — изменения сохраняются сразу. Можно выключить все наборы, затем включить только интересные; перед стартом нужен хотя бы один.
            </p>
            <div className="lobby-settings-pick-grid">
              {(room?.allSpyDictionaryIds || Object.keys(DICT_NAMES)).map((id) => {
                const card = SPY_DICT_CARDS.find((c) => c.id === id) || { id, name: DICT_NAMES[id] || id, description: '', emoji: '📍', free: id === 'free' };
                const available = availableDictionaries.includes(id);
                const cur = room?.gameSettings?.dictionaryIds ?? dictionaryIds ?? ['free'];
                const selected = cur.includes(id);
                const handleClick = () => {
                  if (!available) {
                    setSpyDictLockPopup(id);
                    return;
                  }
                  const next = selected ? cur.filter((x) => x !== id) : [...cur, id];
                  setDictionaryIds(next);
                  patchLobbyGame({
                    gameSettings: {
                      ...room?.gameSettings,
                      dictionaryIds: next,
                      timerEnabled,
                      timerSeconds,
                      spyCount,
                      allSpiesChanceEnabled,
                    },
                  });
                };
                return (
                  <div
                    key={card.id}
                    role="button"
                    tabIndex={0}
                    onClick={handleClick}
                    onKeyDown={(e) => e.key === 'Enter' && handleClick()}
                    className={`lobby-settings-pick-card${selected ? ' lobby-settings-pick-card--selected' : ''}${!available ? ' lobby-settings-pick-card--locked' : ''}`}
                  >
                    {!available && (
                      <div className="lobby-settings-pick-card__lock" title="Только Премиум">
                        🔒
                      </div>
                    )}
                    <div className="lobby-settings-pick-card__emoji">{card.emoji}</div>
                    <div className="lobby-settings-pick-card__name">{card.name}</div>
                    <div className="lobby-settings-pick-card__desc">{card.description}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {selectedGame === 'spy' && gameSettingsTab === 'timer' && (
          <div>
            <p style={{ marginBottom: 8 }}>Таймер раунда</p>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <input
                type="checkbox"
                checked={room?.gameSettings?.timerEnabled ?? timerEnabled}
                onChange={(e) => {
                  setTimerEnabled(e.target.checked);
                  patchLobbyGame({ gameSettings: { ...room?.gameSettings, timerEnabled: e.target.checked, timerSeconds, spyCount, allSpiesChanceEnabled, dictionaryIds } });
                }}
              />
              <span>Включить таймер</span>
            </label>
            {(room?.gameSettings?.timerEnabled ?? timerEnabled) && (
              <div>
                <p style={{ marginBottom: 6 }}>Время:</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {TIMER_OPTIONS.map((opt) => {
                    const activeSec = room?.gameSettings?.timerSeconds ?? timerSeconds;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => {
                          setTimerSeconds(opt.value);
                          patchLobbyGame({ gameSettings: { ...room?.gameSettings, timerEnabled: room?.gameSettings?.timerEnabled ?? timerEnabled, timerSeconds: opt.value, spyCount, allSpiesChanceEnabled, dictionaryIds } });
                        }}
                        style={{
                          ...(activeSec === opt.value ? btnStyle : btnStyleToggleOff),
                          width: 'auto',
                          padding: '8px 14px',
                        }}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
        {selectedGame === 'spy' && gameSettingsTab === 'more' && (
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <input
                type="checkbox"
                checked={room?.gameSettings?.allSpiesChanceEnabled ?? allSpiesChanceEnabled}
                onChange={(e) => {
                  setAllSpiesChanceEnabled(e.target.checked);
                  patchLobbyGame({ gameSettings: { ...room?.gameSettings, timerEnabled, timerSeconds, spyCount, allSpiesChanceEnabled: e.target.checked, dictionaryIds } });
                }}
              />
              <span>Все шпионы (редкий шанс)</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <input
                type="checkbox"
                checked={!!room?.gameSettings?.spiesSeeEachOther}
                onChange={(e) => patchLobbyGame({ gameSettings: { ...room?.gameSettings, spiesSeeEachOther: e.target.checked } })}
              />
              <span>Шпионы видят друг друга</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 0 }}>
              <input
                type="checkbox"
                checked={!!room?.gameSettings?.showLocationsList}
                onChange={(e) => patchLobbyGame({ gameSettings: { ...room?.gameSettings, showLocationsList: e.target.checked } })}
              />
              <span>Показывать всем список возможных локаций</span>
            </label>
          </div>
        )}

        {selectedGame === 'mafia' && gameSettingsTab === 'mode' && (
          <div>
            <p style={{ marginTop: 0, fontSize: 13, opacity: 0.88 }}>Минимум {MIN_PLAYERS.mafia} игроков.</p>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <button
                type="button"
                onClick={() => {
                  setMafiaClassicPopup(true);
                  if (room?.gameSettings?.extended) patchLobbyGame({ gameSettings: { ...room?.gameSettings, extended: false } });
                }}
                style={{ ...(room?.gameSettings?.extended ? btnStyleToggleOff : btnStyle), flex: 1, padding: 10 }}
                title="Какие роли в игре"
              >
                Классика
              </button>
              <button
                type="button"
                onClick={() => {
                  setMafiaExtendedPopup(true);
                  if (roomHasPro && !room?.gameSettings?.extended) patchLobbyGame({ gameSettings: { ...room?.gameSettings, extended: true } });
                }}
                style={{ ...(room?.gameSettings?.extended ? btnStyle : btnStyleToggleOff), flex: 1, padding: 10, opacity: roomHasPro ? 1 : 0.6 }}
                title="Подробнее об расширенной версии"
              >
                Расширенная (Премиум)
              </button>
            </div>
          </div>
        )}
        {selectedGame === 'mafia' && gameSettingsTab === 'rules' && (
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <input type="checkbox" checked={room?.gameSettings?.revealRoleOnDeath !== false} onChange={(e) => patchLobbyGame({ gameSettings: { ...room?.gameSettings, revealRoleOnDeath: e.target.checked } })} />
              <span>Показывать роль после смерти</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <input type="checkbox" checked={!!room?.gameSettings?.mafiaCanSkipKill} onChange={(e) => patchLobbyGame({ gameSettings: { ...room?.gameSettings, mafiaCanSkipKill: e.target.checked } })} />
              <span>Мафия может не убивать ночью</span>
            </label>
            <p style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 600 }}>Как появляется мафия</p>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => patchLobbyGame({ gameSettings: { ...room?.gameSettings, mafiaRolesMode: 'moderator' } })}
                style={{
                  ...(room?.gameSettings?.mafiaRolesMode === 'moderator' ? btnStyle : btnStyleToggleOff),
                  flex: 1,
                  padding: 10,
                  minWidth: 140,
                }}
              >
                Ведущий назначает
              </button>
              <button
                type="button"
                onClick={() => patchLobbyGame({ gameSettings: { ...room?.gameSettings, mafiaRolesMode: 'player_vote' } })}
                style={{
                  ...(room?.gameSettings?.mafiaRolesMode !== 'moderator' ? btnStyle : btnStyleToggleOff),
                  flex: 1,
                  padding: 10,
                  minWidth: 140,
                }}
              >
                Все голосуют
              </button>
            </div>
            <p style={{ margin: '0 0 16px', fontSize: 12, opacity: 0.82, lineHeight: 1.35 }}>
              Ведущий на своём телефоне выбирает Дона, мафию и комиссара (в расширенной — ещё роли). Или каждый игрок с телефона отдаёт два голоса — кого считать «мафией»; по итогам сервер назначает роли.
            </p>
            <p style={{ margin: '0 0 6px', fontSize: 14 }}>Скорость фаз</p>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
              {[
                { id: 'fast', label: 'Быстро', val: { roleSetup: 90, nightMafia: 30, nightCommissioner: 20, day: 60, voting: 30 } },
                { id: 'std', label: 'Стандарт', val: { roleSetup: 120, nightMafia: 45, nightCommissioner: 25, day: 90, voting: 45 } },
                { id: 'long', label: 'Дольше', val: { roleSetup: 150, nightMafia: 60, nightCommissioner: 35, day: 120, voting: 60 } },
              ].map((p) => {
                const cur = room?.gameSettings?.phaseTimers || {};
                const active =
                  cur.nightMafia === p.val.nightMafia &&
                  cur.day === p.val.day &&
                  cur.voting === p.val.voting &&
                  (cur.roleSetup ?? 120) === (p.val.roleSetup ?? 120);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => patchLobbyGame({ gameSettings: { ...room?.gameSettings, phaseTimers: p.val } })}
                    style={{ ...(active ? btnStyle : btnStyleToggleOff), flex: 1, padding: 10, minWidth: 100 }}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => patchLobbyGame({
                gameSettings: {
                  ...room?.gameSettings,
                  phaseTimers: { roleSetup: 60, nightMafia: 30, nightCommissioner: 20, day: 40, voting: 30 },
                },
              })}
              style={{ ...btnStyle, marginBottom: 12, width: '100%' }}
              title="Компактная партия около 10 минут"
            >
              Режим 10 минут
            </button>
            <p style={{ margin: 0, fontSize: 12, opacity: 0.8 }}>
              Ускоренный формат: короткие ночь/день/голосование для быстрой партии.
            </p>
          </div>
        )}
        {selectedGame === 'mafia' && gameSettingsTab === 'host' && (
          <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <button
                type="button"
                onClick={() => patchLobbyGame({ gameSettings: { ...room?.gameSettings, hostSelection: 'random', moderatorId: null } })}
                style={{ ...(room?.gameSettings?.hostSelection !== 'choose' ? btnStyle : btnStyleToggleOff), flex: 1, padding: 10 }}
              >
                Случайно
              </button>
              <button
                type="button"
                onClick={() => patchLobbyGame({ gameSettings: { ...room?.gameSettings, hostSelection: 'choose' } })}
                style={{ ...(room?.gameSettings?.hostSelection === 'choose' ? btnStyle : btnStyleToggleOff), flex: 1, padding: 10 }}
              >
                Выбрать
              </button>
            </div>
            {room?.gameSettings?.hostSelection === 'choose' && (
              <div>
                <p style={{ marginBottom: 6, fontSize: 14 }}>Кто ведущий?</p>
                {(room?.players || []).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => patchLobbyGame({ gameSettings: { ...room?.gameSettings, moderatorId: p.id } })}
                    style={{ ...(room?.gameSettings?.moderatorId === p.id ? btnStyle : btnStyleToggleOff), marginBottom: 6, padding: 8, width: '100%' }}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {selectedGame === 'elias' && gameSettingsTab === 'timer' && (
          <div>
            <p style={{ marginTop: 0, fontSize: 13, opacity: 0.88 }}>Таймер и победа (мин. {MIN_PLAYERS.elias} игрока).</p>
            <p style={{ marginBottom: 8 }}>Таймер раунда (сек)</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
              {[30, 60, 90, 120].map((sec) => (
                <button
                  key={sec}
                  type="button"
                  onClick={() => patchLobbyGame({ gameSettings: { ...room?.gameSettings, timerSeconds: sec } })}
                  style={{ ...((room?.gameSettings?.timerSeconds ?? 60) === sec ? btnStyle : btnStyleToggleOff), width: 'auto', padding: '8px 14px' }}
                >
                  {sec} сек
                </button>
              ))}
            </div>
            <p style={{ marginBottom: 8 }}>Победа (очков)</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
              {[5, 10, 15, 20, 50].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => patchLobbyGame({ gameSettings: { ...room?.gameSettings, scoreLimit: n } })}
                  style={{ ...((room?.gameSettings?.scoreLimit ?? 10) === n ? btnStyle : btnStyleToggleOff), width: 'auto', padding: '8px 14px' }}
                >
                  {n}
                </button>
              ))}
            </div>
            <p style={{ margin: '0 0 6px', fontSize: 14 }}>Штраф за пропуск</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 0 }}>
              {[0, 1, 2].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => patchLobbyGame({ gameSettings: { ...room?.gameSettings, skipPenalty: n } })}
                  style={{ ...((room?.gameSettings?.skipPenalty ?? 1) === n ? btnStyle : btnStyleToggleOff), width: 'auto', padding: '8px 14px' }}
                >
                  {n === 0 ? 'Без штрафа' : `−${n} очко`}
                </button>
              ))}
            </div>
          </div>
        )}
        {selectedGame === 'elias' && gameSettingsTab === 'dicts' && (
          <div>
            <p style={{ marginTop: 0, fontSize: 13, opacity: 0.9, marginBottom: 12 }}>
              Наборы слов — нажмите, чтобы включить или выключить. Можно выключить всё и выбрать только нужное; перед стартом нужен хотя бы один словарь.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {(room?.availableEliasDictionaries || ['basic', 'animals']).map((id) => {
                const card = ELIAS_DICT_CARDS.find((c) => c.id === id) || { id, name: id, description: '', emoji: '📖', free: false };
                const cur = room?.gameSettings?.dictionaryIds || ['basic', 'animals', 'memes'];
                const selected = cur.includes(id);
                const toggle = () => {
                  const next = selected ? cur.filter((x) => x !== id) : [...cur, id];
                  patchLobbyGame({ gameSettings: { ...room?.gameSettings, dictionaryIds: next } });
                };
                return (
                  <div
                    key={card.id}
                    role="button"
                    tabIndex={0}
                    onClick={toggle}
                    onKeyDown={(e) => e.key === 'Enter' && toggle()}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 12,
                      padding: 14,
                      borderRadius: 10,
                      background: selected ? 'rgba(58, 123, 213, 0.2)' : 'rgba(255,255,255,0.06)',
                      border: `2px solid ${selected ? 'var(--tg-theme-button-color, #3a7bd5)' : 'transparent'}`,
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ width: 48, height: 48, borderRadius: 10, background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>
                      {card.emoji}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, marginBottom: 4 }}>
                        {card.name}
                        {!card.free && <span style={{ fontSize: 11, marginLeft: 6, opacity: 0.8 }}>Премиум</span>}
                      </div>
                      <div style={{ fontSize: 13, opacity: 0.85, lineHeight: 1.35 }}>{card.description}</div>
                    </div>
                    <div
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 6,
                        border: `2px solid ${selected ? 'var(--tg-theme-button-color, #3a7bd5)' : '#666'}`,
                        background: selected ? 'var(--tg-theme-button-color, #3a7bd5)' : 'transparent',
                        flexShrink: 0,
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {selectedGame === 'elias' && gameSettingsTab === 'teams' && (
          <div>
            <p style={{ fontSize: 12, opacity: 0.85, marginTop: 0, marginBottom: 10 }}>
              <strong>Авто при входе:</strong> новые игроки сразу попадают в команды (2 игрока — по одному в команде; 3 — 2+1; с 4 — чередование по списку лобби).{' '}
              <strong>Сменить команду:</strong> нажмите на карточку игрока в списке участников → «Сменить команду» (хост может любого, игрок — только себя). Ниже — принудительно пересобрать состав.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
              <button
                type="button"
                onClick={() => {
                  const pl = room?.players || [];
                  const teams = buildAutoPartyTeams(pl);
                  if (teams) patchLobbyGame({ gameSettings: { ...room?.gameSettings, eliasTeams: teams } });
                }}
                style={{ ...btnStyleToggleMid, width: '100%', padding: '10px 14px', fontSize: 14 }}
              >
                Авто по списку лобби
              </button>
              <button
                type="button"
                onClick={() => {
                  const pl = room?.players || [];
                  const teams = shufflePartyTeams(pl);
                  if (teams) patchLobbyGame({ gameSettings: { ...room?.gameSettings, eliasTeams: teams } });
                }}
                style={{ ...btnStyleToggleMid, width: '100%', padding: '10px 14px', fontSize: 14 }}
              >
                Случайно распределить
              </button>
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => {
                  const teams = room?.gameSettings?.eliasTeams ?? [{ name: 'Команда 1', playerIds: [] }, { name: 'Команда 2', playerIds: [] }];
                  patchLobbyGame({
                    gameSettings: {
                      ...room?.gameSettings,
                      eliasTeams: [...teams, { name: generateOneTeamName(), playerIds: [] }],
                    },
                  });
                }}
                style={{ ...btnStyleToggleMid, width: 'auto', padding: '6px 12px', fontSize: 13 }}
              >
                + Добавить команду
              </button>
              {(room?.gameSettings?.eliasTeams ?? [{ name: 'Команда 1', playerIds: [] }, { name: 'Команда 2', playerIds: [] }]).length > 2 && (
                <button
                  type="button"
                  onClick={() => {
                    const teams = room?.gameSettings?.eliasTeams;
                    if (teams?.length > 2) patchLobbyGame({ gameSettings: { ...room?.gameSettings, eliasTeams: teams.slice(0, -1) } });
                  }}
                  style={{ ...btnStyleWarn, width: 'auto', padding: '6px 12px', fontSize: 13 }}
                >
                  − Убрать команду
                </button>
              )}
            </div>
          </div>
        )}

        {selectedGame === 'truth_dare' && gameSettingsTab === 'main' && (
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <input
                type="checkbox"
                checked={tdSafeMode}
                onChange={(e) => {
                  const nextSafeMode = e.target.checked;
                  const nextShow18Plus = nextSafeMode ? false : tdShow18Plus;
                  const nextCats = tdCategorySlugs.filter((slug) => {
                    const cat = TD_CATEGORIES.find((c) => c.slug === slug);
                    if (!cat) return false;
                    if (nextSafeMode && !cat.safe) return false;
                    if (cat.is18Plus && !nextShow18Plus) return false;
                    return true;
                  });
                  patchLobbyGame({
                    gameSettings: {
                      ...room?.gameSettings,
                      safeMode: nextSafeMode,
                      show18Plus: nextShow18Plus,
                      categorySlugs: nextCats,
                    },
                  });
                }}
              />
              <span>Safe режим (мягкие карточки)</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <input
                type="checkbox"
                checked={tdShow18Plus}
                disabled={tdSafeMode}
                onChange={(e) => {
                  const nextShow18Plus = e.target.checked;
                  const nextCats = tdCategorySlugs.filter((slug) => {
                    const cat = TD_CATEGORIES.find((c) => c.slug === slug);
                    if (!cat) return false;
                    if (cat.is18Plus && !nextShow18Plus) return false;
                    if (tdSafeMode && !cat.safe) return false;
                    return true;
                  });
                  patchLobbyGame({
                    gameSettings: {
                      ...room?.gameSettings,
                      show18Plus: nextShow18Plus,
                      categorySlugs: nextCats,
                    },
                  });
                }}
              />
              <span>Показывать 18+ (нужно 18+ подтверждение)</span>
            </label>
            <p style={{ marginBottom: 8, fontSize: 14 }}>Очков до победы (успешных «правда/действие»)</p>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
              {[3, 5, 7, 10].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => patchLobbyGame({ gameSettings: { ...room?.gameSettings, roundsCount: n } })}
                  style={{ ...(tdRoundsCount === n ? btnStyle : btnStyleToggleOff), flex: 1, padding: 10, fontSize: 14, minWidth: 64 }}
                >
                  {n}
                </button>
              ))}
            </div>
            <p style={{ marginBottom: 8, fontSize: 14 }}>Лимит пропусков на игрока</p>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
              {[0, 1, 2, 3].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => patchLobbyGame({ gameSettings: { ...room?.gameSettings, skipLimitPerPlayer: n } })}
                  style={{ ...(tdSkipLimitPerPlayer === n ? btnStyle : btnStyleToggleOff), flex: 1, padding: 10, fontSize: 14, minWidth: 56 }}
                >
                  {n}
                </button>
              ))}
            </div>
            <p style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 700 }}>Кто ходит и когда</p>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10, cursor: 'pointer' }}>
              <input
                type="radio"
                name="tdOrderMode"
                checked={(tdGameSettings.truthDareOrderMode || 'host') !== 'random'}
                onChange={() => patchLobbyGame({ gameSettings: { ...room?.gameSettings, truthDareOrderMode: 'host' } })}
              />
              <span style={{ fontSize: 14, lineHeight: 1.45 }}>
                <strong>По очереди</strong> — порядок задаёт ведущий на вкладке «Очередь» (перетаскивание карточек).
              </span>
            </label>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12, cursor: 'pointer' }}>
              <input
                type="radio"
                name="tdOrderMode"
                checked={(tdGameSettings.truthDareOrderMode || 'host') === 'random'}
                onChange={() => patchLobbyGame({ gameSettings: { ...room?.gameSettings, truthDareOrderMode: 'random' } })}
              />
              <span style={{ fontSize: 14, lineHeight: 1.45 }}>
                <strong>Случайно</strong> — каждый ход выбирается случайный игрок (кроме текущего, если в комнате больше одного).
              </span>
            </label>
            <Button
              variant="secondary"
              fullWidth
              onClick={() => patchLobbyGame({
                gameSettings: {
                  ...room?.gameSettings,
                  roundsCount: 3,
                  timerSeconds: 35,
                  skipLimitPerPlayer: 1,
                  mode: 'mixed',
                  safeMode: true,
                  show18Plus: false,
                  categorySlugs: ['classic', 'friends'],
                  truthDareOrderMode: 'host',
                },
              })}
            >
              Быстрая партия (3 очка до победы)
            </Button>
          </div>
        )}
        {selectedGame === 'truth_dare' && gameSettingsTab === 'cats' && (
          <div>
            <p style={{ marginTop: 0, fontSize: 13, opacity: 0.9, marginBottom: 12 }}>
              Выберите категории — нажмите на блок. Можно выключить все и включить только нужные; перед стартом нужна хотя бы одна.
            </p>
            <div className="lobby-settings-pick-grid">
              {TD_CATEGORIES.map((c) => {
                const lockedByPro = c.premium && !hasCategoryPackAccess(c);
                const lockedBySafe = tdSafeMode && !c.safe;
                const lockedBy18 = c.is18Plus && !tdShow18Plus;
                const locked = lockedByPro || lockedBySafe || lockedBy18;
                const cur = Array.isArray(room?.gameSettings?.categorySlugs) && room.gameSettings.categorySlugs.length
                  ? room.gameSettings.categorySlugs
                  : tdCategorySlugs;
                const selected = cur.includes(c.slug);
                const handleClick = () => {
                  if (locked) return;
                  const next = selected ? cur.filter((x) => x !== c.slug) : [...cur, c.slug];
                  track('td_category_toggle', { category: c.slug, enabled: !selected, source: 'lobby_sheet' });
                  patchLobbyGame({ gameSettings: { ...room?.gameSettings, categorySlugs: next } });
                };
                return (
                  <div
                    key={c.slug}
                    role="button"
                    tabIndex={0}
                    onClick={handleClick}
                    onKeyDown={(e) => e.key === 'Enter' && handleClick()}
                    className={`lobby-settings-pick-card${selected ? ' lobby-settings-pick-card--selected' : ''}${locked ? ' lobby-settings-pick-card--locked' : ''}`}
                    title={lockedByPro ? `Нужен Премиум или pack ${c.requiredItem || ''}` : lockedBy18 ? 'Включите 18+' : lockedBySafe ? 'Safe режим отключает эту категорию' : ''}
                  >
                    {lockedByPro && (
                      <div className="lobby-settings-pick-card__lock" title="Только Премиум / pack">
                        🔒
                      </div>
                    )}
                    <div className="lobby-settings-pick-card__emoji">{c.emoji || '📇'}</div>
                    <div className="lobby-settings-pick-card__name">{c.name}</div>
                    <div className="lobby-settings-pick-card__desc">{c.description}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {selectedGame === 'truth_dare' && gameSettingsTab === 'order' && (
          <div>
            <p style={{ fontSize: 13, opacity: 0.9, marginTop: 0, marginBottom: 12, lineHeight: 1.45 }}>
              В Правда или действие <strong>нет команд</strong> — каждый играет за себя. Здесь задаётся <strong>очередь ходов</strong> для режима «По очереди» на вкладке «Основное».
              Перетащите карточки, чтобы изменить порядок (только ведущий; остальные только смотрят).
            </p>
            {(tdGameSettings.truthDareOrderMode || 'host') === 'random' ? (
              <p style={{ fontSize: 13, opacity: 0.88, marginBottom: 12, padding: 12, borderRadius: 12, background: 'rgba(0,0,0,0.2)' }}>
                Сейчас включён режим <strong>«Случайно»</strong> — порядок ниже не влияет на игру; каждый ход выбирается случайный игрок.
              </p>
            ) : null}
            <div className="lobby-td-order-list">
              {truthDareResolvedOrder.map((pid, index) => {
                const pl = playersList.find((p) => String(p.id) === String(pid));
                const label = pl?.name || pid;
                const canDrag = isHost && (tdGameSettings.truthDareOrderMode || 'host') !== 'random';
                return (
                  <div
                    key={String(pid)}
                    className={`lobby-td-order-row gh-card${canDrag ? ' lobby-td-order-row--draggable' : ''}`}
                    draggable={canDrag}
                    onDragStart={(e) => {
                      if (!canDrag) return;
                      e.dataTransfer.setData('text/plain', String(pid));
                      e.dataTransfer.effectAllowed = 'move';
                      try {
                        e.currentTarget.classList.add('lobby-td-order-row--dragging');
                      } catch (_) {}
                    }}
                    onDragEnd={(e) => {
                      try {
                        e.currentTarget.classList.remove('lobby-td-order-row--dragging');
                      } catch (_) {}
                    }}
                    onDragOver={(e) => {
                      if (!canDrag) return;
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                    }}
                    onDrop={(e) => {
                      if (!canDrag) return;
                      e.preventDefault();
                      const dragId = e.dataTransfer.getData('text/plain');
                      if (!dragId || String(dragId) === String(pid)) return;
                      const order = [...truthDareResolvedOrder];
                      const from = order.findIndex((x) => String(x) === String(dragId));
                      if (from < 0) return;
                      const [item] = order.splice(from, 1);
                      let to = index;
                      if (from < to) to -= 1;
                      to = Math.max(0, Math.min(to, order.length));
                      order.splice(to, 0, item);
                      patchLobbyGame({ gameSettings: { ...room?.gameSettings, truthDareTurnOrder: order } });
                    }}
                  >
                    <span className="lobby-td-order-row__n">{index + 1}</span>
                    <span className="lobby-td-order-row__name">{label}</span>
                    {canDrag ? <span className="lobby-td-order-row__hint" aria-hidden>⋮⋮</span> : null}
                  </div>
                );
              })}
            </div>
            {isHost ? (
              <button
                type="button"
                onClick={() => {
                  const pl = room?.players || [];
                  patchLobbyGame({
                    gameSettings: {
                      ...room?.gameSettings,
                      truthDareTurnOrder: pl.map((p) => p.id),
                    },
                  });
                }}
                style={{ ...btnStyleToggleMid, width: '100%', marginTop: 12, padding: '10px 14px', fontSize: 14 }}
              >
                Сбросить порядок как в списке участников
              </button>
            ) : null}
          </div>
        )}

        {selectedGame === 'bunker' && gameSettingsTab === 'party' && (
          <div>
            <p style={{ marginTop: 0, fontSize: 13, opacity: 0.9, marginBottom: 12 }}>Быстрый старт или свои значения ниже.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              <Button
                variant="secondary"
                fullWidth
                onClick={() => {
                  const base = getDefaultGameSettings('bunker');
                  patchLobbyGame({ gameSettings: { ...room?.gameSettings, ...base } });
                }}
              >
                Стандарт (3 раунда, стандартная скорость)
              </Button>
            </div>
            <p style={{ marginBottom: 8, opacity: 0.9, fontSize: 14 }}>Раундов</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
              {BUNKER_ROUND_OPTIONS.map((n) => {
                const active = (room?.gameSettings?.maxRounds ?? 3) === n;
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => {
                      patchLobbyGame({ gameSettings: { ...(room?.gameSettings || {}), maxRounds: n } });
                    }}
                    disabled={startingGame}
                    style={{
                      ...(active ? btnStyle : btnStyleToggleOff),
                      width: 'auto',
                      padding: '8px 14px',
                      opacity: startingGame ? 0.7 : 1,
                    }}
                  >
                    {n}
                  </button>
                );
              })}
            </div>
            <p style={{ marginBottom: 8, opacity: 0.9, fontSize: 14 }}>Скорость фаз</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 0 }}>
              {BUNKER_SPEED_PRESETS.map((p) => {
                const activeId = room?.gameSettings?.phaseSpeed || 'standard';
                const active = activeId === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      const phaseTimers = bunkerPhaseTimersFromSpeed(p.id);
                      patchLobbyGame({ gameSettings: { ...(room?.gameSettings || {}), phaseSpeed: p.id, phaseTimers } });
                    }}
                    disabled={startingGame}
                    style={{
                      ...(active ? btnStyle : btnStyleToggleOff),
                      width: 'auto',
                      padding: '8px 14px',
                      opacity: startingGame ? 0.7 : 1,
                    }}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {selectedGame === 'bunker' && gameSettingsTab === 'scenario' && (
          <div>
            <p style={{ marginTop: 0, fontSize: 13, opacity: 0.9 }}>Сюжет и правила бункера.</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {BUNKER_SCENARIOS.map((s) => {
                const active = (room?.gameSettings?.scenarioId || 'shelter_default') === s.id;
                const canUse = !s.premium || roomHasPro || (Array.isArray(myInventory?.unlockedItems) && myInventory.unlockedItems.includes(s.itemId));
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      if (!canUse) return;
                      patchLobbyGame({ gameSettings: { ...(room?.gameSettings || {}), scenarioId: s.id } });
                    }}
                    disabled={startingGame || !canUse}
                    title={!canUse ? `Нужен Pro или pack ${s.itemId}` : ''}
                    style={{
                      ...(active ? btnStyle : btnStyleToggleOff),
                      width: 'auto',
                      padding: '8px 14px',
                      opacity: (!canUse || startingGame) ? 0.6 : 1,
                    }}
                  >
                    {s.label} {s.premium ? '🔒' : ''}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </LobbySettingsSheet>

      <div className="lobby-footer-actions">
        <div className="lobby-footer-actions__row">
          <Button variant="secondary" onClick={() => setShopOpen(true)}>
            Магазин
          </Button>
          {isHost && selectedGame ? (
            <Button variant="secondary" onClick={() => patchLobbyGame({ selectedGame: null })}>
              К выбору игры
            </Button>
          ) : null}
        </div>
        <Button variant="ghost" fullWidth onClick={() => setLeaveConfirmOpen(true)}>
          Выйти из комнаты
        </Button>
      </div>

      <Modal open={leaveConfirmOpen} onClose={() => setLeaveConfirmOpen(false)} title="Выйти из комнаты?" width={400}>
        <p style={{ marginTop: 0, lineHeight: 1.5, opacity: 0.92 }}>
          Вернуться на главный экран? Вы покинете лобби; приглашение снова сработает, если комната ещё активна.
        </p>
        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <Button variant="secondary" fullWidth onClick={() => setLeaveConfirmOpen(false)}>
            Остаться
          </Button>
          <Button variant="danger" fullWidth onClick={confirmLeaveLobby}>
            Выйти
          </Button>
        </div>
      </Modal>

      <Modal open={Boolean(teamRename)} onClose={() => setTeamRename(null)} title="Название команды" width={400}>
        {teamRename ? (
          <>
            <p style={{ marginTop: 0, fontSize: 13, opacity: 0.88, lineHeight: 1.45 }}>
              Видят все в лобби. До 48 символов.
            </p>
            <input
              type="text"
              value={teamRename.name}
              onChange={(e) => setTeamRename((r) => (r ? { ...r, name: e.target.value } : null))}
              maxLength={48}
              className="lobby-team-rename-input"
              autoFocus
            />
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <Button variant="secondary" fullWidth onClick={() => setTeamRename(null)}>
                Отмена
              </Button>
              <Button variant="primary" fullWidth onClick={submitTeamRename}>
                Сохранить
              </Button>
            </div>
          </>
        ) : null}
      </Modal>

      <Modal open={Boolean(teamAssignOpen)} onClose={() => setTeamAssignOpen(null)} title={teamAssignOpen ? `Команда: ${teamAssignOpen.targetName}` : 'Команда'} width={400}>
        {teamAssignOpen && partyTeams && partyTeams.length >= 2 ? (
          <>
            <p style={{ marginTop: 0, fontSize: 13, opacity: 0.88, lineHeight: 1.45 }}>
              Выберите команду для игрока
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
              {partyTeams.map((t, i) => {
                const cur = partyTeams.findIndex((tt) =>
                  (tt.playerIds || []).some((id) => String(id) === String(teamAssignOpen.targetId)),
                );
                const isCurrent = cur === i;
                return (
                  <Button
                    key={i}
                    variant={isCurrent ? 'primary' : 'secondary'}
                    fullWidth
                    disabled={isCurrent}
                    onClick={() => submitAssignTeam(i)}
                  >
                    {t.name || `Команда ${i + 1}`}
                    {isCurrent ? ' — сейчас' : ''}
                  </Button>
                );
              })}
            </div>
            <Button variant="ghost" fullWidth style={{ marginTop: 12 }} onClick={() => setTeamAssignOpen(null)}>
              Отмена
            </Button>
          </>
        ) : null}
      </Modal>

      <Modal open={Boolean(playerMenuPlayer)} onClose={() => setPlayerMenuPlayer(null)} title={pp ? pp.name : 'Игрок'} width={400}>
        {pp ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <p style={{ marginTop: 0, marginBottom: 4, fontSize: 13, opacity: 0.88, lineHeight: 1.45 }}>
              Действия с участником
            </p>
            {showPartyTeamsLayout && (isHost || playerMenuIsSelf) ? (
              <Button
                variant="secondary"
                fullWidth
                onClick={() => {
                  setTeamAssignOpen({ targetId: pp.id, targetName: pp.name });
                  setPlayerMenuPlayer(null);
                }}
              >
                Сменить команду
              </Button>
            ) : null}
            {playerMenuCanHostActions && playersList.length >= 2 ? (
              <Button
                variant="secondary"
                fullWidth
                onClick={() => transferHostTo(pp.id)}
                style={{ justifyContent: 'center' }}
              >
                Передать хоста
              </Button>
            ) : null}
            {playerMenuCanHostActions ? (
              <Button
                variant="danger"
                fullWidth
                onClick={() => kickPlayer(pp.id)}
                style={{ justifyContent: 'center' }}
              >
                Кикнуть из комнаты
              </Button>
            ) : null}
            {!playerMenuIsSelf ? (
              friendIds.has(String(pp.id)) ? (
                <Button variant="secondary" fullWidth disabled>
                  Уже в друзьях
                </Button>
              ) : outgoingPending.has(String(pp.id)) ? (
                <Button variant="secondary" fullWidth disabled>
                  Заявка отправлена
                </Button>
              ) : (
                <Button variant="secondary" fullWidth onClick={addFriendFromLobby}>
                  Добавить в друзья
                </Button>
              )
            ) : null}
            <Button variant="ghost" fullWidth onClick={() => setPlayerMenuPlayer(null)}>
              Закрыть
            </Button>
          </div>
        ) : null}
      </Modal>

      {mafiaClassicPopup && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 120, padding: 24 }} onClick={() => setMafiaClassicPopup(false)}>
          <div style={{ background: 'var(--tg-theme-bg-color, #1a1a1a)', padding: 24, borderRadius: 12, maxWidth: 360 }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0, marginBottom: 12 }}>Классическая Мафия — роли</h3>
            <p style={{ marginBottom: 8, fontSize: 14 }}>В игре участвуют:</p>
            <ul style={{ margin: '0 0 16px', paddingLeft: 20, fontSize: 14, lineHeight: 1.6 }}>
              <li><strong>Мирный</strong> — не знает никого, голосует днём</li>
              <li><strong>Мафия</strong> — знает друг друга, убивает ночью</li>
              <li><strong>Дон</strong> — мафия, остальные мафиози не знают, кто дон</li>
              <li><strong>Комиссар</strong> — каждую ночь может проверить одного игрока (мафия или нет)</li>
            </ul>
            <p style={{ marginBottom: 0, fontSize: 13, opacity: 0.9 }}>Минимум 4 игрока. Ночь и день чередуются.</p>
            <button type="button" onClick={() => setMafiaClassicPopup(false)} style={{ ...btnStyle, marginTop: 16 }}>Понятно</button>
          </div>
        </div>
      )}

      {mafiaExtendedPopup && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 120, padding: 24 }} onClick={() => setMafiaExtendedPopup(false)}>
          <div style={{ background: 'var(--tg-theme-bg-color, #1a1a1a)', padding: 24, borderRadius: 12, maxWidth: 360 }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0, marginBottom: 12 }}>Расширенная версия Мафии</h3>
            <p style={{ marginBottom: 8, fontSize: 14 }}>Дополнительные роли и механики:</p>
            <ul style={{ margin: '0 0 16px', paddingLeft: 20, fontSize: 14, lineHeight: 1.5 }}>
              <li>Дон мафии — знает своих мафиози, мафия не знает дона</li>
              <li>Комиссар — каждую ночь может проверить одного игрока</li>
              <li>Доктор — может лечить одного игрока за ночь</li>
              <li>Маньяк — побеждает, если остаётся с мирным</li>
            </ul>
            <p style={{ marginBottom: 0, fontSize: 13, opacity: 0.9 }}>Доступно по подписке Премиум.</p>
            <button type="button" onClick={() => setMafiaExtendedPopup(false)} style={{ ...btnStyle, marginTop: 16 }}>Понятно</button>
          </div>
        </div>
      )}

      {spyDictLockPopup && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 120, padding: 24 }}>
          <div style={{ background: 'var(--tg-theme-bg-color, #1a1a1a)', padding: 24, borderRadius: 12, maxWidth: 320 }}>
            <p style={{ marginBottom: 8 }}>🔒 {DICT_NAMES[spyDictLockPopup] || spyDictLockPopup}</p>
            <p style={{ fontSize: 14, opacity: 0.9, marginBottom: 16 }}>Этот словарь доступен только по подписке Премиум. Покупка отдельных словарей пока не реализована — оформите Премиум, чтобы открыть все тематические локации.</p>
            <button type="button" onClick={() => setSpyDictLockPopup(null)} style={btnStyle}>Понятно</button>
          </div>
        </div>
      )}

      {minPlayersWarning && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 120, padding: 24 }}>
          <div style={{ background: 'var(--tg-theme-bg-color, #1a1a1a)', padding: 24, borderRadius: 12, maxWidth: 320 }}>
            <p style={{ marginBottom: 16 }}>{minPlayersWarning}</p>
            <button type="button" onClick={() => setMinPlayersWarning(null)} style={btnStyle}>Ок</button>
          </div>
        </div>
      )}

      {ELIAS_CUSTOM_DICT_UI_ENABLED && eliasCustomModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 120, padding: 16 }} onClick={() => setEliasCustomModalOpen(false)}>
          <div style={{ background: 'var(--tg-theme-bg-color, #1a1a1a)', padding: 20, borderRadius: 12, maxWidth: 420, maxHeight: '85vh', overflow: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0, marginBottom: 8 }}>Пользовательский словарь Элиас</h3>
            <p style={{ fontSize: 13, opacity: 0.9, marginBottom: 10 }}>По одному слову на строку. Используется локально и отправляется при старте партии.</p>
            <textarea
              value={eliasCustomWordsText}
              onChange={(e) => setEliasCustomWordsText(e.target.value)}
              rows={10}
              style={{ width: '100%', borderRadius: 8, padding: 10, marginBottom: 10 }}
              placeholder={'слово 1\nслово 2\nслово 3'}
            />
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <button
                type="button"
                style={{ ...btnStyle }}
                onClick={() => {
                  const words = eliasCustomWordsText.split('\n').map((x) => x.trim()).filter(Boolean);
                  const saved = saveCustomEliasWords(words);
                  patchLobbyGame({ gameSettings: { ...room?.gameSettings, eliasCustomWords: saved.elias } });
                }}
              >
                Сохранить
              </button>
              <button
                type="button"
                style={{ ...btnStyleToggleOff }}
                onClick={async () => {
                  const text = exportCustomDictionariesText();
                  try {
                    await navigator.clipboard.writeText(text);
                  } catch (_) {}
                }}
              >
                Экспорт JSON
              </button>
            </div>
            <textarea
              value={eliasImportText}
              onChange={(e) => setEliasImportText(e.target.value)}
              rows={4}
              style={{ width: '100%', borderRadius: 8, padding: 10, marginBottom: 10 }}
              placeholder='Вставьте JSON для импорта'
            />
            <button
              type="button"
              style={{ ...btnStyleToggleMid, marginBottom: 10 }}
              onClick={() => {
                try {
                  const parsed = importCustomDictionariesText(eliasImportText);
                  setEliasCustomWordsText((parsed.elias || []).join('\n'));
                  patchLobbyGame({ gameSettings: { ...room?.gameSettings, eliasCustomWords: parsed.elias } });
                } catch (_) {}
              }}
            >
              Импорт JSON
            </button>
            <button type="button" onClick={() => setEliasCustomModalOpen(false)} style={btnStyle}>Готово</button>
          </div>
        </div>
      )}

      <Modal open={qrOpen} onClose={() => setQrOpen(false)} title="QR приглашения" width={360}>
        {inviteLink ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
              <img src={qrUrl} alt="QR invite" style={{ width: 220, height: 220, borderRadius: 8, background: '#fff', padding: 8 }} />
            </div>
            <p style={{ fontSize: 12, opacity: 0.85, wordBreak: 'break-all', marginTop: 0 }}>{inviteLink}</p>
            <Button variant="secondary" fullWidth onClick={shareInvite}>
              Поделиться ссылкой
            </Button>
            <Button variant="ghost" fullWidth onClick={() => setQrOpen(false)} style={{ marginTop: 10 }}>
              Закрыть
            </Button>
          </>
        ) : (
          <EmptyState title="Нет ссылки" message="Сначала создайте или восстановите комнату." />
        )}
      </Modal>

      <ShopModal open={shopOpen} onClose={() => setShopOpen(false)} initialGameFilter={selectedGame || 'all'} />
    </PageLayout>
  );
}

const btnStyle = {
  padding: '12px 20px',
  fontSize: 16,
  borderRadius: '12px',
  border: 'none',
  background: 'var(--tg-theme-button-color, #3a7bd5)',
  color: 'var(--tg-theme-button-text-color, #fff)',
  cursor: 'pointer',
  width: '100%',
  boxShadow: '0 2px 8px rgba(0,0,0,0.14)',
  fontWeight: 600,
};

const btnStyleToggleOff = {
  ...btnStyle,
  background: 'var(--gh-toggle-off)',
  boxShadow: 'none',
  border: '1px solid var(--gh-border)',
  color: 'var(--tg-theme-text-color)',
};

const btnStyleToggleMid = {
  ...btnStyleToggleOff,
  background: 'var(--gh-toggle-mid)',
};

const btnStyleToggleInk = {
  ...btnStyleToggleOff,
  background: 'var(--gh-toggle-deep)',
};

const btnStyleWarn = {
  ...btnStyleToggleOff,
  background: 'var(--gh-color-danger)',
  color: '#fff',
  border: '1px solid color-mix(in srgb, var(--gh-color-danger) 70%, #000)',
  boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
};

const settingsBox = {
  padding: 16,
  marginBottom: 16,
  borderRadius: 12,
  background: 'var(--gh-surface, rgba(255,255,255,0.06))',
  border: '1px solid var(--gh-border, rgba(255,255,255,0.12))',
  boxShadow: 'var(--gh-shadow, 0 10px 30px rgba(0,0,0,0.28))',
};
