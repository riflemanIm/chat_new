import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { tokenStorage } from '../lib/storage';

const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export const http = axios.create({
  baseURL: apiUrl,
});

let refreshPromise: Promise<string | null> | null = null;
let onUnauthorized: (() => void) | null = null;

type RetriableConfig = InternalAxiosRequestConfig & { _retry?: boolean };

export function setUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler;
}

export function setAccessToken(accessToken: string | null) {
  if (accessToken) {
    http.defaults.headers.common.Authorization = `Bearer ${accessToken}`;
  } else {
    delete http.defaults.headers.common.Authorization;
  }
}

http.interceptors.request.use((config) => {
  const token = tokenStorage.getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

http.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as RetriableConfig | undefined;
    if (!config || error.response?.status !== 401 || config._retry || config.url?.includes('/auth/refresh')) {
      throw error;
    }

    const refreshToken = tokenStorage.getRefreshToken();
    if (!refreshToken) {
      onUnauthorized?.();
      throw error;
    }

    config._retry = true;
    refreshPromise ??= http
      .post('/auth/refresh', { refreshToken })
      .then((response) => {
        tokenStorage.setTokens(response.data.accessToken, response.data.refreshToken);
        setAccessToken(response.data.accessToken);
        return response.data.accessToken as string;
      })
      .catch(() => {
        tokenStorage.clear();
        setAccessToken(null);
        onUnauthorized?.();
        return null;
      })
      .finally(() => {
        refreshPromise = null;
      });

    const newToken = await refreshPromise;
    if (!newToken) {
      throw error;
    }
    config.headers.Authorization = `Bearer ${newToken}`;
    return http(config);
  },
);
