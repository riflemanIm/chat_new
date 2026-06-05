import { create } from 'zustand';
import { api } from '../../shared/api/client';
import { setAccessToken, setUnauthorizedHandler } from '../../shared/api/http';
import { tokenStorage } from '../../shared/lib/storage';
import { AuthResponse, LoginDto, RegisterDto, UpdateMeDto } from '../../shared/types/api';
import { User } from '../../entities/user/types';

type AuthState = {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  initialized: boolean;
  loading: boolean;
  login(dto: LoginDto): Promise<void>;
  register(dto: RegisterDto): Promise<void>;
  restoreSession(): Promise<void>;
  updateProfile(dto: UpdateMeDto): Promise<void>;
  logout(): Promise<void>;
  applyAuth(response: AuthResponse): void;
  clearAuth(): void;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: tokenStorage.getAccessToken(),
  refreshToken: tokenStorage.getRefreshToken(),
  initialized: false,
  loading: false,
  applyAuth: (response) => {
    tokenStorage.setTokens(response.accessToken, response.refreshToken);
    setAccessToken(response.accessToken);
    set({ user: response.user, accessToken: response.accessToken, refreshToken: response.refreshToken });
  },
  clearAuth: () => {
    tokenStorage.clear();
    setAccessToken(null);
    set({ user: null, accessToken: null, refreshToken: null });
  },
  login: async (dto) => {
    set({ loading: true });
    try {
      get().applyAuth(await api.auth.login(dto));
    } finally {
      set({ loading: false });
    }
  },
  register: async (dto) => {
    set({ loading: true });
    try {
      get().applyAuth(await api.auth.register(dto));
    } finally {
      set({ loading: false });
    }
  },
  restoreSession: async () => {
    const refreshToken = tokenStorage.getRefreshToken();
    const accessToken = tokenStorage.getAccessToken();
    setAccessToken(accessToken);
    if (!refreshToken) {
      set({ initialized: true });
      return;
    }
    try {
      const response = await api.auth.refresh(refreshToken);
      get().applyAuth(response);
    } catch {
      get().clearAuth();
    } finally {
      set({ initialized: true });
    }
  },
  updateProfile: async (dto) => {
    const user = await api.users.updateMe(dto);
    set({ user });
  },
  logout: async () => {
    const refreshToken = get().refreshToken;
    try {
      if (refreshToken) {
        await api.auth.logout(refreshToken);
      }
    } finally {
      get().clearAuth();
    }
  },
}));

setUnauthorizedHandler(() => useAuthStore.getState().clearAuth());
