import { io } from 'socket.io-client';

const API_URL = (import.meta.env.VITE_API_URL !== undefined && import.meta.env.VITE_API_URL !== '')
  ? import.meta.env.VITE_API_URL
  : (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');

let sock = null;

export const socket = {
  connect(roomId, player) {
    if (sock) sock.disconnect();
    sock = io(API_URL, {
      auth: { roomId, player },
      transports: ['websocket', 'polling'],
    });
    return sock;
  },
  disconnect() {
    if (sock) {
      sock.disconnect();
      sock = null;
    }
  },
  on(ev, fn) {
    if (sock) sock.on(ev, fn);
  },
  off(ev, fn) {
    if (sock) sock.off(ev, fn);
  },
  emit(ev, data) {
    if (sock) sock.emit(ev, data);
  },
};
