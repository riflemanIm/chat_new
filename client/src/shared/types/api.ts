import { Chat } from '../../entities/chat/types';
import { Message, MessageAttachment, MessagesPage } from '../../entities/message/types';
import { User } from '../../entities/user/types';

export type AuthResponse = {
  accessToken: string;
  refreshToken: string;
  user: User;
};

export type RegisterDto = {
  email: string;
  username: string;
  displayName?: string;
  password: string;
};

export type LoginDto = {
  login: string;
  password: string;
};

export type UpdateMeDto = {
  username?: string;
  displayName?: string;
  avatarUrl?: string;
};

export type CreateDirectChatDto = {
  userId: string;
};

export type CreateGroupChatDto = {
  title: string;
  avatarUrl?: string;
  memberIds: string[];
};

export type UpdateChatDto = {
  title?: string;
  avatarUrl?: string;
};

export type CreateMessageDto = {
  text?: string;
  attachments?: MessageAttachment[];
};

export type UpdateMessageDto = {
  text: string;
};

export type Api = {
  auth: {
    register(dto: RegisterDto): Promise<AuthResponse>;
    login(dto: LoginDto): Promise<AuthResponse>;
    refresh(refreshToken: string): Promise<AuthResponse>;
    logout(refreshToken: string): Promise<{ success: boolean }>;
  };
  users: {
    me(): Promise<User>;
    updateMe(dto: UpdateMeDto): Promise<User>;
    search(q: string): Promise<User[]>;
  };
  chats: {
    direct(dto: CreateDirectChatDto): Promise<Chat>;
    group(dto: CreateGroupChatDto): Promise<Chat>;
    list(): Promise<Chat[]>;
    one(id: string): Promise<Chat>;
    update(id: string, dto: UpdateChatDto): Promise<Chat>;
    remove(id: string): Promise<{ success: boolean }>;
    addMembers(id: string, userIds: string[]): Promise<Chat>;
    removeMember(id: string, userId: string): Promise<{ success: boolean }>;
  };
  messages: {
    create(chatId: string, dto: CreateMessageDto): Promise<Message>;
    list(chatId: string, params?: { limit?: number; cursor?: string | null }): Promise<MessagesPage>;
    update(id: string, dto: UpdateMessageDto): Promise<Message>;
    remove(id: string): Promise<{ success: boolean }>;
    read(id: string): Promise<unknown>;
  };
};
