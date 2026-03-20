import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, getApiErrorMessage } from '../api';
import { track } from '../analytics';
import { getInventory } from '../inventory';
import { getAvatar } from '../displayName';
import ShopModal from '../components/ShopModal';
import BackArrow from '../components/BackArrow';
import { useToast } from '../components/ui/ToastProvider';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';

const BASE_URL = import.meta.env.VITE_BASE_URL || window.location.origin;
const BOT_USERNAME = import.meta.env.VITE_BOT_USERNAME || '';

const TIMER_OPTIONS = [
  { label: '1 мин', value: 60 },
  { label: '2 мин', value: 120 },
  { label: '3 мин', value: 180 },
  { label: '5 мин', value: 300 },
];

const SPY_COUNT_OPTIONS = [1, 2, 3];
const BUNKER_DEFAULT_PHASE_TIMERS = { intro: 15, reveals: 10, discussion: 25, voting: 25, tieBreak: 10, roundEvent: 15, final: 20 };
const BUNKER_SPEED_PRESETS = [
  { id: 'fast', label: 'Быстро', mult: 0.75 },
  { id: 'standard', label: 'Стандарт', mult: 1 },
  { id: 'long', label: 'Длинно', mult: 1.3 },
];
const BUNKER_ROUND_OPTIONS = [2, 3, 4];
const DICT_NAMES = {
  free: 'Базовый',
  theme1: 'Детектив (Про)',
  theme2: 'Пираты (Про)',
  travel: 'Путешествия (Про)',
  food: 'Еда (Про)',
  sports: 'Спорт (Про)',
  movies: 'Кино (Про)',
  music: 'Музыка (Про)',
  nature: 'Природа (Про)',
  science: 'Наука (Про)',
  history: 'История (Про)',
  art: 'Искусство (Про)',
  tech: 'Технологии (Про)',
};
const MIN_PLAYERS = { mafia: 4, elias: 2, truth_dare: 2, bunker: 4 };
function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}
function bunkerPhaseTimersFromSpeed(speedId) {
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
  { id: 'basic', name: 'Базовый', description: 'Простые и понятные слова для любой компании.', emoji: '📦', free: true },
  { id: 'animals', name: 'Животные', description: 'Звери, птицы и рыбы — от домашних до экзотических.', emoji: '🦁', free: true },
  { id: 'movies', name: 'Кино', description: 'Жанры, награды, съёмки и всё про киноиндустрию.', emoji: '🎬', free: false },
  { id: 'science', name: 'Наука', description: 'Эксперименты, теории и научные понятия.', emoji: '🔬', free: false },
  { id: 'sport', name: 'Спорт', description: 'Турниры, команды, рекорды и спортивный сленг.', emoji: '⚽', free: false },
];

const TD_CATEGORIES = [
  { slug: 'classic_truth', name: 'Классика — правда', premium: false, is18Plus: false, safe: true },
  { slug: 'classic_dare', name: 'Классика — действие', premium: false, is18Plus: false, safe: true },
  { slug: 'friends_truth', name: 'Друзья — правда', premium: false, is18Plus: false, safe: true },
  { slug: 'friends_dare', name: 'Друзья — действие', premium: false, is18Plus: false, safe: true },
  { slug: '18_truth', name: '18+ — правда', premium: false, is18Plus: true, safe: false },
  { slug: '18_dare', name: '18+ — действие', premium: false, is18Plus: true, safe: false },
  { slug: 'drunk_truth', name: 'Пьяное — правда (Про)', premium: true, is18Plus: false, safe: false },
  { slug: 'drunk_dare', name: 'Пьяное — действие (Про)', premium: true, is18Plus: false, safe: false },
];

export default function Lobby({ room, roomId, user, onLeave, onRoomUpdate }) {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const isHost = room.players?.some((p) => p.id === String(user?.id) && p.isHost);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [startingGame, setStartingGame] = useState(false);
  const [mafiaAccordions, setMafiaAccordions] = useState({ mode: true, rules: true, host: true });
  const [eliasAccordions, setEliasAccordions] = useState({ timer: true, goal: true, dicts: false, teams: false });
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
  const [minPlayersWarning, setMinPlayersWarning] = useState(null);
  const [eliasDictModalOpen, setEliasDictModalOpen] = useState(false);
  const [gamesPickerOpen, setGamesPickerOpen] = useState(false);
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);

  const roomName = room?.name || 'Лобби';
  const selectedGame = room?.selectedGame ?? null;
  const availableDictionaries = room?.availableDictionaries || ['free'];
  const roomHasPro = room?.players?.some((p) => p.hasPro) ?? false;

  const tdGameSettings = room?.gameSettings || {};
  const tdMode = tdGameSettings.mode ?? 'mixed';
  const tdSafeMode = tdGameSettings.safeMode !== false;
  const tdShow18Plus = Boolean(tdGameSettings.show18Plus);
  const tdRoundsCount = tdGameSettings.roundsCount ?? 5;
  const tdCategorySlugs = Array.isArray(tdGameSettings.categorySlugs) && tdGameSettings.categorySlugs.length
    ? tdGameSettings.categorySlugs
    : ['classic_truth', 'classic_dare'];

  useEffect(() => {
    setEditNameValue(roomName);
  }, [roomName]);

  useEffect(() => {
    setTimerEnabled(room?.gameSettings?.timerEnabled ?? false);
    setTimerSeconds(room?.gameSettings?.timerSeconds ?? 60);
    setSpyCount(room?.gameSettings?.spyCount ?? 1);
    setAllSpiesChanceEnabled(!!room?.gameSettings?.allSpiesChanceEnabled);
    setDictionaryIds(room?.gameSettings?.dictionaryIds ?? ['free']);
  }, [room?.gameSettings]);

  useEffect(() => {
    const inv = getInventory();
    const avatarEmoji = getAvatar();
    api.patch(`/rooms/${roomId}/players/me`, {
      playerId: String(user?.id),
      inventory: { dictionaries: inv.dictionaries, hasPro: inv.hasPro },
      photo_url: user?.photo_url || null,
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
  const miniAppLink = BOT_USERNAME && inviteToken ? `https://t.me/${BOT_USERNAME}?start=${inviteToken}` : '';
  const webLink = inviteToken ? `${BASE_URL}?invite=${inviteToken}` : '';
  const inviteLink = miniAppLink || webLink || '';

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
      dictionaryIds: gs.dictionaryIds?.length ? gs.dictionaryIds : ['basic', 'animals'],
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
        categorySlugs: Array.isArray(gs.categorySlugs) && gs.categorySlugs.length ? gs.categorySlugs : ['classic_truth', 'classic_dare'],
        show18Plus: !!gs.show18Plus,
        safeMode: gs.safeMode !== false,
        roundsCount: gs.roundsCount ?? 5,
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

  const getMinPlayersForSelectedGame = () => {
    if (!selectedGame) return 0;
    if (selectedGame === 'spy') return minSpyPlayers(spyCount);
    if (selectedGame === 'mafia') return MIN_PLAYERS.mafia;
    if (selectedGame === 'elias') return MIN_PLAYERS.elias;
    if (selectedGame === 'bunker') return MIN_PLAYERS.bunker;
    if (selectedGame === 'truth_dare') return MIN_PLAYERS.truth_dare;
    return 0;
  };

  const getHostTips = () => {
    if (!isHost || !selectedGame || startingGame) return null;
    const count = room?.players?.length ?? 0;
    const min = getMinPlayersForSelectedGame();
    const gs = room?.gameSettings || {};

    if (selectedGame === 'elias' && Array.isArray(gs.eliasTeams) && gs.eliasTeams.length >= 2) {
      const totalPlaying = gs.eliasTeams.reduce((sum, t) => sum + (t.playerIds?.length || 0), 0);
      const teamsWithPlayers = gs.eliasTeams.filter((t) => (t.playerIds || []).length > 0).length;
      if (totalPlaying > 0 && totalPlaying < 2) {
        return `Для Элиаса в командах должно быть минимум 2 игрока. Сейчас в командах: ${totalPlaying}.`;
      }
      if (totalPlaying >= 2 && teamsWithPlayers < 2) {
        return 'Элиас стартует только если игроки распределены минимум в двух разных командах.';
      }
    }

    if (min > 0 && count < min) {
      if (selectedGame === 'spy') {
        return `Нужно минимум ${min} игроков для Шпиона (сейчас: ${count}).`;
      }
      if (selectedGame === 'mafia') {
        return `Нужно минимум ${MIN_PLAYERS.mafia} игроков для Мафии (сейчас: ${count}).`;
      }
      if (selectedGame === 'elias') {
        return `Нужно минимум ${MIN_PLAYERS.elias} игроков для Элиаса (сейчас: ${count}).`;
      }
      return `Нужно минимум ${min} игроков для этой игры (сейчас: ${count}).`;
    }

    return null;
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
    const lines = [`GameHub — присоединиться к лобби: ${roomName}`, ''];
    if (miniAppLink) lines.push('Открыть в приложении (Telegram):', miniAppLink, '');
    if (webLink) lines.push(miniAppLink ? 'Или в браузере:' : 'Ссылка:', webLink);
    const text = lines.join('\n');
    const tg = window.Telegram?.WebApp;
    if (tg?.openTelegramLink) {
      try {
        const shareUrl = miniAppLink || webLink;
        tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent('GameHub — присоединиться к лобби: ' + roomName + (miniAppLink && webLink ? '\n\nВ приложении: ' + miniAppLink + '\nВ браузере: ' + webLink : '\n\n' + shareUrl))}`);
        showToast({ type: 'info', message: 'Выберите чат для отправки' });
        return;
      } catch (_) {}
    }
    try {
      await navigator.clipboard.writeText(text);
      showToast({ type: 'success', message: 'Ссылка скопирована — вставьте в чат' });
    } catch (_) {
      showToast({ type: 'error', message: 'Не удалось скопировать ссылку' });
    }
  };

  const handleBack = () => {
    if (selectedGame) patchLobbyGame({ selectedGame: null });
    else setLeaveConfirmOpen(true);
  };
  const confirmLeaveLobby = () => {
    setLeaveConfirmOpen(false);
    onLeave();
  };

  const playersList = room.players || [];
  const onlineCount = playersList.filter((p) => p.online !== false).length;

  return (
    <div className="gh-page">
      <BackArrow onClick={handleBack} title={selectedGame ? 'Назад к выбору игры' : 'Выйти'} />
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

      <p>Код комнаты: <strong>{room.code}</strong></p>
      <p style={{ fontSize: 14, opacity: 0.88, marginTop: 4, marginBottom: 12 }}>
        Онлайн: <strong>{onlineCount}</strong> / {playersList.length}
      </p>
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
            style={{ ...btnStyle, marginTop: 8, background: '#6a5' }}
          >
            Поделиться
          </button>
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 8 }}>
        {playersList.map((p) => (
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
                  <span style={{ position: 'absolute', bottom: -3, right: -3, fontSize: 14 }} title="Про">👑</span>
                )}
              </div>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {p.name}
                {p.isHost ? ' (хост)' : ''}
                {p.online === false ? (
                  <span style={{ fontSize: 12, marginLeft: 6, opacity: 0.65, fontWeight: 600 }}>(офлайн)</span>
                ) : null}
              </span>
            </div>
            {isHost && p.id !== String(user?.id) && !p.isHost && (
              <button
                type="button"
                onClick={async () => {
                  try {
                    await api.post(`/rooms/${roomId}/kick`, { hostId: String(user?.id), playerIdToKick: p.id });
                  } catch (_) {}
                }}
                style={{ ...btnStyle, width: 'auto', padding: '6px 12px', margin: 0, fontSize: 14, background: '#a44', flexShrink: 0 }}
              >
                Кик
              </button>
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

      {selectedGame && (
        <div className="gh-card" style={{ padding: 12, marginBottom: 16 }}>
          <p style={{ margin: 0, fontWeight: 800, marginBottom: 6, opacity: 0.95 }}>Статус</p>
          {startingGame ? (
            <p style={{ margin: 0, opacity: 0.9, lineHeight: 1.4, fontSize: 14 }}>Старт идёт...</p>
          ) : (
            (() => {
              const min = getMinPlayersForSelectedGame();
              const count = room?.players?.length ?? 0;
              const ready = min > 0 ? count >= min : true;
              if (!isHost) {
                return (
                  <p style={{ margin: 0, opacity: 0.9, lineHeight: 1.4, fontSize: 14 }}>
                    {ready ? 'Готово: ждём запуска хостом' : 'Ждём игроков'}
                  </p>
                );
              }
              return (
                <p style={{ margin: 0, opacity: 0.9, lineHeight: 1.4, fontSize: 14 }}>
                  {ready ? 'Готово: можно стартовать' : `Ждём игроков (${count}/${min})`}
                </p>
              );
            })()
          )}
        </div>
      )}

      {getHostTips() && (
        <div className="gh-card" style={{ padding: 12, marginBottom: 16, borderColor: 'rgba(255, 220, 80, 0.35)' }}>
          <p style={{ margin: 0, fontWeight: 800, marginBottom: 6, opacity: 0.95, color: '#fd8' }}>Подсказка хосту</p>
          <p style={{ margin: 0, opacity: 0.9, lineHeight: 1.4, fontSize: 14 }}>{getHostTips()}</p>
        </div>
      )}

      {isHost && selectedGame === null && (
        <div style={{ ...settingsBox, marginTop: 24 }}>
          <button
            type="button"
            onClick={() => setGamesPickerOpen((v) => !v)}
            style={{ ...btnStyle, width: '100%', marginBottom: 12, background: gamesPickerOpen ? '#555' : '#444' }}
          >
            {gamesPickerOpen ? 'Скрыть выбор игр' : 'Выбор игр'}
          </button>

          {gamesPickerOpen && (
            <>
              <p style={{ marginBottom: 12 }}>Выберите игру</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[
                  { id: 'spy', name: 'Шпион', available: true, minPlayers: 3 },
                  { id: 'mafia', name: 'Мафия', available: true, minPlayers: MIN_PLAYERS.mafia },
                  { id: 'bunker', name: 'Бункер', available: true, minPlayers: MIN_PLAYERS.bunker },
                  { id: 'elias', name: 'Элиас', available: true, minPlayers: MIN_PLAYERS.elias },
                  { id: 'truth_dare', name: 'Правда или действие', available: true, minPlayers: MIN_PLAYERS.truth_dare },
                ].map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => {
                      if (!g.available) return;
                      const base = g.id === 'spy' ? { timerEnabled: false, timerSeconds: 60, spyCount: 1, allSpiesChanceEnabled: false, spiesSeeEachOther: false, showLocationsList: false, dictionaryIds: ['free'] } : null;
                      const mafia = g.id === 'mafia' ? { extended: false, revealRoleOnDeath: true, mafiaCanSkipKill: false, hostSelection: 'random', theme: 'default', phaseTimers: { nightMafia: 45, nightCommissioner: 25, day: 90, voting: 45 } } : null;
                      const elias = g.id === 'elias' ? { timerSeconds: 60, scoreLimit: 10, dictionaryIds: ['basic', 'animals'], eliasTeams: [{ name: 'Команда 1', playerIds: [] }, { name: 'Команда 2', playerIds: [] }] } : null;
                      const truthDare = g.id === 'truth_dare' ? { mode: 'mixed', show18Plus: false, safeMode: true, roundsCount: 5, categorySlugs: ['classic_truth', 'classic_dare'] } : null;
                      const bunker = g.id === 'bunker' ? { maxRounds: 3, phaseSpeed: 'standard', phaseTimers: bunkerPhaseTimersFromSpeed('standard') } : null;
                      patchLobbyGame({ selectedGame: g.id, gameSettings: base || mafia || elias || truthDare || bunker || undefined });
                    }}
                    style={{
                      ...btnStyle,
                      padding: 20,
                      background: g.available ? 'var(--tg-theme-button-color, #3a7bd5)' : '#333',
                      opacity: g.available ? 1 : 0.8,
                    }}
                  >
                    {g.name}
                    {g.available && g.minPlayers > 0 && <span style={{ display: 'block', fontSize: 11, marginTop: 4, opacity: 0.9 }}>мин. {g.minPlayers} игр.</span>}
                    {!g.available && <span style={{ display: 'block', fontSize: 12, marginTop: 4 }}>Скоро</span>}
                  </button>
                ))}
              </div>
            </>
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
                  style={{ ...btnStyle, background: '#555', flex: 1 }}
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
                          title={!enabled ? 'Нужна подписка Про' : ''}
                          onClick={() => {
                            if (!enabled) return;
                            setSpyCount(n);
                            patchLobbyGame({ gameSettings: { ...room?.gameSettings, timerEnabled, timerSeconds, spyCount: n, allSpiesChanceEnabled, dictionaryIds } });
                          }}
                          style={{
                            ...btnStyle,
                            width: 'auto',
                            padding: '8px 14px',
                            background: on ? 'var(--tg-theme-button-color, #3a7bd5)' : '#444',
                            opacity: enabled ? 1 : 0.6,
                          }}
                        >
                          {n}{n > 1 && <span style={{ fontSize: 10, marginLeft: 4 }}>Про</span>}
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
                  <button type="button" onClick={() => setSpyLocationsModalOpen(true)} style={{ ...btnStyle, marginBottom: 16, background: '#555' }}>
                    Локации (выбрано: {dictionaryIds.length})
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
                              ...btnStyle,
                              width: 'auto',
                              padding: '8px 14px',
                              background: timerSeconds === opt.value ? 'var(--tg-theme-button-color, #3a7bd5)' : '#444',
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
              <p style={{ margin: 0, fontSize: 14 }}>Режим: {room.gameSettings.extended ? 'Расширенный (Про)' : 'Классика'}</p>
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
                style={{ ...btnStyle, width: '100%', background: mafiaAccordions.mode ? '#555' : '#444', marginBottom: 12 }}
              >
                Режим <span style={{ fontSize: 12, opacity: 0.8 }}>(мин. {MIN_PLAYERS.mafia} игр.)</span>
              </button>
              {mafiaAccordions.mode && (
                <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                  <button
                    type="button"
                    onClick={() => { setMafiaClassicPopup(true); if (room?.gameSettings?.extended) patchLobbyGame({ gameSettings: { ...room?.gameSettings, extended: false } }); }}
                    style={{ ...btnStyle, flex: 1, padding: 10, background: (room?.gameSettings?.extended ? '#444' : 'var(--tg-theme-button-color, #3a7bd5)') }}
                    title="Какие роли в игре"
                  >
                    Классика
                  </button>
                  <button
                    type="button"
                    onClick={() => { setMafiaExtendedPopup(true); if (roomHasPro && !room?.gameSettings?.extended) patchLobbyGame({ gameSettings: { ...room?.gameSettings, extended: true } }); }}
                    style={{ ...btnStyle, flex: 1, padding: 10, background: (room?.gameSettings?.extended ? 'var(--tg-theme-button-color, #3a7bd5)' : '#444'), opacity: roomHasPro ? 1 : 0.6 }}
                    title="Подробнее об расширенной версии"
                  >
                    Расширенная (Про)
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={() => setMafiaAccordions((s) => ({ ...s, rules: !s.rules }))}
                style={{ ...btnStyle, width: '100%', background: mafiaAccordions.rules ? '#555' : '#444', marginBottom: 12 }}
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
                          style={{ ...btnStyle, flex: 1, padding: 10, background: active ? 'var(--tg-theme-button-color, #3a7bd5)' : '#444' }}
                        >
                          {p.label}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

              <button
                type="button"
                onClick={() => setMafiaAccordions((s) => ({ ...s, host: !s.host }))}
                style={{ ...btnStyle, width: '100%', background: mafiaAccordions.host ? '#555' : '#444', marginBottom: 12 }}
              >
                Ведущий
              </button>
              {mafiaAccordions.host && (
                <>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                    <button
                      type="button"
                      onClick={() => patchLobbyGame({ gameSettings: { ...room?.gameSettings, hostSelection: 'random', moderatorId: null } })}
                      style={{ ...btnStyle, flex: 1, padding: 10, background: (room?.gameSettings?.hostSelection !== 'choose' ? 'var(--tg-theme-button-color, #3a7bd5)' : '#444') }}
                    >
                      Случайно
                    </button>
                    <button
                      type="button"
                      onClick={() => patchLobbyGame({ gameSettings: { ...room?.gameSettings, hostSelection: 'choose' } })}
                      style={{ ...btnStyle, flex: 1, padding: 10, background: (room?.gameSettings?.hostSelection === 'choose' ? 'var(--tg-theme-button-color, #3a7bd5)' : '#444') }}
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
                          style={{ ...btnStyle, marginBottom: 6, padding: 8, background: room?.gameSettings?.moderatorId === p.id ? 'var(--tg-theme-button-color, #3a7bd5)' : '#444' }}
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
                style={{ ...btnStyle, width: '100%', background: eliasAccordions.timer ? '#555' : '#444', marginBottom: 12 }}
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
                      style={{ ...btnStyle, width: 'auto', padding: '8px 14px', background: (room?.gameSettings?.timerSeconds ?? 60) === sec ? 'var(--tg-theme-button-color, #3a7bd5)' : '#444' }}
                    >
                      {sec} сек
                    </button>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={() => setEliasAccordions((s) => ({ ...s, goal: !s.goal }))}
                style={{ ...btnStyle, width: '100%', background: eliasAccordions.goal ? '#555' : '#444', marginBottom: 12 }}
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
                      style={{ ...btnStyle, width: 'auto', padding: '8px 14px', background: (room?.gameSettings?.scoreLimit ?? 10) === n ? 'var(--tg-theme-button-color, #3a7bd5)' : '#444' }}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={() => setEliasAccordions((s) => ({ ...s, dicts: !s.dicts }))}
                style={{ ...btnStyle, width: '100%', background: eliasAccordions.dicts ? '#555' : '#444', marginBottom: 12 }}
              >
                Словари
              </button>
              {eliasAccordions.dicts && (
                <div style={{ marginBottom: 16 }}>
                  <button type="button" onClick={() => setEliasDictModalOpen(true)} style={{ ...btnStyle, background: '#555' }}>
                    Выбрать словари ({(room?.gameSettings?.dictionaryIds || ['basic', 'animals']).length})
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={() => setEliasAccordions((s) => ({ ...s, teams: !s.teams }))}
                style={{ ...btnStyle, width: '100%', background: eliasAccordions.teams ? '#555' : '#444', marginBottom: 12 }}
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
                      style={{ ...btnStyle, width: 'auto', padding: '6px 12px', fontSize: 13, background: '#555' }}
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
                        style={{ ...btnStyle, width: 'auto', padding: '6px 12px', fontSize: 13, background: '#633' }}
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
                              style={{ ...btnStyle, width: 'auto', padding: '6px 8px', fontSize: 11, background: playerTeamIndex === i ? 'var(--tg-theme-button-color, #3a7bd5)' : '#444' }}
                            >
                              {t.name}
                            </button>
                          ))}
                          <button
                            type="button"
                            onClick={() => setTeam(-1)}
                            style={{ ...btnStyle, width: 'auto', padding: '6px 8px', fontSize: 11, background: playerTeamIndex === -1 ? '#555' : '#333' }}
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
              <p style={{ margin: 0, fontSize: 14 }}>
                Режим:{' '}
                {tdMode === 'mixed' ? 'смешанный' : tdMode === 'truth' ? 'только правда' : 'только действие'}
              </p>
              <p style={{ margin: '4px 0 0', fontSize: 14 }}>Safe: {tdSafeMode ? 'да' : 'нет'}</p>
              <p style={{ margin: '4px 0 0', fontSize: 14 }}>
                18+: {tdSafeMode ? 'нет (safe)' : tdShow18Plus ? 'да' : 'нет'}
              </p>
              <p style={{ margin: '4px 0 0', fontSize: 14 }}>Раундов: {tdRoundsCount}</p>
              <p style={{ margin: '4px 0 0', fontSize: 12, opacity: 0.8 }}>Мин. {MIN_PLAYERS.truth_dare} игроков</p>
            </div>
          )}

          {isHost && (
            <div style={{ ...settingsBox }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                {[
                  { id: 'truth', label: 'Правда' },
                  { id: 'dare', label: 'Действие' },
                  { id: 'mixed', label: 'Смешанный' },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => patchLobbyGame({ gameSettings: { ...room?.gameSettings, mode: opt.id } })}
                    style={{ ...btnStyle, flex: 1, padding: 10, background: tdMode === opt.id ? 'var(--tg-theme-button-color, #3a7bd5)' : '#444', fontSize: 14 }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

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
                        categorySlugs: nextCats.length ? nextCats : ['classic_truth', 'classic_dare'],
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
                        categorySlugs: nextCats.length ? nextCats : ['classic_truth', 'classic_dare'],
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
                    style={{ ...btnStyle, flex: 1, padding: 10, background: tdRoundsCount === n ? 'var(--tg-theme-button-color, #3a7bd5)' : '#444', fontSize: 14 }}
                  >
                    {n}
                  </button>
                ))}
              </div>

              <p style={{ marginBottom: 8, fontSize: 14 }}>Категории</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                {TD_CATEGORIES.map((c) => {
                  const lockedByPro = c.premium && !roomHasPro;
                  const lockedBySafe = tdSafeMode && !c.safe;
                  const lockedBy18 = c.is18Plus && !tdShow18Plus;
                  const locked = lockedByPro || lockedBySafe || lockedBy18;
                  const active = tdCategorySlugs.includes(c.slug);
                  return (
                    <button
                      key={c.slug}
                      type="button"
                      disabled={locked}
                      onClick={() => {
                        const isActive = tdCategorySlugs.includes(c.slug);
                        let next = isActive ? tdCategorySlugs.filter((x) => x !== c.slug) : [...tdCategorySlugs, c.slug];
                        if (next.length === 0) next = ['classic_truth', 'classic_dare'];
                        patchLobbyGame({ gameSettings: { ...room?.gameSettings, categorySlugs: next } });
                      }}
                      style={{
                        ...btnStyle,
                        width: 'auto',
                        padding: '10px 10px',
                        fontSize: 12,
                        background: active ? 'var(--tg-theme-button-color, #3a7bd5)' : '#444',
                        opacity: locked ? 0.6 : 1,
                      }}
                      title={lockedByPro ? 'Нужен Про' : lockedBy18 ? 'Включите 18+' : lockedBySafe ? 'Safe режим отключает эту категорию' : ''}
                    >
                      {c.name}
                    </button>
                  );
                })}
              </div>

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
                    ...btnStyle,
                    width: 'auto',
                    padding: '8px 14px',
                    background: active ? 'var(--tg-theme-button-color, #3a7bd5)' : '#444',
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
                    ...btnStyle,
                    width: 'auto',
                    padding: '8px 14px',
                    background: active ? 'var(--tg-theme-button-color, #3a7bd5)' : '#444',
                    opacity: startingGame ? 0.7 : 1,
                  }}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          <button type="button" onClick={startBunker} disabled={startingGame} style={btnStyle}>
            {startingGame ? 'Запуск...' : 'Начать игру'}
          </button>
        </div>
      )}

      <button type="button" onClick={() => setShopOpen(true)} style={{ ...btnStyle, marginTop: 16, background: '#55a' }}>
        Магазин
      </button>

      {isHost && selectedGame ? (
        <button type="button" onClick={() => patchLobbyGame({ selectedGame: null })} style={{ ...btnStyle, marginTop: 24, background: '#555' }}>
          Назад
        </button>
      ) : null}
      {(!isHost || !selectedGame) && (
        <button type="button" onClick={() => setLeaveConfirmOpen(true)} style={{ ...btnStyle, marginTop: isHost && selectedGame ? 8 : 24, background: '#555' }}>
          Выйти из комнаты
        </button>
      )}

      <Modal open={leaveConfirmOpen} onClose={() => setLeaveConfirmOpen(false)} title="Выйти из комнаты?" width={400}>
        <p style={{ marginTop: 0, lineHeight: 1.5, opacity: 0.92 }}>Вы покинете лобби. Приглашение можно будет использовать снова, если комната ещё активна.</p>
        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <Button variant="secondary" fullWidth onClick={() => setLeaveConfirmOpen(false)}>
            Остаться
          </Button>
          <Button variant="danger" fullWidth onClick={confirmLeaveLobby}>
            Выйти
          </Button>
        </div>
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
            <p style={{ marginBottom: 0, fontSize: 13, opacity: 0.9 }}>Доступно по подписке Про.</p>
            <button type="button" onClick={() => setMafiaExtendedPopup(false)} style={{ ...btnStyle, marginTop: 16 }}>Понятно</button>
          </div>
        </div>
      )}

      {spyLocationsModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, padding: 16 }} onClick={() => setSpyLocationsModalOpen(false)}>
          <div style={{ background: 'var(--tg-theme-bg-color, #1a1a1a)', padding: 20, borderRadius: 12, maxWidth: 360, maxHeight: '85vh', overflow: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0, marginBottom: 12 }}>Локации</h3>
            <p style={{ fontSize: 13, opacity: 0.9, marginBottom: 16 }}>Выберите один или несколько наборов. Хотя бы один должен быть включён.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
              {(room?.allSpyDictionaryIds || Object.keys(DICT_NAMES)).map((id) => {
                const card = SPY_DICT_CARDS.find((c) => c.id === id) || { id, name: DICT_NAMES[id] || id, description: '', emoji: '📍', free: id === 'free' };
                const available = availableDictionaries.includes(id);
                const selected = dictionaryIds.includes(id);
                const handleClick = () => {
                  if (!available) { setSpyLocationsModalOpen(false); setSpyDictLockPopup(id); return; }
                  const next = selected ? dictionaryIds.filter((x) => x !== id) : [...dictionaryIds, id];
                  if (next.length === 0) return;
                  setDictionaryIds(next);
                  patchLobbyGame({ gameSettings: { ...room?.gameSettings, timerEnabled, timerSeconds, spyCount, allSpiesChanceEnabled, dictionaryIds: next } });
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
                      <div style={{ position: 'absolute', top: 6, right: 6, fontSize: 18, zIndex: 1 }} title="Только Про">🔒</div>
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
            <button type="button" onClick={() => setSpyLocationsModalOpen(false)} style={{ ...btnStyle, marginTop: 16 }}>Готово</button>
          </div>
        </div>
      )}

      {spyDictLockPopup && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, padding: 24 }}>
          <div style={{ background: 'var(--tg-theme-bg-color, #1a1a1a)', padding: 24, borderRadius: 12, maxWidth: 320 }}>
            <p style={{ marginBottom: 8 }}>🔒 {DICT_NAMES[spyDictLockPopup] || spyDictLockPopup}</p>
            <p style={{ fontSize: 14, opacity: 0.9, marginBottom: 16 }}>Этот словарь доступен только по подписке Про. Покупка отдельных словарей пока не реализована — оформите Премиум, чтобы открыть все тематические локации.</p>
            <button type="button" onClick={() => setSpyDictLockPopup(null)} style={btnStyle}>Понятно</button>
          </div>
        </div>
      )}

      {minPlayersWarning && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, padding: 24 }}>
          <div style={{ background: 'var(--tg-theme-bg-color, #1a1a1a)', padding: 24, borderRadius: 12, maxWidth: 320 }}>
            <p style={{ marginBottom: 16 }}>{minPlayersWarning}</p>
            <button type="button" onClick={() => setMinPlayersWarning(null)} style={btnStyle}>Ок</button>
          </div>
        </div>
      )}

      {eliasDictModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, padding: 16 }} onClick={() => setEliasDictModalOpen(false)}>
          <div style={{ background: 'var(--tg-theme-bg-color, #1a1a1a)', padding: 20, borderRadius: 12, maxWidth: 360, maxHeight: '85vh', overflow: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0, marginBottom: 16 }}>Выбор словарей</h3>
            <p style={{ fontSize: 13, opacity: 0.9, marginBottom: 16 }}>Выберите один или несколько. Хотя бы один должен быть включён.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {(room?.availableEliasDictionaries || ['basic', 'animals']).map((id) => {
                const card = ELIAS_DICT_CARDS.find((c) => c.id === id) || { id, name: id, description: '', emoji: '📖', free: false };
                const selected = (room?.gameSettings?.dictionaryIds || ['basic', 'animals']).includes(id);
                const toggle = () => {
                  const cur = room?.gameSettings?.dictionaryIds || ['basic', 'animals'];
                  const next = selected ? cur.filter((x) => x !== id) : [...cur, id];
                  if (next.length) patchLobbyGame({ gameSettings: { ...room?.gameSettings, dictionaryIds: next } });
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
                      <div style={{ fontWeight: 600, marginBottom: 4 }}>{card.name}{!card.free && <span style={{ fontSize: 11, marginLeft: 6, opacity: 0.8 }}>Про</span>}</div>
                      <div style={{ fontSize: 13, opacity: 0.85, lineHeight: 1.35 }}>{card.description}</div>
                    </div>
                    <div style={{ width: 22, height: 22, borderRadius: 6, border: `2px solid ${selected ? 'var(--tg-theme-button-color)' : '#666'}`, background: selected ? 'var(--tg-theme-button-color)' : 'transparent', flexShrink: 0 }} />
                  </div>
                );
              })}
            </div>
            <button type="button" onClick={() => setEliasDictModalOpen(false)} style={{ ...btnStyle, marginTop: 16 }}>Готово</button>
          </div>
        </div>
      )}

      <ShopModal open={shopOpen} onClose={() => setShopOpen(false)} initialGameFilter={selectedGame || 'all'} />
    </div>
  );
}

const btnStyle = {
  padding: '12px 20px',
  fontSize: 16,
  borderRadius: 10,
  border: 'none',
  background: 'var(--tg-theme-button-color, #3a7bd5)',
  color: 'var(--tg-theme-button-text-color, #fff)',
  cursor: 'pointer',
  width: '100%',
  boxShadow: '0 6px 18px rgba(0,0,0,0.2)',
  fontWeight: 600,
};

const settingsBox = {
  padding: 16,
  marginBottom: 16,
  borderRadius: 12,
  background: 'var(--gh-surface, rgba(255,255,255,0.06))',
  border: '1px solid var(--gh-border, rgba(255,255,255,0.12))',
  boxShadow: 'var(--gh-shadow, 0 10px 30px rgba(0,0,0,0.28))',
};
