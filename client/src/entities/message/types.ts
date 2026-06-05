import { User } from '../user/types';

export type MessageStatusValue = 'SENT' | 'DELIVERED' | 'READ';

export type MessageAttachment = {
  id?: string;
  messageId?: string;
  url: string;
  fileName?: string | null;
  mimeType?: string | null;
  size?: number | null;
  createdAt?: string;
};

export type MessageStatusRecord = {
  id: string;
  messageId: string;
  userId: string;
  status: MessageStatusValue;
  createdAt: string;
  updatedAt: string;
};

export type Message = {
  id: string;
  chatId: string;
  senderId: string;
  type: 'TEXT';
  text: string | null;
  createdAt: string;
  updatedAt: string;
  editedAt: string | null;
  deletedAt: string | null;
  sender?: Pick<User, 'id' | 'username' | 'displayName' | 'avatarUrl'>;
  attachments: MessageAttachment[];
  statuses: MessageStatusRecord[];
  optimistic?: boolean;
};

export type MessagesPage = {
  items: Message[];
  nextCursor: string | null;
};
