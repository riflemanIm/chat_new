import { Api } from '../types/api';
import { http } from './http';

export const api: Api = {
  auth: {
    register: (dto) => http.post('/auth/register', dto).then((r) => r.data),
    login: (dto) => http.post('/auth/login', dto).then((r) => r.data),
    refresh: (refreshToken) => http.post('/auth/refresh', { refreshToken }).then((r) => r.data),
    logout: (refreshToken) => http.post('/auth/logout', { refreshToken }).then((r) => r.data),
  },
  users: {
    me: () => http.get('/users/me').then((r) => r.data),
    updateMe: (dto) => http.patch('/users/me', dto).then((r) => r.data),
    search: (q) => http.get('/users/search', { params: { q } }).then((r) => r.data),
  },
  chats: {
    direct: (dto) => http.post('/chats/direct', dto).then((r) => r.data),
    group: (dto) => http.post('/chats/group', dto).then((r) => r.data),
    list: () => http.get('/chats').then((r) => r.data),
    one: (id) => http.get(`/chats/${id}`).then((r) => r.data),
    update: (id, dto) => http.patch(`/chats/${id}`, dto).then((r) => r.data),
    remove: (id) => http.delete(`/chats/${id}`).then((r) => r.data),
    addMembers: (id, userIds) => http.post(`/chats/${id}/members`, { userIds }).then((r) => r.data),
    removeMember: (id, userId) => http.delete(`/chats/${id}/members/${userId}`).then((r) => r.data),
  },
  messages: {
    create: (chatId, dto) => http.post(`/chats/${chatId}/messages`, dto).then((r) => r.data),
    list: (chatId, params) => http.get(`/chats/${chatId}/messages`, { params }).then((r) => r.data),
    update: (id, dto) => http.patch(`/messages/${id}`, dto).then((r) => r.data),
    remove: (id) => http.delete(`/messages/${id}`).then((r) => r.data),
    read: (id) => http.post(`/messages/${id}/read`).then((r) => r.data),
  },
};
