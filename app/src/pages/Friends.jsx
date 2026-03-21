import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, getApiErrorMessage } from '../api';
import { useToast } from '../components/ui/ToastProvider';
import PageLayout from '../components/layout/PageLayout';
import AppHeaderRight from '../components/layout/AppHeaderRight';
import Button from '../components/ui/Button';
import { friendDisplayNameOnly } from '../displayName';
import './friendsPage.css';

function sortFriends(arr) {
  return [...arr].sort((a, b) => {
    if (Boolean(a.online) !== Boolean(b.online)) return a.online ? -1 : 1;
    return String(a.displayName || '').localeCompare(String(b.displayName || ''), 'ru');
  });
}

export default function FriendsPage({ user, onJoinByInvite }) {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [joiningId, setJoiningId] = useState(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [savingNoteId, setSavingNoteId] = useState(null);

  const myId = user?.id != null ? String(user.id) : '';

  const loadFriends = useCallback(async () => {
    if (!myId) {
      setFriends([]);
      setLoading(false);
      return;
    }
    try {
      const r = await api.get(`/friends/list?playerId=${encodeURIComponent(myId)}`);
      setFriends(Array.isArray(r.friends) ? r.friends : []);
    } catch (_) {
      setFriends([]);
    } finally {
      setLoading(false);
    }
  }, [myId]);

  useEffect(() => {
    loadFriends();
  }, [loadFriends]);

  useEffect(() => {
    const t = setInterval(loadFriends, 12_000);
    const onFocus = () => loadFriends();
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(t);
      window.removeEventListener('focus', onFocus);
    };
  }, [loadFriends]);

  const removeFriend = async (friendId) => {
    if (!myId) return;
    try {
      await api.post('/friends/remove', { playerId: myId, friendId: String(friendId) });
      showToast({ type: 'success', message: 'Удалён из друзей' });
      setExpandedId(null);
      await loadFriends();
    } catch (e) {
      showToast({ type: 'error', message: getApiErrorMessage(e, 'Не удалось удалить') });
    }
  };

  const saveFriendNote = async (friendId) => {
    if (!myId) return;
    setSavingNoteId(String(friendId));
    try {
      const note = noteDraft.trim().slice(0, 200);
      await api.post('/friends/note', { playerId: myId, friendId: String(friendId), note });
      showToast({ type: 'success', message: 'Примечание сохранено' });
      await loadFriends();
    } catch (e) {
      showToast({ type: 'error', message: getApiErrorMessage(e, 'Не удалось сохранить') });
    } finally {
      setSavingNoteId(null);
    }
  };

  const joinLobby = async (f) => {
    if (!f?.joinInviteToken || !onJoinByInvite) return;
    setJoiningId(String(f.id));
    try {
      await onJoinByInvite(f.joinInviteToken);
      navigate('/lobby');
    } catch (e) {
      showToast({ type: 'error', message: getApiErrorMessage(e, 'Не удалось войти в комнату') });
    } finally {
      setJoiningId(null);
    }
  };

  const statusLabel = (f) => {
    if (!f.online) return 'Не в сети';
    if (f.location === 'lobby') return 'В лобби';
    if (f.location === 'playing') return 'В игре';
    if (f.location === 'home') return 'На главной';
    return '';
  };

  const sorted = sortFriends(friends);

  return (
    <PageLayout
      title="Друзья"
      right={<AppHeaderRight user={user} />}
      onBack={() => navigate('/')}
    >
      <div className="friends-page">
        {!myId ? (
          <p className="friends-page__muted">Войдите в приложение, чтобы видеть друзей.</p>
        ) : loading ? (
          <p className="friends-page__muted">Загрузка…</p>
        ) : sorted.length === 0 ? (
          <p className="friends-page__muted">Пока нет друзей. Добавьте их из меню игрока в лобби.</p>
        ) : (
          <ul className="friends-page__list">
            {sorted.map((f) => {
              const expanded = expandedId === f.id;
              return (
                <li key={f.id} className="friends-page__cardWrap">
                  <div className="friends-page__card">
                    <button
                      type="button"
                      className="friends-page__cardTap"
                      onClick={() => {
                        if (expanded) {
                          setExpandedId(null);
                        } else {
                          setNoteDraft(f.note != null ? String(f.note) : '');
                          setExpandedId(f.id);
                        }
                      }}
                    >
                      <span
                        className={`friends-page__dot ${f.online ? 'friends-page__dot--on' : 'friends-page__dot--off'}`}
                        aria-hidden
                      />
                      <div className="friends-page__cardMain">
                        <div className="friends-page__nameRow">
                          <span className="friends-page__name">{friendDisplayNameOnly(f)}</span>
                          {f.note && String(f.note).trim() ? (
                            <span className="friends-page__noteHint">{String(f.note).trim()}</span>
                          ) : null}
                        </div>
                        <div className="friends-page__status">{statusLabel(f)}</div>
                      </div>
                    </button>
                    {f.joinInviteToken ? (
                      <button
                        type="button"
                        className="friends-page__joinChip"
                        onClick={() => joinLobby(f)}
                        disabled={joiningId === String(f.id)}
                      >
                        {joiningId === String(f.id) ? '…' : 'В лобби'}
                      </button>
                    ) : null}
                  </div>
                  {expanded ? (
                    <div className="friends-page__actions">
                      <label className="friends-page__noteLabel" htmlFor={`friend-note-${f.id}`}>
                        Примечание (видно только вам)
                      </label>
                      <textarea
                        id={`friend-note-${f.id}`}
                        className="friends-page__noteInput"
                        rows={2}
                        maxLength={200}
                        value={noteDraft}
                        onChange={(e) => setNoteDraft(e.target.value)}
                        placeholder="Например: одногруппник, играли вместе"
                      />
                      <Button
                        fullWidth
                        onClick={() => saveFriendNote(f.id)}
                        disabled={savingNoteId === String(f.id)}
                      >
                        {savingNoteId === String(f.id) ? 'Сохранение…' : 'Сохранить примечание'}
                      </Button>
                      <Button variant="danger" fullWidth onClick={() => removeFriend(f.id)}>
                        Удалить из друзей
                      </Button>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </PageLayout>
  );
}
