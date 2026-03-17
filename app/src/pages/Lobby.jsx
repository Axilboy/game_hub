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
const DICT_NAMES = { free: 'Базовый', theme1: 'Детектив', theme2: 'Пираты' };

export default function Lobby({ room, roomId, user, onLeave, onRoomUpdate }) {
  const navigate = useNavigate();
  const isHost = room.players?.some((p) => p.id === String(user?.id) && p.isHost);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [timerEnabled, setTimerEnabled] = useState(room?.gameSettings?.timerEnabled ?? false);
  const [timerSeconds, setTimerSeconds] = useState(room?.gameSettings?.timerSeconds ?? 60);
  const [spyCount, setSpyCount] = useState(room?.gameSettings?.spyCount ?? 1);
  const [dictionaryIds, setDictionaryIds] = useState(room?.gameSettings?.dictionaryIds ?? ['free']);
  const [editingName, setEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState(room?.name || 'Лобби');
  const [shareToast, setShareToast] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);

  const roomName = room?.name || 'Лобби';
  const selectedGame = room?.selectedGame ?? null;
  const availableDictionaries = room?.availableDictionaries || ['free'];

  useEffect(() => {
    setEditNameValue(roomName);
  }, [roomName]);

  useEffect(() => {
    setTimerEnabled(room?.gameSettings?.timerEnabled ?? false);
    setTimerSeconds(room?.gameSettings?.timerSeconds ?? 60);
    setSpyCount(room?.gameSettings?.spyCount ?? 1);
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
    await api.post('/rooms/spy/start', {
      roomId,
      hostId: String(user?.id),
      timerEnabled,
      timerSeconds: timerEnabled ? timerSeconds : undefined,
      spyCount,
      dictionaryIds: dictionaryIds?.length ? dictionaryIds : ['free'],
    });
    const { room: r } = await api.get(`/rooms/${roomId}`);
    onRoomUpdate(r);
    navigate('/spy');
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
              { id: 'mafia', name: 'Мафия', available: false },
              { id: 'bunker', name: 'Бункер', available: false },
              { id: 'elias', name: 'Элиас', available: false },
            ].map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => g.available ? patchLobbyGame({ selectedGame: g.id, gameSettings: g.id === 'spy' ? { timerEnabled: false, timerSeconds: 60, spyCount: 1, dictionaryIds: ['free'] } : undefined }) : null}
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
              <p style={{ margin: 0, fontSize: 14 }}>Шпионов: {room.gameSettings.spyCount ?? 1}</p>
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
                  <p style={{ marginTop: 0 }}>Количество шпионов</p>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                    {SPY_COUNT_OPTIONS.map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => { setSpyCount(n); patchLobbyGame({ gameSettings: { ...room?.gameSettings, timerEnabled, timerSeconds, spyCount: n, dictionaryIds } }); }}
                        style={{
                          ...btnStyle,
                          width: 'auto',
                          padding: '8px 14px',
                          background: spyCount === n ? 'var(--tg-theme-button-color, #3a7bd5)' : '#444',
                        }}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                  <p style={{ marginBottom: 8 }}>Словари (доступны в лобби)</p>
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
                            patchLobbyGame({ gameSettings: { ...room?.gameSettings, timerEnabled, timerSeconds, spyCount, dictionaryIds: next } });
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
                      onChange={(e) => { setTimerEnabled(e.target.checked); patchLobbyGame({ gameSettings: { ...room?.gameSettings, timerEnabled: e.target.checked, timerSeconds, spyCount, dictionaryIds } }); }}
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
                            onClick={() => { setTimerSeconds(opt.value); patchLobbyGame({ gameSettings: { ...room?.gameSettings, timerEnabled, timerSeconds: opt.value, spyCount, dictionaryIds } }); }}
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

      {isHost && selectedGame && selectedGame !== 'spy' && (
        <div style={{ ...settingsBox, marginTop: 24 }}>
          <p style={{ marginBottom: 8 }}>{selectedGame === 'mafia' ? 'Мафия' : selectedGame === 'bunker' ? 'Бункер' : 'Элиас'} — скоро</p>
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
