import { Injectable } from '@nestjs/common';
import { Server } from 'socket.io';

@Injectable()
export class RealtimeService {
  private server?: Server;

  bindServer(server: Server) {
    this.server = server;
  }

  emitNewMessage(chatId: string, message: unknown) {
    this.server?.to(this.chatRoom(chatId)).emit('message:new', message);
    this.server?.to(this.chatRoom(chatId)).emit('chat:updated', { chatId, lastMessage: message });
  }

  emitMessageUpdated(chatId: string, message: unknown) {
    this.server?.to(this.chatRoom(chatId)).emit('message:updated', message);
  }

  emitMessageDeleted(chatId: string, messageId: string) {
    this.server?.to(this.chatRoom(chatId)).emit('message:deleted', { chatId, messageId });
    this.server?.to(this.chatRoom(chatId)).emit('chat:updated', { chatId });
  }

  emitReadReceipt(chatId: string, payload: unknown) {
    this.server?.to(this.chatRoom(chatId)).emit('message:read', payload);
  }

  emitDeliveredReceipt(chatId: string, payload: unknown) {
    this.server?.to(this.chatRoom(chatId)).emit('message:delivered', payload);
  }

  emitChatUpdated(chatId: string, chat: unknown) {
    this.server?.to(this.chatRoom(chatId)).emit('chat:updated', chat);
  }

  emitChatDeleted(chatId: string) {
    this.server?.to(this.chatRoom(chatId)).emit('chat:deleted', { chatId });
  }

  emitUserStatus(userId: string, isOnline: boolean, lastSeenAt: Date | null) {
    this.server?.emit('user:status', { userId, isOnline, lastSeenAt });
  }

  chatRoom(chatId: string) {
    return `chat:${chatId}`;
  }

  userRoom(userId: string) {
    return `user:${userId}`;
  }
}
