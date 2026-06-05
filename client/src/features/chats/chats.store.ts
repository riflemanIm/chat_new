import { create } from 'zustand';
import { Chat } from '../../entities/chat/types';
import { User } from '../../entities/user/types';
import { api } from '../../shared/api/client';

type ChatsState = {
  chats: Chat[];
  selectedChatId: string | null;
  loading: boolean;
  searchResults: User[];
  loadChats(): Promise<void>;
  selectChat(id: string | null): void;
  upsertChat(chat: Chat): void;
  removeChat(id: string): void;
  searchUsers(q: string): Promise<void>;
  createDirect(userId: string): Promise<Chat>;
  createGroup(title: string, memberIds: string[], avatarUrl?: string): Promise<Chat>;
  updateChat(id: string, data: { title?: string; avatarUrl?: string }): Promise<Chat>;
  addMembers(id: string, userIds: string[]): Promise<Chat>;
  removeMember(id: string, userId: string): Promise<void>;
  deleteChat(id: string): Promise<void>;
};

export const useChatsStore = create<ChatsState>((set, get) => ({
  chats: [],
  selectedChatId: null,
  loading: false,
  searchResults: [],
  loadChats: async () => {
    set({ loading: true });
    try {
      set({ chats: await api.chats.list() });
    } finally {
      set({ loading: false });
    }
  },
  selectChat: (id) => set({ selectedChatId: id }),
  upsertChat: (chat) =>
    set((state) => {
      const exists = state.chats.some((item) => item.id === chat.id);
      return {
        chats: exists
          ? state.chats.map((item) => (item.id === chat.id ? { ...item, ...chat } : item))
          : [chat, ...state.chats],
      };
    }),
  removeChat: (id) =>
    set((state) => ({
      chats: state.chats.filter((chat) => chat.id !== id),
      selectedChatId: state.selectedChatId === id ? null : state.selectedChatId,
    })),
  searchUsers: async (q) => {
    if (!q.trim()) {
      set({ searchResults: [] });
      return;
    }
    set({ searchResults: await api.users.search(q.trim()) });
  },
  createDirect: async (userId) => {
    const chat = await api.chats.direct({ userId });
    get().upsertChat(chat);
    set({ selectedChatId: chat.id });
    return chat;
  },
  createGroup: async (title, memberIds, avatarUrl) => {
    const chat = await api.chats.group({ title, memberIds, avatarUrl });
    get().upsertChat(chat);
    set({ selectedChatId: chat.id });
    return chat;
  },
  updateChat: async (id, data) => {
    const chat = await api.chats.update(id, data);
    get().upsertChat(chat);
    return chat;
  },
  addMembers: async (id, userIds) => {
    const chat = await api.chats.addMembers(id, userIds);
    get().upsertChat(chat);
    return chat;
  },
  removeMember: async (id, userId) => {
    await api.chats.removeMember(id, userId);
    await get().loadChats();
  },
  deleteChat: async (id) => {
    await api.chats.remove(id);
    get().removeChat(id);
  },
}));
