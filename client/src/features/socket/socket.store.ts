import { io, Socket } from 'socket.io-client';
import { create } from 'zustand';
import { tokenStorage } from '../../shared/lib/storage';

type SocketState = {
  socket: Socket | null;
  connected: boolean;
  connect(): Socket | null;
  disconnect(): void;
};

export const useSocketStore = create<SocketState>((set, get) => ({
  socket: null,
  connected: false,
  connect: () => {
    const existing = get().socket;
    if (existing?.connected) return existing;
    const token = tokenStorage.getAccessToken();
    if (!token) return null;

    const socket = io(import.meta.env.VITE_SOCKET_URL ?? 'http://localhost:3000', {
      auth: { token },
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 800,
    });

    socket.on('connect', () => set({ connected: true }));
    socket.on('disconnect', () => set({ connected: false }));
    set({ socket });
    return socket;
  },
  disconnect: () => {
    get().socket?.disconnect();
    set({ socket: null, connected: false });
  },
}));
