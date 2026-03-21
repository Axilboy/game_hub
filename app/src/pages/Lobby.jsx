import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, getApiErrorMessage } from '../api';
import { track } from '../analytics';
import { getInventory } from '../inventory';
import { getAvatar, getProfilePhoto } from '../displayName';
import { exportCustomDictionariesText, getCustomDictionaries, importCustomDictionariesText, saveCustomEliasWords } from '../customDictionaries';
import { buildInviteLinks, shareInviteSmart } from '../invite';
import ShopModal from '../components/ShopModal';
import { useToast } from '../components/ui/ToastProvider';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import PageLayout from '../components/layout/PageLayout';
import AppHeaderRight from '../components/layout/AppHeaderRight';
import Badge from '../components/ui/Badge';
import Chip from '../components/ui/Chip';
import EmptyState from '../components/ui/EmptyState';
import IconButton from '../components/ui/IconButton';
import { BUNKER_SPEED_PRESETS, bunkerPhaseTimersFromSpeed, getDefaultGameSettings } from '../lobbyPresets';

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
const BUNKER_ROUND_OPTIONS = [2, 3, 4];
const BUNKER_SCENARIOS = [
  { id: 'shelter_default', label: 'Классический', premium: false, itemId: null },
  { id: 'pandemic_plus', label: 'Пандемия+', premium: true, itemId: 'bunker_pandemic' },
  { id: 'orbital_station', label: 'Орбита', premium: true, itemId: 'bunker_space' },
];
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

export default function Lobby({ room, roomId, user, onLeave, onRoomUpdate }) {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const isHost = room.players?.some((p) => p.id === String(user?.id) && p.isHost);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [startingGame, setStartingGame] = useState(false);
  const [mafiaAccordions, setMafiaAccordions] = useState({ mode: true, rules: true, host: true });
  const [eliasAccordions, setEliasAccordions] = useState({ timer: true, goal: true, teams: false });
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
  const [spyLocationsModalOpen, setSpyLocationsModalOpen] = useState(false);
  /** Черновик словарей в модалке «Локации» (Шпион): можно снять все, сохранение по «Готово») */
  const [spyDictDraft, setSpyDictDraft] = useState(null);
  /** Черновик словарей Элиас в модалке выбора */
  const [eliasDictDraft, setEliasDictDraft] = useState(null);
  const [minPlayersWarning, setMinPlayersWarning] = useState(null);
  const [eliasDictModalOpen, setEliasDictModalOpen] = useState(false);
  const [tdCategoryModalOpen, setTdCategoryModalOpen] = useState(false);
  const [tdCategoryDraft, setTdCategoryDraft] = useState(null);
  const [eliasCustomModalOpen, setEliasCustomModalOpen] = useState(false);
  const [eliasCustomWordsText, setEliasCustomWordsText] = useState('');
  const [eliasImportText, setEliasImportText] = useState('');
  const [gamesPickerOpen, setGamesPickerOpen] = useState(false);
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const [transferHostOpen, setTransferHostOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);

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
  const tdCategorySlugs = Array.isArray(tdGameSettings.categorySlugs) && tdGameSettings.categorySlugs.length
    ? tdGameSettings.categorySlugs
    : ['classic', 'friends'];

  useEffect(() => {
    setEditNameValue(roomName);
  }, [roomName]);
  useEffect(() => {
    if (isHost && selectedGame === null) setGamesPickerOpen(true);
    if (selectedGame) setGamesPickerOpen(false);
  }, [isHost, selectedGame]);

  useEffect(() => {
    setTimerEnabled(room?.gameSettings?.timerEnabled ?? false);
    setTimerSeconds(room?.gameSettings?.timerSeconds ?? 60);
    setSpyCount(room?.gameSettings?.spyCount ?? 1);
    setAllSpiesChanceEnabled(!!room?.gameSettings?.allSpiesChanceEnabled);
    setDictionaryIds(room?.gameSettings?.dictionaryIds ?? ['free']);
  }, [room?.gameSettings]);

  useEffect(() => {
    const local = getCustomDictionaries();
    setEliasCustomWordsText((local.elias || []).join('\n'));
  }, []);

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
      const { room: r } = await api.patch(`/rooms/${roomId}`, {
        hostId: String(user?.id),
        ...updates,
      });
      if (r) onRoomUpdate(r);
    } catch (_) {}
  };

  const startSpy = async () => {
    if (!isHost) return;
    const count = room?.players?.length ?? 0;
    const minSpy = minSpyPlayers(spyCount);
    if (count < minSpy) {
      setMinPlayersWarning(`Для игры в Шпион с ${spyCount} шпион${spyCount === 1 ? 'ом' : 'ами'} нужно минимум ${minSpy} игроков. Сейчас в лобби: ${count}.`);
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
        phaseTimers: gs.phaseTimers || { nightMafia: 45, nightCommissioner: 25, day: 90, voting: 45 },
        ...opts,
      });
      const { room: r } = await api.get(`/rooms/${roomId}`);
      onRoomUpdate(r);
      track('lobby_start_game', { game: 'mafia' });
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
    const teams = gs.eliasTeams;
    const hasTeams = Array.isArray(teams) && teams.length >= 2;
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
      await api.post('/rooms/truth_dare/start', {
        roomId,
        hostId: String(user?.id),
        mode: gs.mode || 'mixed',
        categorySlugs: Array.isArray(gs.categorySlugs) && gs.categorySlugs.length ? gs.categorySlugs : ['classic', 'friends'],
        show18Plus: !!gs.show18Plus,
        safeMode: gs.safeMode !== false,
        roundsCount: gs.roundsCount ?? 5,
        timerSeconds: gs.timerSeconds ?? 60,
        skipLimitPerPlayer: gs.skipLimitPerPlayer ?? 2,
        randomStartPlayer: gs.randomStartPlayer !== false,
      });
      const { room: r } = await api.get(`/rooms/${roomId}`);
      onRoomUpdate(r);
      track('lobby_start_game', { game: 'truth_dare' });
      navigate('/truth_dare');
    } catch (e) {
      setStartingGame(false);
      setMinPlayersWarning(getApiErrorMessage(e, 'Не удалось запустить игру'));
    }
  };

  /** Быстрый старт из блока «Быстрые действия хоста» — та же логика, что у кнопки «Начать игру» в настройках режима */
  const startSelectedGame = async () => {
    if (!isHost || !selectedGame || startingGame) return;
    if (selectedGame === 'spy') await startSpy();
    else if (selectedGame === 'mafia') await startMafia();
    else if (selectedGame === 'elias') await startElias();
    else if (selectedGame === 'bunker') await startBunker();
    else if (selectedGame === 'truth_dare') await startTruthDare();
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

  const closeSpyLocationsModal = () => {
    setSpyLocationsModalOpen(false);
    setSpyDictDraft(null);
  };

  const confirmSpyDictDraft = () => {
    const d = Array.isArray(spyDictDraft) ? spyDictDraft : [];
    if (d.length === 0) {
      showToast({ type: 'error', message: 'Словари не выбраны. Отметьте хотя бы один набор локаций и снова нажмите «Готово».' });
      return;
    }
    setDictionaryIds(d);
    patchLobbyGame({ gameSettings: { ...room?.gameSettings, timerEnabled, timerSeconds, spyCount, allSpiesChanceEnabled, dictionaryIds: d } });
    closeSpyLocationsModal();
  };

  const closeEliasDictModal = () => {
    setEliasDictModalOpen(false);
    setEliasDictDraft(null);
  };

  const confirmEliasDictDraft = () => {
    const d = Array.isArray(eliasDictDraft) ? eliasDictDraft : [];
    if (d.length === 0) {
      showToast({ type: 'error', message: 'Словари не выбраны. Отметьте хотя бы один словарь для Элиас и снова нажмите «Готово».' });
      return;
    }
    patchLobbyGame({ gameSettings: { ...room?.gameSettings, dictionaryIds: d } });
    closeEliasDictModal();
  };

  const closeTdCategoryModal = () => {
    setTdCategoryModalOpen(false);
    setTdCategoryDraft(null);
  };

  const confirmTdCategoryDraft = () => {
    const d = Array.isArray(tdCategoryDraft) ? tdCategoryDraft : [];
    if (d.length === 0) {
      showToast({ type: 'error', message: 'Категории не выбраны. Отметьте хотя бы один набор карточек и снова нажмите «Готово».' });
      return;
    }
    patchLobbyGame({ gameSettings: { ...room?.gameSettings, categorySlugs: d } });
    closeTdCategoryModal();
  };

  const transferHostTo = async (newHostId) => {
    try {
      await api.post(`/rooms/${roomId}/transfer-host`, { playerId: String(user?.id), newHostId });
      showToast({ type: 'success', message: 'Хост передан' });
      setTransferHostOpen(false);
      const { room: r } = await api.get(`/rooms/${roomId}`);
      onRoomUpdate(r);
    } catch (e) {
      showToast({ type: 'error', message: getApiErrorMessage(e, 'Не удалось передать хоста') });
    }
  };

  const playersList = room.players || [];
  return (
    <PageLayout
      title={roomName}
      onBack={handleBack}
      right={<AppHeaderRight user={user} />}
    >
      {editingName && isHost ? (
        <input
          type="text"
          value={editNameValue}
          onChange={(e) => setEditNameValue(e.target.value)}
          onBlur={saveRoomName}
          onKeyDown={(e) => e.key === 'Enter' && saveRoomName()}
          autoFocus
          style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 16, width: '100%', padding: 8, borderRadius: 8 }}
        />
      ) : (
        <h2
          style={{ marginBottom: 16, cursor: isHost ? 'pointer' : 'default' }}
          onClick={() => isHost && setEditingName(true)}
          title={isHost ? 'Нажмите, чтобы изменить название' : ''}
        >
          {roomName}
        </h2>
      )}

      <p style={{ marginBottom: 12 }}>
        ID комнаты: <strong>{room.code}</strong>
      </p>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <Button variant="primary" onClick={shareInvite} style={{ flex: 1 }}>
          Поделиться
        </Button>
        <Button variant="secondary" onClick={() => setQrOpen(true)} style={{ flex: 1 }} disabled={!inviteLink}>
          QR
        </Button>
      </div>
      {inviteLink && (
        <div style={{ marginBottom: 16 }}>
          <p>Приглашение:</p>
          {miniAppLink && (
            <p style={{ marginBottom: 4 }}>
              <a href={miniAppLink} target="_blank" rel="noopener noreferrer" style={{ wordBreak: 'break-all', color: '#7ab' }}>
                Открыть в приложении
              </a>
            </p>
          )}
          {webLink && (
            <p style={{ marginBottom: 8 }}>
              <a href={webLink} target="_blank" rel="noopener noreferrer" style={{ wordBreak: 'break-all', color: '#7ab' }}>
                {webLink}
              </a>
            </p>
          )}
          <button
            type="button"
            onClick={shareInvite}
            style={{ ...btnStyle, marginTop: 8 }}
          >
            Поделиться
          </button>
        </div>
      )}
      {isHost && (
        <div className="gh-card" style={{ padding: 12, marginBottom: 16 }}>
          <p style={{ margin: 0, fontWeight: 800, marginBottom: 8, opacity: 0.95 }}>Быстрые действия хоста</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <Chip onClick={shareInvite} active>
              Поделиться
            </Chip>
            <Chip
              onClick={startSelectedGame}
              active={Boolean(selectedGame)}
              disabled={!selectedGame || startingGame}
              title={!selectedGame ? 'Сначала выберите игру внизу' : startingGame ? 'Запуск…' : 'Запустить выбранную игру'}
            >
              {startingGame ? 'Запуск…' : 'Начать'}
            </Chip>
            <Chip onClick={() => setTransferHostOpen(true)} disabled={playersList.length < 2}>
              Передать хоста
            </Chip>
          </div>
          <p style={{ margin: '10px 0 0', fontSize: 12, opacity: 0.82, lineHeight: 1.4 }}>
            Если хост отключился от сети, права хоста автоматически передаются другому игроку (предпочтительно онлайн).
          </p>
        </div>
      )}

      {isHost && selectedGame === null && !gamesPickerOpen && (
        <div className="gh-card" style={{ padding: 12, marginBottom: 16 }}>
          <p style={{ margin: '0 0 10px', fontSize: 13, opacity: 0.88, lineHeight: 1.4 }}>
            Выберите режим для комнаты — откроется список игр.
          </p>
          <Button variant="primary" fullWidth onClick={() => setGamesPickerOpen(true)} aria-label="Открыть выбор игры">
            Выбрать игру
          </Button>
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 8 }}>
        {playersList.length === 0 ? (
          <EmptyState title="Игроков пока нет" message="Поделитесь кодом комнаты или ссылкой-приглашением." />
        ) : playersList.map((p) => (
          <div
            key={p.id}
            className="gh-card"
            style={{
              padding: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
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
                  <span style={{ position: 'absolute', bottom: -3, right: -3, fontSize: 14 }} title="Премиум">👑</span>
                )}
              </div>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {p.name}
                <span style={{ marginLeft: 6 }}>
                  {p.isHost ? <Badge tone="info">Хост</Badge> : null}
                  {p.hasPro && !p.isHost ? <span style={{ marginLeft: 4 }}><Badge tone="warning">Премиум</Badge></span> : null}
                  {p.online === false ? <span style={{ marginLeft: 4 }}><Badge tone="danger">Офлайн</Badge></span> : null}
                </span>
              </span>
            </div>
            {isHost && p.id !== String(user?.id) && !p.isHost && (
              <IconButton
                icon="×"
                label="Кикнуть игрока"
                onClick={async () => {
                  try {
                    await api.post(`/rooms/${roomId}/kick`, { hostId: String(user?.id), playerIdToKick: p.id });
                  } catch (_) {}
                }}
              />
            )}
          </div>
        ))}
      </div>

      {selectedGame && (
        <div className="gh-card" style={{ padding: 12, marginBottom: 16 }}>
          <p style={{ margin: 0, fontWeight: 800, marginBottom: 6, opacity: 0.95 }}>Конфигурация</p>
          {selectedGame === 'spy' ? (
            <p style={{ margin: 0, opacity: 0.9, lineHeight: 1.4, fontSize: 14 }}>
              Шпион: словари {(room?.gameSettings?.dictionaryIds || ['free']).map((d) => DICT_NAMES[d] || d).join(', ')} ·
              шпионов {room?.gameSettings?.spyCount ?? 1} · таймер {room?.gameSettings?.timerEnabled ? `${(room?.gameSettings?.timerSeconds || 60) / 60} мин` : 'выкл'}
            </p>
          ) : selectedGame === 'elias' ? (
            <p style={{ margin: 0, opacity: 0.9, lineHeight: 1.4, fontSize: 14 }}>
              Элиас: победа при {room?.gameSettings?.scoreLimit ?? 10} очках · таймер {(room?.gameSettings?.timerSeconds || 60) / 60} мин ·
              словари {(room?.gameSettings?.dictionaryIds || ['basic', 'animals']).join(', ')}
            </p>
          ) : selectedGame === 'mafia' ? (
            <p style={{ margin: 0, opacity: 0.9, lineHeight: 1.4, fontSize: 14 }}>
              Мафия: {room?.gameSettings?.extended ? 'расширенная' : 'классическая'} · ведущий{' '}
              {room?.gameSettings?.hostSelection === 'choose' ? 'выбран' : 'рандом'} ·
              таймер не используется
            </p>
          ) : (
            <p style={{ margin: 0, opacity: 0.9, lineHeight: 1.4, fontSize: 14 }}>Игра выбрана.</p>
          )}
        </div>
      )}

      {selectedGame === 'spy' && (
        <>
          <p style={{ marginTop: 24, marginBottom: 8 }}>
            Игра: <strong>Шпион</strong>
            {isHost && (
              <button type="button" onClick={() => patchLobbyGame({ selectedGame: null })} style={{ fontSize: 12, marginLeft: 8, background: 'transparent', border: 'none', color: '#8af', cursor: 'pointer' }}>другая</button>
            )}
          </p>
          {(room?.gameSettings && !isHost) && (
            <div style={{ ...settingsBox, marginBottom: 16 }}>
              <p style={{ marginTop: 0, marginBottom: 8 }}>Настройки (хост)</p>
              <p style={{ margin: 0, fontSize: 14 }}>Шпионов: {room.gameSettings.spyCount ?? 1}</p>
              <p style={{ margin: '4px 0 0', fontSize: 14 }}>Все шпионы (редко): {room.gameSettings.allSpiesChanceEnabled ? 'да' : 'нет'}</p>
              <p style={{ margin: '4px 0 0', fontSize: 14 }}>Шпионы видят друг друга: {room.gameSettings.spiesSeeEachOther ? 'да' : 'нет'}</p>
              <p style={{ margin: '4px 0 0', fontSize: 14 }}>Список локаций в раунде: {room.gameSettings.showLocationsList ? 'показан всем' : 'скрыт'}</p>
              <p style={{ margin: '4px 0 0', fontSize: 12, opacity: 0.8 }}>Мин. {minSpyPlayers(room?.gameSettings?.spyCount ?? 1)} игроков</p>
              <p style={{ margin: '4px 0 0', fontSize: 14 }}>Таймер: {room.gameSettings.timerEnabled ? `${(room.gameSettings.timerSeconds || 60) / 60} мин` : 'выкл'}</p>
              <p style={{ margin: '4px 0 0', fontSize: 14 }}>Словари: {(room.gameSettings.dictionaryIds || ['free']).map((d) => DICT_NAMES[d] || d).join(', ')}</p>
            </div>
          )}
          {isHost && (
            <>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <button
                  type="button"
                  onClick={() => setSettingsOpen(!settingsOpen)}
                  style={{ ...btnStyleToggleMid, flex: 1 }}
                >
                  Настройки
                </button>
                <button type="button" onClick={startSpy} style={{ ...btnStyle, flex: 1 }}>
                  Начать
                </button>
              </div>
              {settingsOpen && (
                <div style={settingsBox}>
                  <p style={{ marginTop: 0, marginBottom: 8 }}>Количество шпионов</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                    {SPY_COUNT_OPTIONS.map((n) => {
                      const enabled = n === 1 || roomHasPro;
                      const on = spyCount === n;
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
                          {n}{n > 1 && <span style={{ fontSize: 10, marginLeft: 4 }}>Премиум</span>}
                        </button>
                      );
                    })}
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <input
                      type="checkbox"
                      checked={allSpiesChanceEnabled}
                      onChange={(e) => {
                        setAllSpiesChanceEnabled(e.target.checked);
                        patchLobbyGame({ gameSettings: { ...room?.gameSettings, timerEnabled, timerSeconds, spyCount, allSpiesChanceEnabled: e.target.checked, dictionaryIds } });
                      }}
                    />
                    <span>Все шпионы (редкий шанс)</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                    <input
                      type="checkbox"
                      checked={!!room?.gameSettings?.spiesSeeEachOther}
                      onChange={(e) => patchLobbyGame({ gameSettings: { ...room?.gameSettings, spiesSeeEachOther: e.target.checked } })}
                    />
                    <span>Шпионы видят друг друга</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                    <input
                      type="checkbox"
                      checked={!!room?.gameSettings?.showLocationsList}
                      onChange={(e) => patchLobbyGame({ gameSettings: { ...room?.gameSettings, showLocationsList: e.target.checked } })}
                    />
                    <span>Показывать всем список возможных локаций</span>
                  </label>
                  <p style={{ marginBottom: 8 }}>Локации</p>
                  <button
                    type="button"
                    onClick={() => {
                      const cur = room?.gameSettings?.dictionaryIds ?? dictionaryIds ?? ['free'];
                      setSpyDictDraft([...cur]);
                      setSpyLocationsModalOpen(true);
                    }}
                    style={{ ...btnStyleToggleMid, marginBottom: 16 }}
                  >
                    Локации (выбрано: {(room?.gameSettings?.dictionaryIds || dictionaryIds || []).length})
                  </button>
                  <p style={{ marginBottom: 8 }}>Таймер раунда</p>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <input
                      type="checkbox"
                      checked={timerEnabled}
                      onChange={(e) => { setTimerEnabled(e.target.checked); patchLobbyGame({ gameSettings: { ...room?.gameSettings, timerEnabled: e.target.checked, timerSeconds, spyCount, allSpiesChanceEnabled, dictionaryIds } }); }}
                    />
                    <span>Включить таймер</span>
                  </label>
                  {timerEnabled && (
                    <div style={{ marginBottom: 12 }}>
                      <p style={{ marginBottom: 6 }}>Время:</p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {TIMER_OPTIONS.map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => { setTimerSeconds(opt.value); patchLobbyGame({ gameSettings: { ...room?.gameSettings, timerEnabled, timerSeconds: opt.value, spyCount, allSpiesChanceEnabled, dictionaryIds } }); }}
                            style={{
                              ...(timerSeconds === opt.value ? btnStyle : btnStyleToggleOff),
                              width: 'auto',
                              padding: '8px 14px',
                            }}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </>
      )}

      {selectedGame === 'mafia' && (
        <>
          <p style={{ marginTop: 24, marginBottom: 8 }}>
            Игра: <strong>Мафия</strong>
            {isHost && (
              <button type="button" onClick={() => patchLobbyGame({ selectedGame: null })} style={{ fontSize: 12, marginLeft: 8, background: 'transparent', border: 'none', color: '#8af', cursor: 'pointer' }}>другая</button>
            )}
          </p>
          {(room?.gameSettings && !isHost) && (
            <div style={{ ...settingsBox, marginBottom: 16 }}>
              <p style={{ marginTop: 0, marginBottom: 8 }}>Настройки (хост)</p>
              <p style={{ margin: 0, fontSize: 14 }}>Режим: {room.gameSettings.extended ? 'Расширенный (Премиум)' : 'Классика'}</p>
              <p style={{ margin: '4px 0 0', fontSize: 14 }}>Ведущий: {room.gameSettings.hostSelection === 'choose' ? 'выбор' : 'случайно'}</p>
              <p style={{ margin: '4px 0 0', fontSize: 14 }}>
                Таймеры фаз: ночь {room.gameSettings.phaseTimers?.nightMafia ?? 45}с, день {room.gameSettings.phaseTimers?.day ?? 90}с, голосование {room.gameSettings.phaseTimers?.voting ?? 45}с
              </p>
              <p style={{ margin: '4px 0 0', fontSize: 12, opacity: 0.8 }}>Мин. {MIN_PLAYERS.mafia} игроков</p>
            </div>
          )}
          {isHost && (
            <div style={{ ...settingsBox }}>
              <button
                type="button"
                onClick={() => setMafiaAccordions((s) => ({ ...s, mode: !s.mode }))}
                style={{ ...(mafiaAccordions.mode ? btnStyleToggleMid : btnStyleToggleOff), width: '100%', marginBottom: 12 }}
              >
                Режим <span style={{ fontSize: 12, opacity: 0.8 }}>(мин. {MIN_PLAYERS.mafia} игр.)</span>
              </button>
              {mafiaAccordions.mode && (
                <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                  <button
                    type="button"
                    onClick={() => { setMafiaClassicPopup(true); if (room?.gameSettings?.extended) patchLobbyGame({ gameSettings: { ...room?.gameSettings, extended: false } }); }}
                    style={{ ...(room?.gameSettings?.extended ? btnStyleToggleOff : btnStyle), flex: 1, padding: 10 }}
                    title="Какие роли в игре"
                  >
                    Классика
                  </button>
                  <button
                    type="button"
                    onClick={() => { setMafiaExtendedPopup(true); if (roomHasPro && !room?.gameSettings?.extended) patchLobbyGame({ gameSettings: { ...room?.gameSettings, extended: true } }); }}
                    style={{ ...(room?.gameSettings?.extended ? btnStyle : btnStyleToggleOff), flex: 1, padding: 10, opacity: roomHasPro ? 1 : 0.6 }}
                    title="Подробнее об расширенной версии"
                  >
                    Расширенная (Премиум)
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={() => setMafiaAccordions((s) => ({ ...s, rules: !s.rules }))}
                style={{ ...(mafiaAccordions.rules ? btnStyleToggleMid : btnStyleToggleOff), width: '100%', marginBottom: 12 }}
              >
                Правила
              </button>
              {mafiaAccordions.rules && (
                <>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <input type="checkbox" checked={room?.gameSettings?.revealRoleOnDeath !== false} onChange={(e) => patchLobbyGame({ gameSettings: { ...room?.gameSettings, revealRoleOnDeath: e.target.checked } })} />
                    <span>Показывать роль после смерти</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                    <input type="checkbox" checked={!!room?.gameSettings?.mafiaCanSkipKill} onChange={(e) => patchLobbyGame({ gameSettings: { ...room?.gameSettings, mafiaCanSkipKill: e.target.checked } })} />
                    <span>Мафия может не убивать ночью</span>
                  </label>
                  <p style={{ margin: '0 0 6px', fontSize: 14 }}>Скорость фаз</p>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                    {[
                      { id: 'fast', label: 'Быстро', val: { nightMafia: 30, nightCommissioner: 20, day: 60, voting: 30 } },
                      { id: 'std', label: 'Стандарт', val: { nightMafia: 45, nightCommissioner: 25, day: 90, voting: 45 } },
                      { id: 'long', label: 'Дольше', val: { nightMafia: 60, nightCommissioner: 35, day: 120, voting: 60 } },
                    ].map((p) => {
                      const cur = room?.gameSettings?.phaseTimers || {};
                      const active = cur.nightMafia === p.val.nightMafia && cur.day === p.val.day && cur.voting === p.val.voting;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => patchLobbyGame({ gameSettings: { ...room?.gameSettings, phaseTimers: p.val } })}
                          style={{ ...(active ? btnStyle : btnStyleToggleOff), flex: 1, padding: 10 }}
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
                        phaseTimers: { nightMafia: 30, nightCommissioner: 20, day: 40, voting: 30 },
                      },
                    })}
                    style={{ ...btnStyle, marginBottom: 12 }}
                    title="Компактная партия около 10 минут"
                  >
                    Режим 10 минут
                  </button>
                  <p style={{ margin: '0 0 16px', fontSize: 12, opacity: 0.8 }}>
                    Ускоренный формат: короткие ночь/день/голосование для быстрой партии.
                  </p>
                </>
              )}

              <button
                type="button"
                onClick={() => setMafiaAccordions((s) => ({ ...s, host: !s.host }))}
                style={{ ...(mafiaAccordions.host ? btnStyleToggleMid : btnStyleToggleOff), width: '100%', marginBottom: 12 }}
              >
                Ведущий
              </button>
              {mafiaAccordions.host && (
                <>
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
                    <div style={{ marginBottom: 16 }}>
                      <p style={{ marginBottom: 6, fontSize: 14 }}>Кто ведущий?</p>
                      {(room?.players || []).map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => patchLobbyGame({ gameSettings: { ...room?.gameSettings, moderatorId: p.id } })}
                          style={{ ...(room?.gameSettings?.moderatorId === p.id ? btnStyle : btnStyleToggleOff), marginBottom: 6, padding: 8 }}
                        >
                          {p.name}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}

              <button type="button" onClick={() => startMafia()} style={btnStyle}>Начать игру</button>
            </div>
          )}
        </>
      )}

      {selectedGame === 'elias' && (
        <>
          <p style={{ marginTop: 24, marginBottom: 8 }}>
            Игра: <strong>Элиас</strong>
            {isHost && (
              <button type="button" onClick={() => patchLobbyGame({ selectedGame: null })} style={{ fontSize: 12, marginLeft: 8, background: 'transparent', border: 'none', color: '#8af', cursor: 'pointer' }}>другая</button>
            )}
          </p>
          {(room?.gameSettings && !isHost) && (
            <div style={{ ...settingsBox, marginBottom: 16 }}>
              <p style={{ marginTop: 0, marginBottom: 8 }}>Настройки (хост)</p>
              <p style={{ margin: 0, fontSize: 14 }}>Таймер: {(room.gameSettings.timerSeconds || 60) / 60} мин</p>
              <p style={{ margin: '4px 0 0', fontSize: 14 }}>До очков: {room.gameSettings.scoreLimit ?? 10}</p>
              <p style={{ margin: '4px 0 0', fontSize: 14 }}>Штраф за пропуск: −{room.gameSettings.skipPenalty ?? 1}</p>
              <p style={{ margin: '4px 0 0', fontSize: 12, opacity: 0.8 }}>Мин. {MIN_PLAYERS.elias} игроков</p>
              {(room.gameSettings.eliasTeams?.length > 0) && (
                <p style={{ margin: '8px 0 0', fontSize: 13 }}>
                  Команды: {room.gameSettings.eliasTeams.map((t, i) => `${t.name}: ${(t.playerIds || []).map((id) => room?.players?.find((p) => p.id === id)?.name).filter(Boolean).join(', ') || '—'}`).join(' | ')}
                </p>
              )}
            </div>
          )}
          {isHost && (
            <div style={{ ...settingsBox }}>
              <button
                type="button"
                onClick={() => setEliasAccordions((s) => ({ ...s, timer: !s.timer }))}
                style={{ ...(eliasAccordions.timer ? btnStyleToggleMid : btnStyleToggleOff), width: '100%', marginBottom: 12 }}
              >
                Таймер раунда (сек) <span style={{ fontSize: 12, opacity: 0.8 }}>(мин. {MIN_PLAYERS.elias} игр.)</span>
              </button>
              {eliasAccordions.timer && (
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
              )}

              <button
                type="button"
                onClick={() => setEliasAccordions((s) => ({ ...s, goal: !s.goal }))}
                style={{ ...(eliasAccordions.goal ? btnStyleToggleMid : btnStyleToggleOff), width: '100%', marginBottom: 12 }}
              >
                Победа (очков)
              </button>
              {eliasAccordions.goal && (
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
              )}
              <p style={{ margin: '0 0 6px', fontSize: 14 }}>Штраф за пропуск</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
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

              <button
                type="button"
                onClick={() => {
                  const cur = room?.gameSettings?.dictionaryIds || ['basic', 'animals', 'memes'];
                  setEliasDictDraft([...cur]);
                  setEliasDictModalOpen(true);
                }}
                style={{ ...btnStyleToggleOff, width: '100%', marginBottom: 12 }}
              >
                Словари ({(room?.gameSettings?.dictionaryIds || ['basic', 'animals', 'memes']).length})
              </button>

              <button
                type="button"
                onClick={() => setEliasAccordions((s) => ({ ...s, teams: !s.teams }))}
                style={{ ...(eliasAccordions.teams ? btnStyleToggleMid : btnStyleToggleOff), width: '100%', marginBottom: 12 }}
              >
                Команды
              </button>
              {eliasAccordions.teams && (
                <>
                  <p style={{ fontSize: 12, opacity: 0.85, marginBottom: 10 }}>Назначьте игроков в команды до старта. Нечётное число: один может быть «Не играет».</p>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => {
                        const teams = room?.gameSettings?.eliasTeams ?? [{ name: 'Команда 1', playerIds: [] }, { name: 'Команда 2', playerIds: [] }];
                        patchLobbyGame({ gameSettings: { ...room?.gameSettings, eliasTeams: [...teams, { name: `Команда ${teams.length + 1}`, playerIds: [] }] } });
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
                  <div style={{ marginBottom: 16 }}>
                    {(room?.players || []).map((p) => {
                      const teams = room?.gameSettings?.eliasTeams ?? [{ name: 'Команда 1', playerIds: [] }, { name: 'Команда 2', playerIds: [] }];
                      const playerTeamIndex = teams.findIndex((t) => (t.playerIds || []).includes(p.id));
                      const setTeam = (teamIndex) => {
                        const next = teams.map((t, i) => ({
                          ...t,
                          playerIds: (t.playerIds || []).filter((id) => id !== p.id).concat(teamIndex === i ? [p.id] : []),
                        }));
                        patchLobbyGame({ gameSettings: { ...room?.gameSettings, eliasTeams: next } });
                      };
                      return (
                        <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
                          <span style={{ minWidth: 72 }}>{p.name}</span>
                          {teams.map((t, i) => (
                            <button
                              key={t.name}
                              type="button"
                              onClick={() => setTeam(i)}
                              style={{ ...(playerTeamIndex === i ? btnStyle : btnStyleToggleOff), width: 'auto', padding: '6px 8px', fontSize: 11 }}
                            >
                              {t.name}
                            </button>
                          ))}
                          <button
                            type="button"
                            onClick={() => setTeam(-1)}
                            style={{ ...(playerTeamIndex === -1 ? btnStyleToggleMid : btnStyleToggleInk), width: 'auto', padding: '6px 8px', fontSize: 11 }}
                          >
                            Не играет
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              <button type="button" onClick={startElias} style={btnStyle}>Начать игру</button>
            </div>
          )}
        </>
      )}

      {selectedGame === 'truth_dare' && (
        <>
          <p style={{ marginTop: 24, marginBottom: 8 }}>
            Игра: <strong>Правда или действие</strong>
            {isHost && (
              <button
                type="button"
                onClick={() => patchLobbyGame({ selectedGame: null })}
                style={{ fontSize: 12, marginLeft: 8, background: 'transparent', border: 'none', color: '#8af', cursor: 'pointer' }}
              >
                другая
              </button>
            )}
          </p>

          {(room?.gameSettings && !isHost) && (
            <div style={{ ...settingsBox, marginBottom: 16 }}>
              <p style={{ marginTop: 0, marginBottom: 8 }}>Настройки</p>
              <p style={{ margin: 0, fontSize: 14 }}>Формат: одна карточка — на выбор правда или действие</p>
              <p style={{ margin: '4px 0 0', fontSize: 14 }}>Safe: {tdSafeMode ? 'да' : 'нет'}</p>
              <p style={{ margin: '4px 0 0', fontSize: 14 }}>
                18+: {tdSafeMode ? 'нет (safe)' : tdShow18Plus ? 'да' : 'нет'}
              </p>
              <p style={{ margin: '4px 0 0', fontSize: 14 }}>Раундов: {tdRoundsCount}</p>
              <p style={{ margin: '4px 0 0', fontSize: 14 }}>Лимит пропусков: {tdSkipLimitPerPlayer}</p>
              <p style={{ margin: '4px 0 0', fontSize: 12, opacity: 0.8 }}>Мин. {MIN_PLAYERS.truth_dare} игроков</p>
            </div>
          )}

          {isHost && (
            <div style={{ ...settingsBox }}>
              <p style={{ marginTop: 0, marginBottom: 12, fontSize: 13, opacity: 0.88, lineHeight: 1.45 }}>
                Каждый ход — одна карточка с двумя заданиями. Игрок сам выбирает: ответить честно или выполнить действие.
              </p>

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
                        categorySlugs: nextCats.length ? nextCats : ['classic', 'friends'],
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
                        categorySlugs: nextCats.length ? nextCats : ['classic', 'friends'],
                      },
                    });
                  }}
                />
                <span>Показывать 18+ (нужно 18+ подтверждение)</span>
              </label>

              <p style={{ marginBottom: 8, fontSize: 14 }}>Раундов</p>
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                {[3, 5, 7, 10].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => patchLobbyGame({ gameSettings: { ...room?.gameSettings, roundsCount: n } })}
                    style={{ ...(tdRoundsCount === n ? btnStyle : btnStyleToggleOff), flex: 1, padding: 10, fontSize: 14 }}
                  >
                    {n}
                  </button>
                ))}
              </div>

              <p style={{ marginBottom: 8, fontSize: 14 }}>Лимит пропусков на игрока</p>
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                {[0, 1, 2, 3].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => patchLobbyGame({ gameSettings: { ...room?.gameSettings, skipLimitPerPlayer: n } })}
                    style={{ ...(tdSkipLimitPerPlayer === n ? btnStyle : btnStyleToggleOff), flex: 1, padding: 10, fontSize: 14 }}
                  >
                    {n}
                  </button>
                ))}
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <input
                  type="checkbox"
                  checked={tdGameSettings.randomStartPlayer !== false}
                  onChange={(e) => patchLobbyGame({ gameSettings: { ...room?.gameSettings, randomStartPlayer: e.target.checked } })}
                />
                <span>Случайный первый игрок</span>
              </label>

              <button
                type="button"
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
                  },
                })}
                style={{ ...btnStyle, marginBottom: 12 }}
              >
                Быстрая партия (3 раунда)
              </button>

              <p style={{ marginBottom: 8, fontSize: 14 }}>Категории карточек</p>
              <button
                type="button"
                onClick={() => {
                  const cur = Array.isArray(room?.gameSettings?.categorySlugs) && room.gameSettings.categorySlugs.length
                    ? room.gameSettings.categorySlugs
                    : tdCategorySlugs;
                  setTdCategoryDraft([...cur]);
                  setTdCategoryModalOpen(true);
                }}
                style={{ ...btnStyleToggleMid, width: '100%', marginBottom: 16 }}
              >
                Карточки (выбрано: {tdCategorySlugs.length})
              </button>

              <button type="button" onClick={startTruthDare} disabled={startingGame} style={btnStyle}>
                {startingGame ? 'Запуск...' : 'Начать игру'}
              </button>

              <p style={{ marginTop: 10, marginBottom: 0, fontSize: 12, opacity: 0.85, lineHeight: 1.4 }}>
                Примечание: карточки подбираются под текущего игрока (Pro/18+ учёт на сервере).
              </p>
            </div>
          )}
        </>
      )}

      {isHost && selectedGame && selectedGame === 'bunker' && (
        <div style={{ ...settingsBox, marginTop: 24 }}>
          <p style={{ marginBottom: 8 }}>Бункер: настройки</p>

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
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
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

          <p style={{ marginBottom: 8, opacity: 0.9, fontSize: 14 }}>Сценарий</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
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

          <button type="button" onClick={startBunker} disabled={startingGame} style={btnStyle}>
            {startingGame ? 'Запуск...' : 'Начать игру'}
          </button>
        </div>
      )}

      <button type="button" onClick={() => setShopOpen(true)} style={{ ...btnStyleToggleMid, marginTop: 16 }}>
        Магазин
      </button>

      {isHost && selectedGame ? (
        <button type="button" onClick={() => patchLobbyGame({ selectedGame: null })} style={{ ...btnStyleToggleMid, marginTop: 24 }}>
          Назад
        </button>
      ) : null}
      {(!isHost || !selectedGame) && (
        <button type="button" onClick={() => setLeaveConfirmOpen(true)} style={{ ...btnStyleToggleMid, marginTop: isHost && selectedGame ? 8 : 24 }}>
          Выйти из комнаты
        </button>
      )}

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

      <Modal open={transferHostOpen} onClose={() => setTransferHostOpen(false)} title="Передать хоста" width={400}>
        <p style={{ marginTop: 0, lineHeight: 1.45, opacity: 0.92, fontSize: 14 }}>
          Выберите игрока, которому передать права хоста (старт игр, настройки, кик).
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
          {playersList
            .filter((p) => p.id !== String(user?.id))
            .map((p) => (
              <Button
                key={p.id}
                variant="secondary"
                fullWidth
                onClick={() => transferHostTo(p.id)}
                style={{ justifyContent: 'flex-start' }}
              >
                {p.name}
                {p.online === false ? ' — офлайн' : ''}
              </Button>
            ))}
        </div>
        <Button variant="ghost" fullWidth onClick={() => setTransferHostOpen(false)} style={{ marginTop: 12 }}>
          Отмена
        </Button>
      </Modal>

      {mafiaClassicPopup && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, padding: 24 }} onClick={() => setMafiaClassicPopup(false)}>
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
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, padding: 24 }} onClick={() => setMafiaExtendedPopup(false)}>
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

      {spyLocationsModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, padding: 16 }} onClick={closeSpyLocationsModal}>
          <div style={{ background: 'var(--tg-theme-bg-color, #1a1a1a)', padding: 20, borderRadius: 12, maxWidth: 360, maxHeight: '85vh', overflow: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0, marginBottom: 12 }}>Локации</h3>
            <p style={{ fontSize: 13, opacity: 0.9, marginBottom: 16 }}>
              Можно снять все наборы и выбрать заново. Нажмите «Готово» — если ничего не выбрано, появится предупреждение (нужен хотя бы один словарь, чтобы начать игру).
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
              {(room?.allSpyDictionaryIds || Object.keys(DICT_NAMES)).map((id) => {
                const card = SPY_DICT_CARDS.find((c) => c.id === id) || { id, name: DICT_NAMES[id] || id, description: '', emoji: '📍', free: id === 'free' };
                const available = availableDictionaries.includes(id);
                const draft = Array.isArray(spyDictDraft) ? spyDictDraft : (room?.gameSettings?.dictionaryIds ?? dictionaryIds ?? ['free']);
                const selected = draft.includes(id);
                const handleClick = () => {
                  if (!available) { setSpyLocationsModalOpen(false); setSpyDictLockPopup(id); return; }
                  const cur = Array.isArray(spyDictDraft) ? spyDictDraft : (room?.gameSettings?.dictionaryIds ?? dictionaryIds ?? ['free']);
                  const next = selected ? cur.filter((x) => x !== id) : [...cur, id];
                  setSpyDictDraft(next);
                };
                return (
                  <div
                    key={card.id}
                    role="button"
                    tabIndex={0}
                    onClick={handleClick}
                    onKeyDown={(e) => e.key === 'Enter' && handleClick()}
                    style={{
                      position: 'relative',
                      padding: 14,
                      borderRadius: 10,
                      background: selected ? 'rgba(58, 123, 213, 0.25)' : 'rgba(255,255,255,0.06)',
                      border: `2px solid ${selected ? 'var(--tg-theme-button-color, #3a7bd5)' : 'transparent'}`,
                      cursor: 'pointer',
                      minHeight: 100,
                    }}
                  >
                    {!available && (
                      <div style={{ position: 'absolute', top: 6, right: 6, fontSize: 18, zIndex: 1 }} title="Только Премиум">🔒</div>
                    )}
                    <div style={{ width: 40, height: 40, borderRadius: 8, background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, marginBottom: 8 }}>
                      {card.emoji}
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4, lineHeight: 1.2 }}>{card.name}</div>
                    <div style={{ fontSize: 11, opacity: 0.85, lineHeight: 1.3 }}>{card.description}</div>
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button type="button" onClick={closeSpyLocationsModal} style={{ ...btnStyleToggleMid, flex: 1 }}>
                Отмена
              </button>
              <button type="button" onClick={confirmSpyDictDraft} style={{ ...btnStyle, flex: 1 }}>
                Готово
              </button>
            </div>
          </div>
        </div>
      )}

      {spyDictLockPopup && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, padding: 24 }}>
          <div style={{ background: 'var(--tg-theme-bg-color, #1a1a1a)', padding: 24, borderRadius: 12, maxWidth: 320 }}>
            <p style={{ marginBottom: 8 }}>🔒 {DICT_NAMES[spyDictLockPopup] || spyDictLockPopup}</p>
            <p style={{ fontSize: 14, opacity: 0.9, marginBottom: 16 }}>Этот словарь доступен только по подписке Премиум. Покупка отдельных словарей пока не реализована — оформите Премиум, чтобы открыть все тематические локации.</p>
            <button type="button" onClick={() => setSpyDictLockPopup(null)} style={btnStyle}>Понятно</button>
          </div>
        </div>
      )}

      <Modal
        open={Boolean(isHost && selectedGame === null && gamesPickerOpen)}
        onClose={() => setGamesPickerOpen(false)}
        title="Выберите игру"
        width={420}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {[
            { id: 'spy', name: 'Шпион', minPlayers: 3 },
            { id: 'mafia', name: 'Мафия', minPlayers: MIN_PLAYERS.mafia },
            { id: 'bunker', name: 'Бункер', minPlayers: MIN_PLAYERS.bunker },
            { id: 'elias', name: 'Элиас', minPlayers: MIN_PLAYERS.elias },
            { id: 'truth_dare', name: 'Правда/Действие', minPlayers: MIN_PLAYERS.truth_dare },
          ].map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => {
                patchLobbyGame({ selectedGame: g.id, gameSettings: getDefaultGameSettings(g.id) });
                setGamesPickerOpen(false);
              }}
              style={{ ...btnStyle, padding: '14px 10px', background: 'var(--tg-theme-button-color, #3a7bd5)' }}
            >
              {g.name}
              <span style={{ display: 'block', fontSize: 11, marginTop: 4, opacity: 0.9 }}>мин. {g.minPlayers}</span>
            </button>
          ))}
        </div>
        <div style={{ marginTop: 14 }}>
          <Button variant="secondary" fullWidth type="button" onClick={() => setGamesPickerOpen(false)}>
            Свернуть
          </Button>
          <p style={{ margin: '8px 0 0', fontSize: 12, opacity: 0.75, lineHeight: 1.35 }}>
            Окно можно свернуть и открыть снова кнопкой «Выбрать игру» ниже.
          </p>
        </div>
      </Modal>

      {minPlayersWarning && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, padding: 24 }}>
          <div style={{ background: 'var(--tg-theme-bg-color, #1a1a1a)', padding: 24, borderRadius: 12, maxWidth: 320 }}>
            <p style={{ marginBottom: 16 }}>{minPlayersWarning}</p>
            <button type="button" onClick={() => setMinPlayersWarning(null)} style={btnStyle}>Ок</button>
          </div>
        </div>
      )}

      {tdCategoryModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, padding: 16 }} onClick={closeTdCategoryModal}>
          <div style={{ background: 'var(--tg-theme-bg-color, #1a1a1a)', padding: 20, borderRadius: 12, maxWidth: 360, maxHeight: '85vh', overflow: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0, marginBottom: 12 }}>Категории карточек</h3>
            <p style={{ fontSize: 13, opacity: 0.9, marginBottom: 16 }}>
              Можно снять все наборы и выбрать заново. Нажмите «Готово» — если ничего не выбрано, появится предупреждение (нужна хотя бы одна категория).
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
              {TD_CATEGORIES.map((c) => {
                const lockedByPro = c.premium && !hasCategoryPackAccess(c);
                const lockedBySafe = tdSafeMode && !c.safe;
                const lockedBy18 = c.is18Plus && !tdShow18Plus;
                const locked = lockedByPro || lockedBySafe || lockedBy18;
                const draft = Array.isArray(tdCategoryDraft) ? tdCategoryDraft : tdCategorySlugs;
                const selected = draft.includes(c.slug);
                const handleClick = () => {
                  if (locked) return;
                  const cur = Array.isArray(tdCategoryDraft) ? tdCategoryDraft : tdCategorySlugs;
                  const next = selected ? cur.filter((x) => x !== c.slug) : [...cur, c.slug];
                  setTdCategoryDraft(next);
                  track('td_category_toggle', { category: c.slug, enabled: !selected, source: 'lobby_modal' });
                };
                return (
                  <div
                    key={c.slug}
                    role="button"
                    tabIndex={0}
                    onClick={handleClick}
                    onKeyDown={(e) => e.key === 'Enter' && handleClick()}
                    style={{
                      position: 'relative',
                      padding: 14,
                      borderRadius: 10,
                      background: selected ? 'rgba(58, 123, 213, 0.25)' : 'rgba(255,255,255,0.06)',
                      border: `2px solid ${selected ? 'var(--tg-theme-button-color, #3a7bd5)' : 'transparent'}`,
                      cursor: locked ? 'not-allowed' : 'pointer',
                      minHeight: 100,
                      opacity: locked ? 0.55 : 1,
                    }}
                    title={lockedByPro ? `Нужен Премиум или pack ${c.requiredItem || ''}` : lockedBy18 ? 'Включите 18+' : lockedBySafe ? 'Safe режим отключает эту категорию' : ''}
                  >
                    {lockedByPro && (
                      <div style={{ position: 'absolute', top: 6, right: 6, fontSize: 18, zIndex: 1 }} title="Только Премиум / pack">🔒</div>
                    )}
                    <div style={{ width: 40, height: 40, borderRadius: 8, background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, marginBottom: 8 }}>
                      {c.emoji || '📇'}
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4, lineHeight: 1.2 }}>{c.name}</div>
                    <div style={{ fontSize: 11, opacity: 0.85, lineHeight: 1.3 }}>{c.description}</div>
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button type="button" onClick={closeTdCategoryModal} style={{ ...btnStyleToggleMid, flex: 1 }}>
                Отмена
              </button>
              <button type="button" onClick={confirmTdCategoryDraft} style={{ ...btnStyle, flex: 1 }}>
                Готово
              </button>
            </div>
          </div>
        </div>
      )}

      {eliasDictModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, padding: 16 }} onClick={closeEliasDictModal}>
          <div style={{ background: 'var(--tg-theme-bg-color, #1a1a1a)', padding: 20, borderRadius: 12, maxWidth: 360, maxHeight: '85vh', overflow: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0, marginBottom: 16 }}>Выбор словарей</h3>
            <p style={{ fontSize: 13, opacity: 0.9, marginBottom: 16 }}>
              Можно временно снять все словари и выбрать другие. Нажмите «Готово» — если ничего не выбрано, появится предупреждение.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {(room?.availableEliasDictionaries || ['basic', 'animals']).map((id) => {
                const card = ELIAS_DICT_CARDS.find((c) => c.id === id) || { id, name: id, description: '', emoji: '📖', free: false };
                const draft = eliasDictDraft ?? (room?.gameSettings?.dictionaryIds || ['basic', 'animals', 'memes']);
                const selected = draft.includes(id);
                const toggle = () => {
                  const cur = Array.isArray(eliasDictDraft) ? eliasDictDraft : (room?.gameSettings?.dictionaryIds || ['basic', 'animals', 'memes']);
                  const next = selected ? cur.filter((x) => x !== id) : [...cur, id];
                  setEliasDictDraft(next);
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
                      <div style={{ fontWeight: 600, marginBottom: 4 }}>{card.name}{!card.free && <span style={{ fontSize: 11, marginLeft: 6, opacity: 0.8 }}>Премиум</span>}</div>
                      <div style={{ fontSize: 13, opacity: 0.85, lineHeight: 1.35 }}>{card.description}</div>
                    </div>
                    <div style={{ width: 22, height: 22, borderRadius: 6, border: `2px solid ${selected ? 'var(--tg-theme-button-color)' : '#666'}`, background: selected ? 'var(--tg-theme-button-color)' : 'transparent', flexShrink: 0 }} />
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button type="button" onClick={closeEliasDictModal} style={{ ...btnStyleToggleMid, flex: 1 }}>
                Отмена
              </button>
              <button type="button" onClick={confirmEliasDictDraft} style={{ ...btnStyle, flex: 1 }}>
                Готово
              </button>
            </div>
          </div>
        </div>
      )}

      {ELIAS_CUSTOM_DICT_UI_ENABLED && eliasCustomModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 11, padding: 16 }} onClick={() => setEliasCustomModalOpen(false)}>
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
