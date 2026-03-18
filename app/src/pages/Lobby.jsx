import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { getInventory } from '../inventory';
import { getAvatar } from '../displayName';

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
const MIN_PLAYERS = { mafia: 4, elias: 2 };
function minSpyPlayers(spyCount) {
  const n = Math.min(3, Math.max(1, parseInt(spyCount, 10) || 1));
  return n + 2;
}

const ELIAS_DICT_CARDS = [
  { id: 'basic', name: 'Базовый', description: 'Простые и понятные слова для любой компании.', emoji: '📦', free: true },
  { id: 'animals', name: 'Животные', description: 'Звери, птицы и рыбы — от домашних до экзотических.', emoji: '🦁', free: true },
  { id: 'movies', name: 'Кино', description: 'Жанры, награды, съёмки и всё про киноиндустрию.', emoji: '🎬', free: false },
  { id: 'science', name: 'Наука', description: 'Эксперименты, теории и научные понятия.', emoji: '🔬', free: false },
  { id: 'sport', name: 'Спорт', description: 'Турниры, команды, рекорды и спортивный сленг.', emoji: '⚽', free: false },
];

export default function Lobby({ room, roomId, user, onLeave, onRoomUpdate }) {
  const navigate = useNavigate();
  const isHost = room.players?.some((p) => p.id === String(user?.id) && p.isHost);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [timerEnabled, setTimerEnabled] = useState(room?.gameSettings?.timerEnabled ?? false);
  const [timerSeconds, setTimerSeconds] = useState(room?.gameSettings?.timerSeconds ?? 60);
  const [spyCount, setSpyCount] = useState(room?.gameSettings?.spyCount ?? 1);
  const [allSpiesChanceEnabled, setAllSpiesChanceEnabled] = useState(!!room?.gameSettings?.allSpiesChanceEnabled);
  const [dictionaryIds, setDictionaryIds] = useState(room?.gameSettings?.dictionaryIds ?? ['free']);
  const [editingName, setEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState(room?.name || 'Лобби');
  const [shareToast, setShareToast] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);
  const [mafiaExtendedPopup, setMafiaExtendedPopup] = useState(false);
  const [mafiaClassicPopup, setMafiaClassicPopup] = useState(false);
  const [spyDictLockPopup, setSpyDictLockPopup] = useState(null);
  const [minPlayersWarning, setMinPlayersWarning] = useState(null);
  const [eliasDictModalOpen, setEliasDictModalOpen] = useState(false);

  const roomName = room?.name || 'Лобби';
  const selectedGame = room?.selectedGame ?? null;
  const availableDictionaries = room?.availableDictionaries || ['free'];
  const roomHasPro = room?.players?.some((p) => p.hasPro) ?? false;

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

  const inviteToken = room?.inviteToken || sessionStorage.getItem('inviteToken');
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
    await api.post('/rooms/spy/start', {
      roomId,
      hostId: String(user?.id),
      timerEnabled,
      timerSeconds: timerEnabled ? timerSeconds : undefined,
      spyCount,
      allSpiesChanceEnabled,
      spiesSeeEachOther: !!room?.gameSettings?.spiesSeeEachOther,
      dictionaryIds: dictionaryIds?.length ? dictionaryIds : ['free'],
    });
    const { room: r } = await api.get(`/rooms/${roomId}`);
    onRoomUpdate(r);
    navigate('/spy');
  };

  const startMafia = async (opts) => {
    if (!isHost) return;
    const count = room?.players?.length ?? 0;
    if (count < MIN_PLAYERS.mafia) {
      setMinPlayersWarning(`Для игры в Мафию нужно минимум ${MIN_PLAYERS.mafia} игроков. Сейчас в лобби: ${count}.`);
      return;
    }
    const gs = room?.gameSettings || {};
    await api.post('/rooms/mafia/start', {
      roomId,
      hostId: String(user?.id),
      moderatorId: gs.hostSelection === 'choose' ? gs.moderatorId : undefined,
      extended: gs.extended ?? false,
      revealRoleOnDeath: gs.revealRoleOnDeath ?? true,
      mafiaCanSkipKill: gs.mafiaCanSkipKill ?? false,
      ...opts,
    });
    const { room: r } = await api.get(`/rooms/${roomId}`);
    onRoomUpdate(r);
    navigate('/mafia');
  };

  const startElias = async () => {
    if (!isHost) return;
    const count = room?.players?.length ?? 0;
    if (count < MIN_PLAYERS.elias) {
      setMinPlayersWarning(`Для игры в Элиас нужно минимум ${MIN_PLAYERS.elias} игроков. Сейчас в лобби: ${count}.`);
      return;
    }
    const gs = room?.gameSettings || {};
    const team1Ids = gs.eliasTeam1Ids;
    const team2Ids = gs.eliasTeam2Ids;
    const playingCount = (Array.isArray(team1Ids) ? team1Ids.length : 0) + (Array.isArray(team2Ids) ? team2Ids.length : 0);
    if (playingCount > 0 && playingCount < 2) {
      setMinPlayersWarning('В игре должно быть минимум 2 игрока. Добавьте игроков в команды или выберите «Авто».');
      return;
    }
    await api.post('/rooms/elias/start', {
      roomId,
      hostId: String(user?.id),
      timerSeconds: gs.timerSeconds ?? 60,
      scoreLimit: gs.scoreLimit ?? 10,
      dictionaryIds: gs.dictionaryIds?.length ? gs.dictionaryIds : ['basic', 'animals'],
      team1Ids: Array.isArray(team1Ids) && team1Ids.length > 0 ? team1Ids : undefined,
      team2Ids: Array.isArray(team2Ids) && team2Ids.length > 0 ? team2Ids : undefined,
    });
    const { room: r } = await api.get(`/rooms/${roomId}`);
    onRoomUpdate(r);
    navigate('/elias');
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
        setShareToast(true);
        setTimeout(() => setShareToast(false), 3000);
        return;
      } catch (_) {}
    }
    try {
      await navigator.clipboard.writeText(text);
      setShareToast(true);
      setTimeout(() => setShareToast(false), 2500);
    } catch (_) {
      setShareToast(true);
      setTimeout(() => setShareToast(false), 2500);
    }
  };

  return (
    <div style={{ padding: 24, maxWidth: 400, margin: '0 auto' }}>
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
          {shareToast && (
            <p style={{ marginTop: 8, color: '#8f8', fontSize: 14 }}>
              {window.Telegram?.WebApp ? 'Выберите чат или контакт для отправки' : 'Ссылка скопирована — вставьте в чат'}
            </p>
          )}
        </div>
      )}
      <ul style={{ listStyle: 'none', padding: 0, marginBottom: 8 }}>
        {(room.players || []).map((p) => (
          <li key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
              <div style={{ position: 'relative', flexShrink: 0 }}>
                {p.avatar_emoji ? (
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
                    {p.avatar_emoji}
                  </div>
                ) : p.photo_url ? (
                  <img src={p.photo_url} alt="" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--tg-theme-button-color, #3a7bd5)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 14 }}>
                    {(p.name || '?')[0]}
                  </div>
                )}
                {p.hasPro && !p.isHost && (
                  <span style={{ position: 'absolute', bottom: -2, right: -2, fontSize: 14 }} title="Про">👑</span>
                )}
              </div>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}{p.isHost ? ' (хост)' : ''}</span>
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
          </li>
        ))}
      </ul>

      {isHost && selectedGame === null && (
        <div style={{ ...settingsBox, marginTop: 24 }}>
          <p style={{ marginBottom: 12 }}>Выберите игру</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {[
              { id: 'spy', name: 'Шпион', available: true, minPlayers: 3 },
              { id: 'mafia', name: 'Мафия', available: true, minPlayers: MIN_PLAYERS.mafia },
              { id: 'bunker', name: 'Бункер', available: false, minPlayers: 0 },
              { id: 'elias', name: 'Элиас', available: true, minPlayers: MIN_PLAYERS.elias },
            ].map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => {
                  if (!g.available) return;
                  const base = g.id === 'spy' ? { timerEnabled: false, timerSeconds: 60, spyCount: 1, allSpiesChanceEnabled: false, dictionaryIds: ['free'] } : null;
                  const mafia = g.id === 'mafia' ? { extended: false, revealRoleOnDeath: true, mafiaCanSkipKill: false, hostSelection: 'random', theme: 'default' } : null;
                  const elias = g.id === 'elias' ? { timerSeconds: 60, scoreLimit: 10, dictionaryIds: ['basic', 'animals'], eliasTeam1Ids: [], eliasTeam2Ids: [] } : null;
                  patchLobbyGame({ selectedGame: g.id, gameSettings: base || mafia || elias || undefined });
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
                  <p style={{ marginBottom: 8 }}>Локации: базовый бесплатно, остальные — Про</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                    {(room?.allSpyDictionaryIds || Object.keys(DICT_NAMES)).map((id) => {
                      const available = availableDictionaries.includes(id);
                      const on = dictionaryIds.includes(id);
                      const name = DICT_NAMES[id] || id;
                      const handleClick = () => {
                        if (!available) {
                          setSpyDictLockPopup(id);
                          return;
                        }
                        const next = on ? dictionaryIds.filter((x) => x !== id) : [...dictionaryIds, id];
                        if (next.length === 0) return;
                        setDictionaryIds(next);
                        patchLobbyGame({ gameSettings: { ...room?.gameSettings, timerEnabled, timerSeconds, spyCount, allSpiesChanceEnabled, dictionaryIds: next } });
                      };
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={handleClick}
                          style={{ ...btnStyle, width: 'auto', padding: '8px 14px', background: on ? 'var(--tg-theme-button-color, #3a7bd5)' : '#444', opacity: available ? 1 : 0.85 }}
                          title={!available ? 'Только для Премиум' : ''}
                        >
                          {!available && <span style={{ marginRight: 4 }}>🔒</span>}
                          {name}
                        </button>
                      );
                    })}
                  </div>
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
              <p style={{ margin: '4px 0 0', fontSize: 12, opacity: 0.8 }}>Мин. {MIN_PLAYERS.mafia} игроков</p>
            </div>
          )}
          {isHost && (
            <div style={{ ...settingsBox }}>
              <p style={{ marginTop: 0, marginBottom: 8 }}>Режим <span style={{ fontSize: 12, opacity: 0.8 }}>(мин. {MIN_PLAYERS.mafia} игр.)</span></p>
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
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <input type="checkbox" checked={room?.gameSettings?.revealRoleOnDeath !== false} onChange={(e) => patchLobbyGame({ gameSettings: { ...room?.gameSettings, revealRoleOnDeath: e.target.checked } })} />
                <span>Показывать роль после смерти</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <input type="checkbox" checked={!!room?.gameSettings?.mafiaCanSkipKill} onChange={(e) => patchLobbyGame({ gameSettings: { ...room?.gameSettings, mafiaCanSkipKill: e.target.checked } })} />
                <span>Мафия может не убивать ночью</span>
              </label>
              <p style={{ marginBottom: 8 }}>Ведущий</p>
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                <button type="button" onClick={() => patchLobbyGame({ gameSettings: { ...room?.gameSettings, hostSelection: 'random', moderatorId: null } })} style={{ ...btnStyle, flex: 1, padding: 10, background: (room?.gameSettings?.hostSelection !== 'choose' ? 'var(--tg-theme-button-color, #3a7bd5)' : '#444') }}>Случайно</button>
                <button type="button" onClick={() => patchLobbyGame({ gameSettings: { ...room?.gameSettings, hostSelection: 'choose' } })} style={{ ...btnStyle, flex: 1, padding: 10, background: (room?.gameSettings?.hostSelection === 'choose' ? 'var(--tg-theme-button-color, #3a7bd5)' : '#444') }}>Выбрать</button>
              </div>
              {room?.gameSettings?.hostSelection === 'choose' && (
                <div style={{ marginBottom: 16 }}>
                  <p style={{ marginBottom: 6, fontSize: 14 }}>Кто ведущий?</p>
                  {(room?.players || []).map((p) => (
                    <button key={p.id} type="button" onClick={() => patchLobbyGame({ gameSettings: { ...room?.gameSettings, moderatorId: p.id } })} style={{ ...btnStyle, marginBottom: 6, padding: 8, background: room?.gameSettings?.moderatorId === p.id ? 'var(--tg-theme-button-color, #3a7bd5)' : '#444' }}>{p.name}</button>
                  ))}
                </div>
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
              {(room.gameSettings.eliasTeam1Ids?.length > 0 || room.gameSettings.eliasTeam2Ids?.length > 0) && (
                <p style={{ margin: '8px 0 0', fontSize: 13 }}>
                  Команды: {(room?.players || []).filter((pl) => room.gameSettings.eliasTeam1Ids?.includes(pl.id)).map((pl) => pl.name).join(', ') || '—'} / {(room?.players || []).filter((pl) => room.gameSettings.eliasTeam2Ids?.includes(pl.id)).map((pl) => pl.name).join(', ') || '—'}
                </p>
              )}
            </div>
          )}
          {isHost && (
            <div style={{ ...settingsBox }}>
              <p style={{ marginTop: 0, marginBottom: 8 }}>Таймер раунда (сек) <span style={{ fontSize: 12, opacity: 0.8 }}>(мин. {MIN_PLAYERS.elias} игр.)</span></p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                {[30, 60, 90, 120].map((sec) => (
                  <button key={sec} type="button" onClick={() => patchLobbyGame({ gameSettings: { ...room?.gameSettings, timerSeconds: sec } })} style={{ ...btnStyle, width: 'auto', padding: '8px 14px', background: (room?.gameSettings?.timerSeconds ?? 60) === sec ? 'var(--tg-theme-button-color, #3a7bd5)' : '#444' }}>{sec} сек</button>
                ))}
              </div>
              <p style={{ marginBottom: 8 }}>Победить при (очков)</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                {[5, 10, 15, 20].map((n) => (
                  <button key={n} type="button" onClick={() => patchLobbyGame({ gameSettings: { ...room?.gameSettings, scoreLimit: n } })} style={{ ...btnStyle, width: 'auto', padding: '8px 14px', background: (room?.gameSettings?.scoreLimit ?? 10) === n ? 'var(--tg-theme-button-color, #3a7bd5)' : '#444' }}>{n}</button>
                ))}
              </div>
              <p style={{ marginBottom: 8 }}>Словари</p>
              <button type="button" onClick={() => setEliasDictModalOpen(true)} style={{ ...btnStyle, marginBottom: 16, background: '#555' }}>
                Выбрать словари ({(room?.gameSettings?.dictionaryIds || ['basic', 'animals']).length})
              </button>
              <p style={{ marginBottom: 8 }}>Команды</p>
              <p style={{ fontSize: 12, opacity: 0.85, marginBottom: 10 }}>Назначьте игроков в команды до старта. Нечётное число: один может быть «Не играет».</p>
              <div style={{ marginBottom: 16 }}>
                {(room?.players || []).map((p) => {
                  const t1 = room?.gameSettings?.eliasTeam1Ids ?? [];
                  const t2 = room?.gameSettings?.eliasTeam2Ids ?? [];
                  const hasCustom = (t1?.length || 0) + (t2?.length || 0) > 0;
                  const n = (room?.players || []).length;
                  const def1 = (room?.players || []).slice(0, Math.ceil(n / 2)).map((x) => x.id);
                  const def2 = (room?.players || []).slice(Math.ceil(n / 2)).map((x) => x.id);
                  const team1Ids = hasCustom ? (t1 || []) : def1;
                  const team2Ids = hasCustom ? (t2 || []) : def2;
                  const in1 = team1Ids.includes(p.id);
                  const in2 = team2Ids.includes(p.id);
                  const setTeam = (team) => {
                    const new1 = team === 1 ? [...team1Ids.filter((id) => id !== p.id), p.id] : team1Ids.filter((id) => id !== p.id);
                    const new2 = team === 2 ? [...team2Ids.filter((id) => id !== p.id), p.id] : team2Ids.filter((id) => id !== p.id);
                    patchLobbyGame({ gameSettings: { ...room?.gameSettings, eliasTeam1Ids: new1, eliasTeam2Ids: new2 } });
                  };
                  return (
                    <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                      <span style={{ minWidth: 80 }}>{p.name}</span>
                      <button type="button" onClick={() => setTeam(1)} style={{ ...btnStyle, width: 'auto', padding: '6px 10px', fontSize: 12, background: in1 ? 'var(--tg-theme-button-color, #3a7bd5)' : '#444' }}>Команда 1</button>
                      <button type="button" onClick={() => setTeam(2)} style={{ ...btnStyle, width: 'auto', padding: '6px 10px', fontSize: 12, background: in2 ? 'var(--tg-theme-button-color, #3a7bd5)' : '#444' }}>Команда 2</button>
                      <button type="button" onClick={() => setTeam(0)} style={{ ...btnStyle, width: 'auto', padding: '6px 10px', fontSize: 12, background: !in1 && !in2 ? '#555' : '#333' }}>Не играет</button>
                    </div>
                  );
                })}
              </div>
              <button type="button" onClick={startElias} style={btnStyle}>Начать игру</button>
            </div>
          )}
        </>
      )}

      {isHost && selectedGame && selectedGame !== 'spy' && selectedGame !== 'mafia' && selectedGame !== 'elias' && (
        <div style={{ ...settingsBox, marginTop: 24 }}>
          <p style={{ marginBottom: 8 }}>Бункер — скоро</p>
          <button type="button" onClick={() => patchLobbyGame({ selectedGame: null })} style={btnStyle}>Выбрать другую игру</button>
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
        <button type="button" onClick={onLeave} style={{ ...btnStyle, marginTop: isHost && selectedGame ? 8 : 24, background: '#555' }}>
          Выйти
        </button>
      )}

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

      {shopOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, padding: 24 }}>
          <div style={{ background: 'var(--tg-theme-bg-color, #1a1a1a)', padding: 24, borderRadius: 12, maxWidth: 320, maxHeight: '80vh', overflow: 'auto' }}>
            <p style={{ marginBottom: 16 }}>Магазин — {selectedGame === 'spy' ? 'Шпион' : selectedGame === 'mafia' ? 'Мафия' : selectedGame === 'bunker' ? 'Бункер' : selectedGame === 'elias' ? 'Элиас' : 'игра'}</p>
            {selectedGame === 'spy' && (
              <>
                <p style={{ fontSize: 14, marginBottom: 12 }}>Словари Шпиона</p>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span>{DICT_NAMES.free}</span>
                    <span style={{ color: '#8f8' }}>Бесплатно</span>
                  </div>
                </div>
                {(room?.allSpyDictionaryIds || Object.keys(DICT_NAMES)).filter((id) => id !== 'free').map((id) => (
                  <div key={id} style={{ marginBottom: 12, padding: 12, background: 'rgba(255,255,255,0.06)', borderRadius: 8 }}>
                    <div style={{ marginBottom: 6 }}>🔒 {DICT_NAMES[id] || id}</div>
                    <p style={{ fontSize: 13, opacity: 0.85 }}>Только для подписки Про. Покупка отдельных словарей — скоро.</p>
                  </div>
                ))}
              </>
            )}
            {selectedGame && selectedGame !== 'spy' && (
              <p style={{ opacity: 0.8 }}>Дополнения для этой игры — скоро.</p>
            )}
            {!selectedGame && <p style={{ opacity: 0.8 }}>Выберите игру в лобби.</p>}
            <button type="button" onClick={() => setShopOpen(false)} style={{ ...btnStyle, marginTop: 16 }}>Закрыть</button>
          </div>
        </div>
      )}
    </div>
  );
}

const btnStyle = {
  padding: '12px 20px',
  fontSize: 16,
  borderRadius: 8,
  border: 'none',
  background: 'var(--tg-theme-button-color, #3a7bd5)',
  color: 'var(--tg-theme-button-text-color, #fff)',
  cursor: 'pointer',
  width: '100%',
};

const settingsBox = {
  padding: 16,
  marginBottom: 16,
  borderRadius: 8,
  background: 'rgba(255,255,255,0.06)',
};
