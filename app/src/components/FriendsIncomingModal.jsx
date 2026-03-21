import { useCallback, useEffect, useState } from 'react';
import { api, getApiErrorMessage } from '../api';
import { resolvePublicDisplayName } from '../displayName';
import { useToast } from './ui/ToastProvider';
import Modal from './ui/Modal';
import Button from './ui/Button';

/**
 * Глобальное окно входящих заявок в друзья (поллинг списка).
 */
export default function FriendsIncomingModal({ user }) {
  const { showToast } = useToast();
  const myId = user?.id != null ? String(user.id) : '';
  const [queue, setQueue] = useState([]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!myId) return;
    try {
      const r = await api.get(`/friends/list?playerId=${encodeURIComponent(myId)}`);
      setQueue(Array.isArray(r.incomingRequests) ? r.incomingRequests : []);
    } catch (_) {}
  }, [myId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!myId) return undefined;
    const t = setInterval(load, 6000);
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(t);
      window.removeEventListener('focus', onFocus);
    };
  }, [myId, load]);

  const current = queue[0];
  const open = Boolean(current);

  useEffect(() => {
    if (!current) setNote('');
  }, [current?.fromId]);

  const accept = async () => {
    if (!current || !myId) return;
    setBusy(true);
    try {
      await api.post('/friends/accept', {
        playerId: myId,
        fromId: String(current.fromId),
        note: note.trim(),
        acceptorDisplayName: resolvePublicDisplayName(user),
      });
      showToast({ type: 'success', message: 'Друг добавлен' });
      setNote('');
      await load();
    } catch (e) {
      showToast({ type: 'error', message: getApiErrorMessage(e, 'Не удалось принять заявку') });
    } finally {
      setBusy(false);
    }
  };

  const reject = async () => {
    if (!current || !myId) return;
    setBusy(true);
    try {
      await api.post('/friends/reject', { playerId: myId, fromId: String(current.fromId) });
      setNote('');
      await load();
    } catch (e) {
      showToast({ type: 'error', message: getApiErrorMessage(e, 'Не удалось отклонить') });
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  const fromLabel = (current.fromName && String(current.fromName).trim()) || `Игрок ${current.fromId}`;

  return (
    <Modal
      open={open}
      onClose={() => {}}
      closeOnOverlayClick={false}
      title="Заявка в друзья"
      width={400}
    >
      <p style={{ marginTop: 0, marginBottom: 12, fontSize: 14, lineHeight: 1.5 }}>
        <strong>{fromLabel}</strong> хочет добавить вас в друзья.
      </p>
      <label
        htmlFor="gh-friend-note"
        style={{ display: 'block', fontSize: 13, marginBottom: 6, opacity: 0.9 }}
      >
        Заметка (необязательно) — например, как зовут в жизни
      </label>
      <input
        id="gh-friend-note"
        type="text"
        className="gh-input gh-input--full"
        placeholder="Например: Андрей"
        value={note}
        onChange={(e) => setNote(e.target.value.slice(0, 120))}
        style={{ marginBottom: 16 }}
        autoComplete="off"
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Button variant="primary" fullWidth onClick={accept} disabled={busy}>
          Добавить
        </Button>
        <Button variant="danger" fullWidth onClick={reject} disabled={busy}>
          Отклонить
        </Button>
      </div>
    </Modal>
  );
}
