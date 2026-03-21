import { useEffect, useRef } from 'react';
import { api } from './api';
import { getDisplayName } from './displayName';

/**
 * Периодически сообщает серверу, где игрок (главная / лобби / игра), чтобы друзья видели статус и могли зайти по инвайту.
 * @param {{ userId: string | number | null | undefined, room: object | null, roomId: string | null }} opts
 */
export function usePresenceHeartbeat({ userId, room, roomId }) {
  const roomRef = useRef(room);
  roomRef.current = room;

  useEffect(() => {
    if (userId == null || userId === '') return undefined;

    const send = () => {
      const r = roomRef.current;
      let location = 'home';
      let inviteToken = null;
      let roomCode = null;
      let rid = null;
      if (roomId && r) {
        rid = String(roomId);
        roomCode = r.code != null ? String(r.code) : null;
        if (r.state === 'playing') {
          location = 'playing';
          inviteToken = null;
        } else {
          location = 'lobby';
          inviteToken = r.inviteToken || null;
          try {
            if (!inviteToken) inviteToken = sessionStorage.getItem('inviteToken');
          } catch (_) {}
        }
      }
      const displayName = getDisplayName() || '';
      api
        .post('/presence/heartbeat', {
          playerId: String(userId),
          displayName,
          location,
          roomId: rid,
          inviteToken,
          roomCode,
        })
        .catch(() => {});
    };

    send();
    const t = setInterval(send, 20_000);
    return () => clearInterval(t);
  }, [userId, roomId]);
}
