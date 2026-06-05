## Chat Client

React + TypeScript + Vite frontend for the NestJS chat backend.

### Stack

- React, TypeScript, Vite
- MUI
- React Router
- React Hook Form + Zod
- Axios
- Socket.IO Client
- Zustand

### Run

```bash
cd client
cp .env.example .env
yarn
yarn dev
```

Default URLs:

```env
VITE_API_URL=http://localhost:3000
VITE_SOCKET_URL=http://localhost:3000
```

If the backend runs on another port, update both values in `.env`.

### Features

- Login, registration, session restore by refresh token and logout.
- Protected routes and Axios authorization interceptor.
- Automatic access token refresh.
- Profile page with username, display name and avatar editing.
- Messenger layout with chat list, selected chat header, messages area and composer.
- Direct chat creation, group chat creation, group edit, member add/remove, leave and delete.
- Message loading, optimistic sending, editing, soft delete state and attachment URLs.
- Socket.IO realtime events for new messages, chat updates, typing, online status and receipts.
- Light/dark theme switch, responsive drawer on mobile, loading, empty and error states.
