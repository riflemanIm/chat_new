import { create } from 'zustand';
import { Message, MessageAttachment, MessageStatusRecord } from '../../entities/message/types';
import { api } from '../../shared/api/client';

type ChatMessages = {
  items: Message[];
  nextCursor: string | null;
  loading: boolean;
};

type MessagesState = {
  byChat: Record<string, ChatMessages>;
  load(chatId: string, reset?: boolean): Promise<void>;
  send(chatId: string, senderId: string, text: string, attachments?: MessageAttachment[]): Promise<void>;
  upsert(chatId: string, message: Message): void;
  remove(chatId: string, messageId: string): void;
  softDelete(chatId: string, messageId: string): void;
  edit(messageId: string, text: string): Promise<void>;
  deleteMessage(messageId: string, chatId: string): Promise<void>;
  markRead(messageId: string): Promise<void>;
  applyStatus(status: Pick<MessageStatusRecord, 'messageId' | 'userId' | 'status'>): void;
};

function sortMessages(messages: Message[]) {
  return [...messages].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

export const useMessagesStore = create<MessagesState>((set, get) => ({
  byChat: {},
  load: async (chatId, reset = false) => {
    const state = get().byChat[chatId];
    if (!reset && state && !state.nextCursor) return;
    set((current) => ({
      byChat: {
        ...current.byChat,
        [chatId]: { items: reset ? [] : state?.items ?? [], nextCursor: state?.nextCursor ?? null, loading: true },
      },
    }));
    const page = await api.messages.list(chatId, { cursor: reset ? null : state?.nextCursor, limit: 30 });
    set((current) => {
      const existing = reset ? [] : current.byChat[chatId]?.items ?? [];
      const merged = [...page.items.reverse(), ...existing].filter(
        (message, index, arr) => arr.findIndex((item) => item.id === message.id) === index,
      );
      return {
        byChat: {
          ...current.byChat,
          [chatId]: { items: sortMessages(merged), nextCursor: page.nextCursor, loading: false },
        },
      };
    });
  },
  send: async (chatId, senderId, text, attachments = []) => {
    const temp: Message = {
      id: `temp-${Date.now()}`,
      chatId,
      senderId,
      type: 'TEXT',
      text,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      editedAt: null,
      deletedAt: null,
      attachments,
      statuses: [],
      optimistic: true,
    };
    get().upsert(chatId, temp);
    try {
      const saved = await api.messages.create(chatId, { text: text || undefined, attachments: attachments.length ? attachments : undefined });
      get().remove(chatId, temp.id);
      get().upsert(chatId, saved);
    } catch (error) {
      get().remove(chatId, temp.id);
      throw error;
    }
  },
  upsert: (chatId, message) =>
    set((state) => {
      const current = state.byChat[chatId] ?? { items: [], nextCursor: null, loading: false };
      const exists = current.items.some((item) => item.id === message.id);
      const items = exists ? current.items.map((item) => (item.id === message.id ? { ...item, ...message } : item)) : [...current.items, message];
      return { byChat: { ...state.byChat, [chatId]: { ...current, items: sortMessages(items) } } };
    }),
  remove: (chatId, messageId) =>
    set((state) => {
      const current = state.byChat[chatId];
      if (!current) return state;
      return { byChat: { ...state.byChat, [chatId]: { ...current, items: current.items.filter((item) => item.id !== messageId) } } };
    }),
  softDelete: (chatId, messageId) =>
    set((state) => {
      const current = state.byChat[chatId];
      if (!current) return state;
      return {
        byChat: {
          ...state.byChat,
          [chatId]: {
            ...current,
            items: current.items.map((item) => (item.id === messageId ? { ...item, deletedAt: new Date().toISOString(), text: null } : item)),
          },
        },
      };
    }),
  edit: async (messageId, text) => {
    const updated = await api.messages.update(messageId, { text });
    get().upsert(updated.chatId, updated);
  },
  deleteMessage: async (messageId, chatId) => {
    await api.messages.remove(messageId);
    set((state) => {
      const current = state.byChat[chatId];
      if (!current) return state;
      return {
        byChat: {
          ...state.byChat,
          [chatId]: {
            ...current,
            items: current.items.map((item) => (item.id === messageId ? { ...item, deletedAt: new Date().toISOString(), text: null } : item)),
          },
        },
      };
    });
  },
  markRead: async (messageId) => {
    await api.messages.read(messageId);
  },
  applyStatus: (status) =>
    set((state) => {
      const byChat = Object.fromEntries(
        Object.entries(state.byChat).map(([chatId, data]) => [
          chatId,
          {
            ...data,
            items: data.items.map((message) =>
              message.id !== status.messageId
                ? message
                : {
                    ...message,
                    statuses: message.statuses.map((item) =>
                      item.userId === status.userId ? { ...item, status: status.status, updatedAt: new Date().toISOString() } : item,
                    ),
                  },
            ),
          },
        ]),
      );
      return { byChat };
    }),
}));
