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

const SPY_MODES = [
  { id: 'classic', label: '1 шпион', free: true },
  { id: 'all_spies', label: 'Все шпионы (редко)', free: true },
  { id: 'two', label: '2 шпиона', free: false },
  { id: 'three', label: '3 шпиона', free: false },
];
const DICT_NAMES = { free: 'Базовый', theme1: 'Детектив (Про)', theme2: 'Пираты (Про)' };

export default function Lobby({ room, roomId, user, onLeave, onRoomUpdate }) {
  const navigate = useNavigate();
  const isHost = room.players?.some((p) => p.id === String(user?.id) && p.isHost);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [timerEnabled, setTimerEnabled] = useState(room?.gameSettings?.timerEnabled ?? false);
  const [timerSeconds, setTimerSeconds] = useState(room?.gameSettings?.timerSeconds ?? 60);
  const [spyCount, setSpyCount] = useState(room?.gameSettings?.spyCount ?? 1);
  const [spyMode, setSpyMode] = useState(room?.gameSettings?.spyMode ?? 'classic');
  const [dictionaryIds, setDictionaryIds] = useState(room?.gameSettings?.dictionaryIds ?? ['free']);
  const [editingName, setEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState(room?.name || 'Лобби');
  const [shareToast, setShareToast] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);

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
    setSpyMode(room?.gameSettings?.spyMode ?? 'classic');
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
    const count = spyMode === 'two' ? 2 : spyMode === 'three' ? 3 : 1;
    await api.post('/rooms/spy/start', {
      roomId,
      hostId: String(user?.id),
      timerEnabled,
      timerSeconds: timerEnabled ? timerSeconds : undefined,
      spyCount: count,
      spyMode,
      dictionaryIds: dictionaryIds?.length ? dictionaryIds : ['free'],
    });
    const { room: r } = await api.get(`/rooms/${roomId}`);
    onRoomUpdate(r);
    navigate('/spy');
  };

  const startMafia = async (opts) => {
    if (!isHost) return;
    const gs = room?.gameSettings || {};
    await api.post('/rooms/mafia/start', {
      roomId,
      hostId: String(user?.id),
      moderatorId: gs.hostSelection === 'choose' ? gs.moderatorId : undefined,
      extended: gs.extended ?? false,
      revealRoleOnDeath: gs.revealRoleOnDeath ?? true,
      mafiaCanSkipKill: gs.mafiaCanSkipKill ?? false,
      theme: gs.theme || 'default',
      ...opts,
    });
    const { room: r } = await api.get(`/rooms/${roomId}`);
    onRoomUpdate(r);
    navigate('/mafia');
  };

  const startElias = async () => {
    if (!isHost) return;
    const gs = room?.gameSettings || {};
    await api.post('/rooms/elias/start', {
      roomId,
      hostId: String(user?.id),
      timerSeconds: gs.timerSeconds ?? 60,
      scoreLimit: gs.scoreLimit ?? 10,
      dictionaryIds: gs.dictionaryIds?.length ? gs.dictionaryIds : ['basic', 'animals'],
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
              { id: 'spy', name: 'Шпион', available: true },
              { id: 'mafia', name: 'Мафия', available: true },
              { id: 'bunker', name: 'Бункер', available: false },
              { id: 'elias', name: 'Элиас', available: true },
            ].map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => {
                  if (!g.available) return;
                  const base = g.id === 'spy' ? { timerEnabled: false, timerSeconds: 60, spyCount: 1, spyMode: 'classic', dictionaryIds: ['free'] } : null;
                  const mafia = g.id === 'mafia' ? { extended: false, revealRoleOnDeath: true, mafiaCanSkipKill: false, hostSelection: 'random', theme: 'default' } : null;
                  const elias = g.id === 'elias' ? { timerSeconds: 60, scoreLimit: 10, dictionaryIds: ['basic', 'animals'] } : null;
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
              <p style={{ margin: 0, fontSize: 14 }}>Режим: {SPY_MODES.find((m) => m.id === (room.gameSettings.spyMode || 'classic'))?.label ?? '1 шпион'}</p>
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
                  <p style={{ marginTop: 0, marginBottom: 8 }}>Режим игры</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                    {SPY_MODES.map((m) => {
                      const enabled = m.free || roomHasPro;
                      const on = spyMode === m.id;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          disabled={!enabled}
                          title={!enabled ? 'Нужна подписка Про' : ''}
                          onClick={() => {
                            if (!enabled) return;
                            setSpyMode(m.id);
                            setSpyCount(m.id === 'two' ? 2 : m.id === 'three' ? 3 : 1);
                            patchLobbyGame({ gameSettings: { ...room?.gameSettings, timerEnabled, timerSeconds, spyMode: m.id, spyCount: m.id === 'two' ? 2 : m.id === 'three' ? 3 : 1, dictionaryIds } });
                          }}
                          style={{
                            ...btnStyle,
                            width: 'auto',
                            padding: '8px 14px',
                            background: on ? 'var(--tg-theme-button-color, #3a7bd5)' : '#444',
                            opacity: enabled ? 1 : 0.6,
                          }}
                        >
                          {m.label}{!m.free && <span style={{ fontSize: 10, marginLeft: 4 }}>Про</span>}
                        </button>
                      );
                    })}
                  </div>
                  <p style={{ marginBottom: 8 }}>Локации: базовый бесплатно, тематические — Про</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                    {availableDictionaries.map((id) => {
                      const on = dictionaryIds.includes(id);
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => {
                            const next = on ? dictionaryIds.filter((x) => x !== id) : [...dictionaryIds, id];
                            if (next.length === 0) return;
                            setDictionaryIds(next);
                            patchLobbyGame({ gameSettings: { ...room?.gameSettings, timerEnabled, timerSeconds, spyMode, spyCount, dictionaryIds: next } });
                          }}
                          style={{ ...btnStyle, width: 'auto', padding: '8px 14px', background: on ? 'var(--tg-theme-button-color, #3a7bd5)' : '#444' }}
                        >
                          {DICT_NAMES[id] || id}
                        </button>
                      );
                    })}
                  </div>
                  <p style={{ marginBottom: 8 }}>Таймер раунда</p>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <input
                      type="checkbox"
                      checked={timerEnabled}
                      onChange={(e) => { setTimerEnabled(e.target.checked); patchLobbyGame({ gameSettings: { ...room?.gameSettings, timerEnabled: e.target.checked, timerSeconds, spyMode, spyCount, dictionaryIds } }); }}
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
                            onClick={() => { setTimerSeconds(opt.value); patchLobbyGame({ gameSettings: { ...room?.gameSettings, timerEnabled, timerSeconds: opt.value, spyMode, spyCount, dictionaryIds } }); }}
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
            </div>
          )}
          {isHost && (
            <div style={{ ...settingsBox }}>
              <p style={{ marginTop: 0, marginBottom: 8 }}>Режим</p>
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                <button
                  type="button"
                  onClick={() => patchLobbyGame({ gameSettings: { ...room?.gameSettings, extended: false } })}
                  style={{ ...btnStyle, flex: 1, padding: 10, background: (room?.gameSettings?.extended ? '#444' : 'var(--tg-theme-button-color, #3a7bd5)') }}
                >
                  Классика
                </button>
                <button
                  type="button"
                  onClick={() => roomHasPro && patchLobbyGame({ gameSettings: { ...room?.gameSettings, extended: true } })}
                  style={{ ...btnStyle, flex: 1, padding: 10, background: (room?.gameSettings?.extended ? 'var(--tg-theme-button-color, #3a7bd5)' : '#444'), opacity: roomHasPro ? 1 : 0.6 }}
                  title={!roomHasPro ? 'Нужна подписка Про' : ''}
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
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
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
              <p style={{ marginBottom: 8, fontSize: 14 }}>Тема ролей</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                {['default', 'detective', 'pirates'].map((t) => (
                  <button key={t} type="button" onClick={() => patchLobbyGame({ gameSettings: { ...room?.gameSettings, theme: t } })} style={{ ...btnStyle, width: 'auto', padding: '8px 12px', background: (room?.gameSettings?.theme || 'default') === t ? 'var(--tg-theme-button-color, #3a7bd5)' : '#444' }}>{t === 'default' ? 'Классика' : t === 'detective' ? 'Детектив' : 'Пираты'}</button>
                ))}
              </div>
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
            </div>
          )}
          {isHost && (
            <div style={{ ...settingsBox }}>
              <p style={{ marginTop: 0, marginBottom: 8 }}>Таймер раунда (сек)</p>
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
              <p style={{ marginBottom: 8 }}>Словари: бесплатные (Базовый, Животные) и платные (Про)</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                {(room?.availableEliasDictionaries || ['basic', 'animals']).map((id) => {
                  const names = { basic: 'Базовый', animals: 'Животные', movies: 'Кино (Про)', science: 'Наука (Про)', sport: 'Спорт (Про)' };
                  const on = (room?.gameSettings?.dictionaryIds || ['basic', 'animals']).includes(id);
                  return (
                    <button key={id} type="button" onClick={() => { const cur = room?.gameSettings?.dictionaryIds || ['basic', 'animals']; const next = on ? cur.filter((x) => x !== id) : [...cur, id]; if (next.length) patchLobbyGame({ gameSettings: { ...room?.gameSettings, dictionaryIds: next } }); }} style={{ ...btnStyle, width: 'auto', padding: '8px 14px', background: on ? 'var(--tg-theme-button-color, #3a7bd5)' : '#444' }}>{names[id] || id}</button>
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
      <button type="button" onClick={onLeave} style={{ ...btnStyle, marginTop: isHost && selectedGame ? 8 : 24, background: '#555' }}>
        Выйти
      </button>

      {shopOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, padding: 24 }}>
          <div style={{ background: 'var(--tg-theme-bg-color, #1a1a1a)', padding: 24, borderRadius: 12, maxWidth: 320, maxHeight: '80vh', overflow: 'auto' }}>
            <p style={{ marginBottom: 16 }}>Магазин — {selectedGame === 'spy' ? 'Шпион' : selectedGame === 'mafia' ? 'Мафия' : selectedGame === 'bunker' ? 'Бункер' : selectedGame === 'elias' ? 'Элиас' : 'игра'}</p>
            {selectedGame === 'spy' && (
              <>
                <p style={{ fontSize: 14, marginBottom: 12 }}>Словари</p>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span>{DICT_NAMES.free}</span>
                    <span style={{ color: '#8f8' }}>Бесплатно</span>
                  </div>
                </div>
                {['theme1', 'theme2'].map((id) => (
                  <div key={id} style={{ marginBottom: 12, padding: 12, background: 'rgba(255,255,255,0.06)', borderRadius: 8 }}>
                    <div style={{ marginBottom: 6 }}>{DICT_NAMES[id] || id}</div>
                    <p style={{ fontSize: 13, opacity: 0.85 }}>Доступно только премиум‑игрокам, покупка пока не доступна.</p>
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
