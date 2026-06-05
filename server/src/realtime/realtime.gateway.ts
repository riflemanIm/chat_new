import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { MessageStatus } from '@prisma/client';
import { Server, Socket } from 'socket.io';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from './realtime.service';

type AuthenticatedSocket = Socket & { userId?: string };

@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') ?? true,
    credentials: true,
  },
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private connections = new Map<string, number>();

  constructor(
    private readonly auth: AuthService,
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
  ) {}

  afterInit(server: Server) {
    this.realtime.bindServer(server);
  }

  async handleConnection(client: AuthenticatedSocket) {
    const token = this.extractToken(client);
    if (!token) {
      client.disconnect(true);
      return;
    }

    try {
      const payload = await this.auth.verifyAccessToken(token);
      client.userId = payload.sub;
      client.join(this.realtime.userRoom(payload.sub));

      const chats = await this.prisma.chatMember.findMany({
        where: { userId: payload.sub, leftAt: null, chat: { deletedAt: null } },
        select: { chatId: true },
      });
      chats.forEach((chat) => client.join(this.realtime.chatRoom(chat.chatId)));

      const count = (this.connections.get(payload.sub) ?? 0) + 1;
      this.connections.set(payload.sub, count);
      if (count === 1) {
        await this.prisma.user.update({
          where: { id: payload.sub },
          data: { isOnline: true },
        });
        this.realtime.emitUserStatus(payload.sub, true, null);
      }
    } catch {
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: AuthenticatedSocket) {
    if (!client.userId) {
      return;
    }
    const count = Math.max((this.connections.get(client.userId) ?? 1) - 1, 0);
    if (count > 0) {
      this.connections.set(client.userId, count);
      return;
    }

    this.connections.delete(client.userId);
    const lastSeenAt = new Date();
    await this.prisma.user.update({
      where: { id: client.userId },
      data: { isOnline: false, lastSeenAt },
    });
    this.realtime.emitUserStatus(client.userId, false, lastSeenAt);
  }

  @SubscribeMessage('message:send')
  async sendMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: { chatId: string; text?: string; attachments?: Array<Record<string, unknown>> },
  ) {
    const userId = this.requireUser(client);
    await this.ensureMember(userId, body.chatId);
    if (!body.text?.trim() && !body.attachments?.length) {
      client.emit('error', { message: 'Message text or attachments are required' });
      return;
    }

    const members = await this.prisma.chatMember.findMany({
      where: { chatId: body.chatId, leftAt: null },
      select: { userId: true },
    });
    const message = await this.prisma.message.create({
      data: {
        chatId: body.chatId,
        senderId: userId,
        text: body.text?.trim(),
        attachments: body.attachments?.length
          ? {
              create: body.attachments.map((attachment) => ({
                url: String(attachment.url),
                fileName: attachment.fileName ? String(attachment.fileName) : undefined,
                mimeType: attachment.mimeType ? String(attachment.mimeType) : undefined,
                size: attachment.size ? Number(attachment.size) : undefined,
              })),
            }
          : undefined,
        statuses: {
          create: members.map((member) => ({
            userId: member.userId,
            status: member.userId === userId ? MessageStatus.READ : MessageStatus.SENT,
          })),
        },
      },
      include: {
        sender: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
        attachments: true,
        statuses: true,
      },
    });
    await this.prisma.chat.update({ where: { id: body.chatId }, data: { updatedAt: new Date() } });
    this.realtime.emitNewMessage(body.chatId, message);
    return message;
  }

  @SubscribeMessage('typing:start')
  async typingStart(@ConnectedSocket() client: AuthenticatedSocket, @MessageBody() body: { chatId: string }) {
    const userId = this.requireUser(client);
    await this.ensureMember(userId, body.chatId);
    client.to(this.realtime.chatRoom(body.chatId)).emit('typing:start', { chatId: body.chatId, userId });
  }

  @SubscribeMessage('typing:stop')
  async typingStop(@ConnectedSocket() client: AuthenticatedSocket, @MessageBody() body: { chatId: string }) {
    const userId = this.requireUser(client);
    await this.ensureMember(userId, body.chatId);
    client.to(this.realtime.chatRoom(body.chatId)).emit('typing:stop', { chatId: body.chatId, userId });
  }

  @SubscribeMessage('message:read')
  async read(@ConnectedSocket() client: AuthenticatedSocket, @MessageBody() body: { messageId: string }) {
    return this.setStatus(client, body.messageId, MessageStatus.READ);
  }

  @SubscribeMessage('message:delivered')
  async delivered(@ConnectedSocket() client: AuthenticatedSocket, @MessageBody() body: { messageId: string }) {
    return this.setStatus(client, body.messageId, MessageStatus.DELIVERED);
  }

  private async setStatus(client: AuthenticatedSocket, messageId: string, status: MessageStatus) {
    const userId = this.requireUser(client);
    const message = await this.prisma.message.findFirst({ where: { id: messageId, deletedAt: null } });
    if (!message) {
      client.emit('error', { message: 'Message not found' });
      return;
    }
    await this.ensureMember(userId, message.chatId);
    const current = await this.prisma.messageStatusRecord.findUnique({
      where: { messageId_userId: { messageId, userId } },
    });
    if (current?.status === MessageStatus.READ && status === MessageStatus.DELIVERED) {
      return current;
    }
    const updated = await this.prisma.messageStatusRecord.upsert({
      where: { messageId_userId: { messageId, userId } },
      create: { messageId, userId, status },
      update: { status },
    });
    if (status === MessageStatus.READ) {
      this.realtime.emitReadReceipt(message.chatId, { messageId, userId, status });
    } else {
      this.realtime.emitDeliveredReceipt(message.chatId, { messageId, userId, status });
    }
    return updated;
  }

  private requireUser(client: AuthenticatedSocket) {
    if (!client.userId) {
      client.disconnect(true);
      throw new Error('Unauthorized socket');
    }
    return client.userId;
  }

  private async ensureMember(userId: string, chatId: string) {
    const member = await this.prisma.chatMember.findFirst({
      where: { userId, chatId, leftAt: null, chat: { deletedAt: null } },
    });
    if (!member) {
      throw new Error('You are not a member of this chat');
    }
    return member;
  }

  private extractToken(client: Socket) {
    const authToken = client.handshake.auth?.token;
    if (typeof authToken === 'string') {
      return authToken;
    }
    const header = client.handshake.headers.authorization;
    if (header?.startsWith('Bearer ')) {
      return header.slice(7);
    }
    return undefined;
  }
}
