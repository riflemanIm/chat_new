export type User = {
  id: string;
  email: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  isOnline: boolean;
  lastSeenAt: string | null;
  createdAt?: string;
  updatedAt?: string;
};
