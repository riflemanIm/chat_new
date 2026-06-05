import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ChatMemberRole, ChatType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { AddMembersDto } from './dto/add-members.dto';
import { CreateDirectChatDto } from './dto/create-direct-chat.dto';
import { CreateGroupChatDto } from './dto/create-group-chat.dto';
import { UpdateChatDto } from './dto/update-chat.dto';

const chatInclude = {
  members: {
    where: { leftAt: null },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          username: true,
          displayName: true,
          avatarUrl: true,
          isOnline: true,
          lastSeenAt: true,
        },
      },
    },
  },
  messages: {
    where: { deletedAt: null },
    orderBy: { createdAt: 'desc' as const },
    take: 1,
    include: { sender: { select: { id: true, username: true, displayName: true, avatarUrl: true } } },
  },
};

@Injectable()
export class ChatsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
  ) {}

  async createDirect(currentUserId: string, dto: CreateDirectChatDto) {
    if (dto.userId === currentUserId) {
      throw new BadRequestException('Cannot create direct chat with yourself');
    }

    const target = await this.prisma.user.findUnique({ where: { id: dto.userId } });
    if (!target) {
      throw new NotFoundException('User not found');
    }

    const existing = await this.prisma.chat.findFirst({
      where: {
        type: ChatType.DIRECT,
        deletedAt: null,
        members: {
          every: { userId: { in: [currentUserId, dto.userId] } },
          some: { userId: currentUserId, leftAt: null },
        },
      },
      include: chatInclude,
    });
    if (existing && existing.members.length === 2) {
      return existing;
    }

    const chat = await this.prisma.chat.create({
      data: {
        type: ChatType.DIRECT,
        createdBy: currentUserId,
        members: {
          create: [
            { userId: currentUserId, role: ChatMemberRole.MEMBER },
            { userId: dto.userId, role: ChatMemberRole.MEMBER },
          ],
        },
      },
      include: chatInclude,
    });
    this.realtime.emitChatUpdated(chat.id, chat);
    return chat;
  }

  async createGroup(currentUserId: string, dto: CreateGroupChatDto) {
    const memberIds = [...new Set([currentUserId, ...dto.memberIds])];
    const count = await this.prisma.user.count({ where: { id: { in: memberIds } } });
    if (count !== memberIds.length) {
      throw new BadRequestException('One or more users do not exist');
    }

    const chat = await this.prisma.chat.create({
      data: {
        type: ChatType.GROUP,
        title: dto.title,
        avatarUrl: dto.avatarUrl,
        createdBy: currentUserId,
        members: {
          create: memberIds.map((userId) => ({
            userId,
            role: userId === currentUserId ? ChatMemberRole.OWNER : ChatMemberRole.MEMBER,
          })),
        },
      },
      include: chatInclude,
    });
    this.realtime.emitChatUpdated(chat.id, chat);
    return chat;
  }

  findMyChats(userId: string) {
    return this.prisma.chat.findMany({
      where: {
        deletedAt: null,
        members: { some: { userId, leftAt: null } },
      },
      include: chatInclude,
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findOne(userId: string, chatId: string) {
    await this.ensureMember(userId, chatId);
    const chat = await this.prisma.chat.findFirst({
      where: { id: chatId, deletedAt: null },
      include: chatInclude,
    });
    if (!chat) {
      throw new NotFoundException('Chat not found');
    }
    return chat;
  }

  async update(userId: string, chatId: string, dto: UpdateChatDto) {
    await this.ensureAdmin(userId, chatId);
    const chat = await this.prisma.chat.findUnique({ where: { id: chatId } });
    if (!chat || chat.deletedAt) {
      throw new NotFoundException('Chat not found');
    }
    if (chat.type !== ChatType.GROUP) {
      throw new BadRequestException('Only group chats can be updated');
    }

    const updated = await this.prisma.chat.update({
      where: { id: chatId },
      data: dto,
      include: chatInclude,
    });
    this.realtime.emitChatUpdated(chatId, updated);
    return updated;
  }

  async addMembers(userId: string, chatId: string, dto: AddMembersDto) {
    await this.ensureAdmin(userId, chatId);
    const chat = await this.prisma.chat.findUnique({ where: { id: chatId } });
    if (!chat || chat.deletedAt) {
      throw new NotFoundException('Chat not found');
    }
    if (chat.type !== ChatType.GROUP) {
      throw new BadRequestException('Cannot add members to direct chat');
    }

    const userIds = [...new Set(dto.userIds)];
    const usersCount = await this.prisma.user.count({ where: { id: { in: userIds } } });
    if (usersCount !== userIds.length) {
      throw new BadRequestException('One or more users do not exist');
    }

    await this.prisma.$transaction(
      userIds.map((memberId) =>
        this.prisma.chatMember.upsert({
          where: { chatId_userId: { chatId, userId: memberId } },
          create: { chatId, userId: memberId },
          update: { leftAt: null },
        }),
      ),
    );

    const updated = await this.findOne(userId, chatId);
    this.realtime.emitChatUpdated(chatId, updated);
    return updated;
  }

  async removeMember(actorId: string, chatId: string, memberId: string) {
    const actor = await this.ensureMember(actorId, chatId);
    const target = await this.prisma.chatMember.findUnique({
      where: { chatId_userId: { chatId, userId: memberId } },
    });
    if (!target || target.leftAt) {
      throw new NotFoundException('Member not found');
    }

    const isSelfLeave = actorId === memberId;
    const isAdmin = actor.role === ChatMemberRole.OWNER || actor.role === ChatMemberRole.ADMIN;
    if (!isSelfLeave && !isAdmin) {
      throw new ForbiddenException('Only admins can remove members');
    }

    await this.prisma.chatMember.update({
      where: { chatId_userId: { chatId, userId: memberId } },
      data: { leftAt: new Date() },
    });

    const updated = await this.findOne(actorId, chatId).catch(() => null);
    this.realtime.emitChatUpdated(chatId, updated ?? { id: chatId });
    return { success: true };
  }

  async remove(userId: string, chatId: string) {
    await this.ensureMember(userId, chatId);
    const chat = await this.prisma.chat.findFirst({ where: { id: chatId, deletedAt: null } });
    if (!chat) {
      throw new NotFoundException('Chat not found');
    }
    if (chat.type === ChatType.GROUP) {
      await this.ensureAdmin(userId, chatId);
    }
    await this.prisma.chat.update({
      where: { id: chatId },
      data: { deletedAt: new Date() },
    });
    this.realtime.emitChatDeleted(chatId);
    return { success: true };
  }

  async ensureMember(userId: string, chatId: string) {
    const member = await this.prisma.chatMember.findFirst({
      where: {
        userId,
        chatId,
        leftAt: null,
        chat: { deletedAt: null },
      },
    });
    if (!member) {
      throw new ForbiddenException('You are not a member of this chat');
    }
    return member;
  }

  async ensureAdmin(userId: string, chatId: string) {
    const member = await this.ensureMember(userId, chatId);
    if (member.role !== ChatMemberRole.OWNER && member.role !== ChatMemberRole.ADMIN) {
      throw new ForbiddenException('Admin permissions required');
    }
    return member;
  }
}
