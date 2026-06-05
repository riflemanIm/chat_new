import { Message } from '../message/types';
import { User } from '../user/types';

export type ChatType = 'DIRECT' | 'GROUP';
export type ChatMemberRole = 'OWNER' | 'ADMIN' | 'MEMBER';

export type ChatMember = {
  id: string;
  chatId: string;
  userId: string;
  role: ChatMemberRole;
  joinedAt: string;
  leftAt: string | null;
  user: User;
};

export type Chat = {
  id: string;
  type: ChatType;
  title: string | null;
  avatarUrl: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  members: ChatMember[];
  messages?: Message[];
  unreadCount?: number;
};
