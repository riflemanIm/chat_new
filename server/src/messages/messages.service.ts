import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ChatMemberRole, MessageStatus } from '@prisma/client';
import { ChatsService } from '../chats/chats.service';
import { CursorPage } from '../common/types/pagination';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { ListMessagesDto } from './dto/list-messages.dto';
import { UpdateMessageDto } from './dto/update-message.dto';

const messageInclude = {
  sender: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
  attachments: true,
  statuses: true,
};

@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly chats: ChatsService,
    private readonly realtime: RealtimeService,
  ) {}

  async create(userId: string, chatId: string, dto: CreateMessageDto) {
    await this.chats.ensureMember(userId, chatId);
    if (!dto.text?.trim() && !dto.attachments?.length) {
      throw new BadRequestException('Message text or attachments are required');
    }

    const memberIds = await this.activeMemberIds(chatId);
    const message = await this.prisma.message.create({
      data: {
        chatId,
        senderId: userId,
        text: dto.text?.trim(),
        attachments: dto.attachments?.length ? { create: dto.attachments } : undefined,
        statuses: {
          create: memberIds.map((memberId) => ({
            userId: memberId,
            status: memberId === userId ? MessageStatus.READ : MessageStatus.SENT,
          })),
        },
      },
      include: messageInclude,
    });
    await this.prisma.chat.update({ where: { id: chatId }, data: { updatedAt: new Date() } });
    this.realtime.emitNewMessage(chatId, message);
    return message;
  }

  async list(userId: string, chatId: string, dto: ListMessagesDto): Promise<CursorPage<unknown>> {
    await this.chats.ensureMember(userId, chatId);
    const take = dto.limit + 1;
    const messages = await this.prisma.message.findMany({
      where: { chatId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take,
      ...(dto.cursor ? { cursor: { id: dto.cursor }, skip: 1 } : {}),
      include: messageInclude,
    });
    const items = messages.slice(0, dto.limit);
    return {
      items,
      nextCursor: messages.length > dto.limit ? items[items.length - 1].id : null,
    };
  }

  async update(userId: string, messageId: string, dto: UpdateMessageDto) {
    const message = await this.findExisting(messageId);
    await this.chats.ensureMember(userId, message.chatId);
    if (message.senderId !== userId) {
      throw new ForbiddenException('Only sender can edit message');
    }

    const updated = await this.prisma.message.update({
      where: { id: messageId },
      data: { text: dto.text, editedAt: new Date() },
      include: messageInclude,
    });
    this.realtime.emitMessageUpdated(updated.chatId, updated);
    return updated;
  }

  async remove(userId: string, messageId: string) {
    const message = await this.findExisting(messageId);
    const member = await this.chats.ensureMember(userId, message.chatId);
    const isAdmin = member.role === ChatMemberRole.OWNER || member.role === ChatMemberRole.ADMIN;
    if (message.senderId !== userId && !isAdmin) {
      throw new ForbiddenException('Only sender or chat admin can delete message');
    }

    const deleted = await this.prisma.message.update({
      where: { id: messageId },
      data: { deletedAt: new Date() },
      include: messageInclude,
    });
    this.realtime.emitMessageDeleted(deleted.chatId, deleted.id);
    return { success: true };
  }

  async markRead(userId: string, messageId: string) {
    const message = await this.findExisting(messageId);
    await this.chats.ensureMember(userId, message.chatId);
    const status = await this.prisma.messageStatusRecord.upsert({
      where: { messageId_userId: { messageId, userId } },
      create: { messageId, userId, status: MessageStatus.READ },
      update: { status: MessageStatus.READ },
    });
    this.realtime.emitReadReceipt(message.chatId, { messageId, userId, status: status.status });
    return status;
  }

  async markDelivered(userId: string, messageId: string) {
    const message = await this.findExisting(messageId);
    await this.chats.ensureMember(userId, message.chatId);
    const current = await this.prisma.messageStatusRecord.findUnique({
      where: { messageId_userId: { messageId, userId } },
    });
    if (current?.status === MessageStatus.READ) {
      return current;
    }
    const status = await this.prisma.messageStatusRecord.upsert({
      where: { messageId_userId: { messageId, userId } },
      create: { messageId, userId, status: MessageStatus.DELIVERED },
      update: { status: MessageStatus.DELIVERED },
    });
    this.realtime.emitDeliveredReceipt(message.chatId, { messageId, userId, status: status.status });
    return status;
  }

  private async findExisting(messageId: string) {
    const message = await this.prisma.message.findFirst({
      where: { id: messageId, deletedAt: null },
    });
    if (!message) {
      throw new NotFoundException('Message not found');
    }
    return message;
  }

  private async activeMemberIds(chatId: string) {
    const members = await this.prisma.chatMember.findMany({
      where: { chatId, leftAt: null },
      select: { userId: true },
    });
    return members.map((member) => member.userId);
  }
}
