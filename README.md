## Chat Backend

Backend-проект на NestJS для чата: REST API, Socket.IO realtime, JWT access/refresh tokens, PostgreSQL и Prisma.

Frontend-клиент находится в `client`. Инструкции запуска: `client/README.md`.

### Стек

- NestJS, TypeScript
- PostgreSQL
- Prisma ORM и миграции
- Socket.IO
- JWT auth
- Swagger

### Запуск

```bash
cd server
cp .env.example .env
npm install
docker compose up -d
npm run prisma:deploy
npm run prisma:generate
npm run seed
npm run start:dev
```

API будет доступен на `http://localhost:3000`, Swagger-документация на `http://localhost:3000/docs`.

Seed-пользователи:

- `alice@example.com` / `password123`
- `bob@example.com` / `password123`
- `charlie@example.com` / `password123`

### REST API

Auth:

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`

Users:

- `GET /users/me`
- `PATCH /users/me`
- `GET /users/search`

Chats:

- `POST /chats/direct`
- `POST /chats/group`
- `GET /chats`
- `GET /chats/:id`
- `PATCH /chats/:id`
- `DELETE /chats/:id`
- `POST /chats/:id/members`
- `DELETE /chats/:id/members/:userId`

Messages:

- `POST /chats/:chatId/messages`
- `GET /chats/:chatId/messages?limit=30&cursor=<messageId>`
- `PATCH /messages/:id`
- `DELETE /messages/:id`
- `POST /messages/:id/read`

### Socket.IO

Подключение:

```ts
io('http://localhost:3000', {
  auth: { token: accessToken },
});
```

События от клиента:

- `message:send` `{ chatId, text?, attachments? }`
- `typing:start` `{ chatId }`
- `typing:stop` `{ chatId }`
- `message:read` `{ messageId }`
- `message:delivered` `{ messageId }`

События от сервера:

- `message:new`
- `message:updated`
- `message:deleted`
- `message:read`
- `message:delivered`
- `typing:start`
- `typing:stop`
- `user:status`
- `chat:updated`
- `chat:deleted`

### Схема БД и связи

Таблицы:

- `users`
- `chats`
- `chat_members`
- `messages`
- `message_attachments`
- `message_statuses`
- `refresh_tokens`

Связи:

- пользователь может состоять во многих чатах через `chat_members`;
- чат может иметь много участников через `chat_members`;
- чат может иметь много сообщений;
- сообщение принадлежит одному пользователю-отправителю и одному чату;
- сообщение может иметь много вложений;
- сообщение имеет отдельный статус `SENT`, `DELIVERED` или `READ` для каждого участника чата.

### Права доступа

Все endpoints, кроме `/auth/register`, `/auth/login` и `/auth/refresh`, защищены JWT guard. Сервисы проверяют членство в чате перед чтением/отправкой сообщений, права администратора перед управлением группой и право автора или администратора перед удалением сообщения.
