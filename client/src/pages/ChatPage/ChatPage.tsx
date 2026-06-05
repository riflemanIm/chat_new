import {
  Add,
  AttachFile,
  Check,
  Close,
  DarkMode,
  Delete,
  DoneAll,
  Edit,
  GroupAdd,
  Info,
  LightMode,
  Logout,
  Menu as MenuIcon,
  MoreVert,
  PersonAdd,
  Search,
  Send,
} from '@mui/icons-material';
import {
  Alert,
  Avatar,
  Badge,
  Box,
  Button,
  Card,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
  Grid,
  IconButton,
  InputAdornment,
  List,
  ListItemAvatar,
  ListItemButton,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  Skeleton,
  Snackbar,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Chat } from '../../entities/chat/types';
import { Message } from '../../entities/message/types';
import { User } from '../../entities/user/types';
import { useAuthStore } from '../../features/auth/auth.store';
import { useChatsStore } from '../../features/chats/chats.store';
import { useMessagesStore } from '../../features/messages/messages.store';
import { useSocketStore } from '../../features/socket/socket.store';
import { api } from '../../shared/api/client';
import { useDebouncedValue } from '../../shared/hooks/useDebouncedValue';
import { useThemeMode } from '../../shared/hooks/useThemeMode';
import { formatDateGroup, formatLastSeen, formatMessageTime } from '../../shared/lib/date';
import { getErrorMessage } from '../../shared/lib/errors';

export function ChatPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();
  const { mode, toggleMode } = useThemeMode();
  const { user, logout } = useAuthStore();
  const { socket, connected, connect, disconnect } = useSocketStore();
  const chatsStore = useChatsStore();
  const messagesStore = useMessagesStore();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [groupOpen, setGroupOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [groupTitle, setGroupTitle] = useState('');
  const [groupAvatar, setGroupAvatar] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [typingUsers, setTypingUsers] = useState<Record<string, string[]>>({});
  const [snackbar, setSnackbar] = useState<string | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [activeMessage, setActiveMessage] = useState<Message | null>(null);
  const debouncedQuery = useDebouncedValue(query);
  const selectedChat = useMemo(
    () => chatsStore.chats.find((chat) => chat.id === chatsStore.selectedChatId) ?? null,
    [chatsStore.chats, chatsStore.selectedChatId],
  );
  const messages = selectedChat ? messagesStore.byChat[selectedChat.id]?.items ?? [] : [];
  const messagesLoading = selectedChat ? messagesStore.byChat[selectedChat.id]?.loading : false;
  const nextCursor = selectedChat ? messagesStore.byChat[selectedChat.id]?.nextCursor : null;
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    void chatsStore.loadChats();
    connect();
    return () => disconnect();
  }, []);

  useEffect(() => {
    if (selectedChat) {
      void messagesStore.load(selectedChat.id, true);
      if (isMobile) setDrawerOpen(false);
    }
  }, [selectedChat?.id]);

  useEffect(() => {
    if (debouncedQuery) {
      void chatsStore.searchUsers(debouncedQuery).catch((err) => setSnackbar(getErrorMessage(err)));
    }
  }, [debouncedQuery]);

  useEffect(() => {
    if (!socket) return;
    const onNew = (message: Message) => messagesStore.upsert(message.chatId, message);
    const onUpdated = (message: Message) => messagesStore.upsert(message.chatId, message);
    const onDeleted = ({ chatId, messageId }: { chatId: string; messageId: string }) => messagesStore.softDelete(chatId, messageId);
    const onChatUpdated = (payload: Chat | { chatId: string }) => {
      if ('id' in payload) chatsStore.upsertChat(payload);
      void chatsStore.loadChats();
    };
    const onChatDeleted = ({ chatId }: { chatId: string }) => chatsStore.removeChat(chatId);
    const onStatus = (payload: { messageId: string; userId: string; status: 'SENT' | 'DELIVERED' | 'READ' }) =>
      messagesStore.applyStatus(payload);
    const onTypingStart = ({ chatId, userId }: { chatId: string; userId: string }) =>
      setTypingUsers((current) => ({ ...current, [chatId]: [...new Set([...(current[chatId] ?? []), userId])] }));
    const onTypingStop = ({ chatId, userId }: { chatId: string; userId: string }) =>
      setTypingUsers((current) => ({ ...current, [chatId]: (current[chatId] ?? []).filter((id) => id !== userId) }));

    socket.on('message:new', onNew);
    socket.on('message:updated', onUpdated);
    socket.on('message:deleted', onDeleted);
    socket.on('chat:updated', onChatUpdated);
    socket.on('chat:deleted', onChatDeleted);
    socket.on('message:read', onStatus);
    socket.on('message:delivered', onStatus);
    socket.on('typing:start', onTypingStart);
    socket.on('typing:stop', onTypingStop);
    socket.on('user:status', () => void chatsStore.loadChats());
    return () => {
      socket.off('message:new', onNew);
      socket.off('message:updated', onUpdated);
      socket.off('message:deleted', onDeleted);
      socket.off('chat:updated', onChatUpdated);
      socket.off('chat:deleted', onChatDeleted);
      socket.off('message:read', onStatus);
      socket.off('message:delivered', onStatus);
      socket.off('typing:start', onTypingStart);
      socket.off('typing:stop', onTypingStop);
      socket.off('user:status');
    };
  }, [socket, chatsStore, messagesStore]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
    messages
      .filter((message) => message.senderId !== user?.id)
      .slice(-10)
      .forEach((message) => void messagesStore.markRead(message.id).catch(() => undefined));
  }, [messages.length, selectedChat?.id]);

  const chatTitle = selectedChat ? getChatTitle(selectedChat, user?.id) : '';
  const typing = selectedChat ? (typingUsers[selectedChat.id] ?? []).filter((id) => id !== user?.id) : [];

  async function sendMessage() {
    if (!selectedChat || !user || !messageText.trim()) return;
    const text = messageText.trim();
    setMessageText('');
    socket?.emit('typing:stop', { chatId: selectedChat.id });
    try {
      await messagesStore.send(selectedChat.id, user.id, text);
    } catch (err) {
      setSnackbar(getErrorMessage(err));
    }
  }

  const sidebar = (
    <Paper sx={{ height: '100%', borderRadius: 0, display: 'flex', flexDirection: 'column' }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Avatar src={user?.avatarUrl ?? undefined}>{user?.username?.[0]?.toUpperCase()}</Avatar>
          <Stack minWidth={0}>
            <Typography fontWeight={700} noWrap>
              {user?.displayName || user?.username}
            </Typography>
            <Typography variant="caption" color={connected ? 'success.main' : 'text.secondary'}>
              {connected ? 'socket connected' : 'socket offline'}
            </Typography>
          </Stack>
        </Stack>
        <Stack direction="row">
          <IconButton onClick={() => setSearchOpen(true)}>
            <PersonAdd />
          </IconButton>
          <IconButton onClick={() => setGroupOpen(true)}>
            <GroupAdd />
          </IconButton>
        </Stack>
      </Stack>
      <List sx={{ overflowY: 'auto', flex: 1 }}>
        {chatsStore.loading &&
          [1, 2, 3].map((item) => (
            <Stack key={item} direction="row" spacing={2} sx={{ p: 2 }}>
              <Skeleton variant="circular" width={40} height={40} />
              <Stack flex={1}>
                <Skeleton width="60%" />
                <Skeleton width="90%" />
              </Stack>
            </Stack>
          ))}
        {!chatsStore.loading && chatsStore.chats.length === 0 && (
          <Stack alignItems="center" spacing={1} sx={{ p: 4 }}>
            <Typography color="text.secondary">No chats yet</Typography>
            <Button startIcon={<Add />} onClick={() => setSearchOpen(true)}>
              Start chat
            </Button>
          </Stack>
        )}
        {chatsStore.chats.map((chat) => {
          const title = getChatTitle(chat, user?.id);
          const last = chat.messages?.[0];
          return (
            <ListItemButton
              key={chat.id}
              selected={chat.id === selectedChat?.id}
              onClick={() => chatsStore.selectChat(chat.id)}
              sx={{ py: 1.5 }}
            >
              <ListItemAvatar>
                <Badge color="success" variant="dot" invisible={!isChatOnline(chat, user?.id)}>
                  <Avatar src={chat.avatarUrl ?? undefined}>{title[0]?.toUpperCase()}</Avatar>
                </Badge>
              </ListItemAvatar>
              <ListItemText
                primary={<Typography noWrap>{title}</Typography>}
                secondary={<Typography noWrap variant="body2">{last?.deletedAt ? 'Message deleted' : last?.text || 'Attachment'}</Typography>}
              />
              {!!chat.unreadCount && <Badge color="primary" badgeContent={chat.unreadCount} />}
            </ListItemButton>
          );
        })}
      </List>
      <Stack direction="row" justifyContent="space-between" sx={{ p: 1, borderTop: 1, borderColor: 'divider' }}>
        <IconButton component={Link} to="/profile">
          <Info />
        </IconButton>
        <IconButton onClick={toggleMode}>{mode === 'light' ? <DarkMode /> : <LightMode />}</IconButton>
        <IconButton
          onClick={async () => {
            await logout();
            navigate('/login', { replace: true });
          }}
        >
          <Logout />
        </IconButton>
      </Stack>
    </Paper>
  );

  return (
    <Box sx={{ height: '100vh', bgcolor: 'background.default', overflow: 'hidden' }}>
      <Grid container sx={{ height: '100%' }}>
        {!isMobile && (
          <Grid item xs={12} md={4} lg={3} sx={{ height: '100%', borderRight: 1, borderColor: 'divider' }}>
            {sidebar}
          </Grid>
        )}
        <Grid item xs={12} md={8} lg={9} sx={{ height: '100%' }}>
          <Stack sx={{ height: '100%' }}>
            <Paper sx={{ p: 1.5, borderRadius: 0, borderBottom: 1, borderColor: 'divider' }}>
              <Stack direction="row" alignItems="center" spacing={1.5}>
                {isMobile && (
                  <IconButton onClick={() => setDrawerOpen(true)}>
                    <MenuIcon />
                  </IconButton>
                )}
                {selectedChat ? (
                  <>
                    <Avatar src={selectedChat.avatarUrl ?? undefined}>{chatTitle[0]?.toUpperCase()}</Avatar>
                    <Stack flex={1} minWidth={0}>
                      <Typography fontWeight={700} noWrap>
                        {chatTitle}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {typing.length ? 'typing...' : selectedChat.type === 'GROUP' ? `${selectedChat.members.length} members` : getDirectStatus(selectedChat, user?.id)}
                      </Typography>
                    </Stack>
                    <IconButton onClick={() => setInfoOpen(true)}>
                      <Info />
                    </IconButton>
                  </>
                ) : (
                  <Typography fontWeight={700}>Select a chat</Typography>
                )}
              </Stack>
            </Paper>
            <Box ref={listRef} sx={{ flex: 1, overflowY: 'auto', p: { xs: 1.5, md: 3 } }}>
              {!selectedChat && (
                <Stack height="100%" alignItems="center" justifyContent="center">
                  <Typography color="text.secondary">Choose a chat or start a new conversation</Typography>
                </Stack>
              )}
              {selectedChat && messagesLoading && <CircularProgress />}
              {selectedChat && !messagesLoading && messages.length === 0 && (
                <Stack height="100%" alignItems="center" justifyContent="center">
                  <Typography color="text.secondary">No messages</Typography>
                </Stack>
              )}
              <Stack spacing={1.5}>
                {selectedChat && nextCursor && (
                  <Button
                    variant="text"
                    disabled={messagesLoading}
                    onClick={() => void messagesStore.load(selectedChat.id).catch((err) => setSnackbar(getErrorMessage(err)))}
                    sx={{ alignSelf: 'center' }}
                  >
                    Load older
                  </Button>
                )}
                {messages.map((message, index) => {
                  const mine = message.senderId === user?.id;
                  const previous = messages[index - 1];
                  const showDate = !previous || formatDateGroup(previous.createdAt) !== formatDateGroup(message.createdAt);
                  return (
                    <Fragment key={message.id}>
                      {showDate && (
                        <Typography align="center" variant="caption" color="text.secondary" sx={{ py: 1 }}>
                          {formatDateGroup(message.createdAt)}
                        </Typography>
                      )}
                      <Stack direction="row" justifyContent={mine ? 'flex-end' : 'flex-start'}>
                        <Card
                          sx={{
                            maxWidth: { xs: '86%', md: '62%' },
                            p: 1.25,
                            bgcolor: mine ? 'primary.main' : 'background.paper',
                            color: mine ? 'primary.contrastText' : 'text.primary',
                          }}
                        >
                          {!mine && selectedChat.type === 'GROUP' && (
                            <Typography variant="caption" fontWeight={700}>
                              {message.sender?.displayName || message.sender?.username}
                            </Typography>
                          )}
                          <Typography sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                            {message.deletedAt ? 'Message deleted' : message.text}
                          </Typography>
                          {message.attachments?.map((attachment) => (
                            <Button
                              key={attachment.id ?? attachment.url}
                              href={attachment.url}
                              target="_blank"
                              variant="text"
                              startIcon={<AttachFile />}
                              sx={{ color: mine ? 'inherit' : 'primary.main', px: 0 }}
                            >
                              {attachment.fileName || attachment.url}
                            </Button>
                          ))}
                          <Stack direction="row" spacing={0.5} justifyContent="flex-end" alignItems="center">
                            <Typography variant="caption" sx={{ opacity: 0.8 }}>
                              {message.optimistic ? 'sending' : formatMessageTime(message.createdAt)}
                            </Typography>
                            {mine && statusIcon(message)}
                            {mine && !message.deletedAt && (
                              <IconButton
                                size="small"
                                onClick={(event) => {
                                  setActiveMessage(message);
                                  setMenuAnchor(event.currentTarget);
                                }}
                                sx={{ color: 'inherit', p: 0.25 }}
                              >
                                <MoreVert fontSize="small" />
                              </IconButton>
                            )}
                          </Stack>
                        </Card>
                      </Stack>
                    </Fragment>
                  );
                })}
              </Stack>
            </Box>
            <Paper sx={{ p: 1.5, borderRadius: 0, borderTop: 1, borderColor: 'divider' }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <IconButton
                  disabled={!selectedChat}
                  onClick={() => {
                    const url = window.prompt('Attachment URL');
                    if (!url || !selectedChat || !user) return;
                    void messagesStore.send(selectedChat.id, user.id, '', [{ url }]).catch((err) => setSnackbar(getErrorMessage(err)));
                  }}
                >
                  <AttachFile />
                </IconButton>
                <TextField
                  fullWidth
                  disabled={!selectedChat}
                  value={messageText}
                  placeholder="Message"
                  onChange={(event) => {
                    setMessageText(event.target.value);
                    if (selectedChat) socket?.emit('typing:start', { chatId: selectedChat.id });
                  }}
                  onBlur={() => selectedChat && socket?.emit('typing:stop', { chatId: selectedChat.id })}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      void sendMessage();
                    }
                  }}
                />
                <IconButton color="primary" disabled={!messageText.trim()} onClick={() => void sendMessage()}>
                  <Send />
                </IconButton>
              </Stack>
            </Paper>
          </Stack>
        </Grid>
      </Grid>
      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} sx={{ display: { md: 'none' } }}>
        <Box width={330} maxWidth="90vw" height="100vh">
          {sidebar}
        </Box>
      </Drawer>
      <UserSearchDialog open={searchOpen || groupOpen} groupMode={groupOpen} query={query} setQuery={setQuery} selectedUsers={selectedUsers} setSelectedUsers={setSelectedUsers} groupTitle={groupTitle} setGroupTitle={setGroupTitle} groupAvatar={groupAvatar} setGroupAvatar={setGroupAvatar} onClose={() => { setSearchOpen(false); setGroupOpen(false); setSelectedUsers([]); }} />
      <ChatInfoDialog open={infoOpen} chat={selectedChat} currentUserId={user?.id} onClose={() => setInfoOpen(false)} />
      <Menu anchorEl={menuAnchor} open={!!menuAnchor} onClose={() => setMenuAnchor(null)}>
        <MenuItem
          onClick={() => {
            const next = window.prompt('Edit message', activeMessage?.text ?? '');
            setMenuAnchor(null);
            if (activeMessage && next?.trim()) void messagesStore.edit(activeMessage.id, next.trim()).catch((err) => setSnackbar(getErrorMessage(err)));
          }}
        >
          <Edit fontSize="small" /> Edit
        </MenuItem>
        <MenuItem
          onClick={() => {
            setMenuAnchor(null);
            if (activeMessage) void messagesStore.deleteMessage(activeMessage.id, activeMessage.chatId).catch((err) => setSnackbar(getErrorMessage(err)));
          }}
        >
          <Delete fontSize="small" /> Delete
        </MenuItem>
      </Menu>
      <Snackbar open={!!snackbar} autoHideDuration={4000} onClose={() => setSnackbar(null)}>
        <Alert severity="error">{snackbar}</Alert>
      </Snackbar>
    </Box>
  );
}

function UserSearchDialog(props: {
  open: boolean;
  groupMode: boolean;
  query: string;
  setQuery: (value: string) => void;
  selectedUsers: string[];
  setSelectedUsers: (value: string[]) => void;
  groupTitle: string;
  setGroupTitle: (value: string) => void;
  groupAvatar: string;
  setGroupAvatar: (value: string) => void;
  onClose: () => void;
}) {
  const chats = useChatsStore();
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    try {
      if (props.groupMode) {
        await chats.createGroup(props.groupTitle, props.selectedUsers, props.groupAvatar || undefined);
      } else if (props.selectedUsers[0]) {
        await chats.createDirect(props.selectedUsers[0]);
      }
      props.onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  return (
    <Dialog open={props.open} onClose={props.onClose} fullWidth maxWidth="sm">
      <DialogTitle>{props.groupMode ? 'Create group' : 'Start direct chat'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          {props.groupMode && (
            <>
              <TextField label="Group title" value={props.groupTitle} onChange={(e) => props.setGroupTitle(e.target.value)} />
              <TextField label="Avatar URL" value={props.groupAvatar} onChange={(e) => props.setGroupAvatar(e.target.value)} />
            </>
          )}
          <TextField
            label="Search users"
            value={props.query}
            onChange={(event) => props.setQuery(event.target.value)}
            InputProps={{ startAdornment: <InputAdornment position="start"><Search /></InputAdornment> }}
          />
          <List>
            {chats.searchResults.map((user) => {
              const selected = props.selectedUsers.includes(user.id);
              return (
                <ListItemButton
                  key={user.id}
                  selected={selected}
                  onClick={() =>
                    props.groupMode
                      ? props.setSelectedUsers(selected ? props.selectedUsers.filter((id) => id !== user.id) : [...props.selectedUsers, user.id])
                      : props.setSelectedUsers([user.id])
                  }
                >
                  <ListItemAvatar><Avatar src={user.avatarUrl ?? undefined}>{user.username[0]?.toUpperCase()}</Avatar></ListItemAvatar>
                  <ListItemText primary={user.displayName || user.username} secondary={user.email} />
                  {selected && <Check />}
                </ListItemButton>
              );
            })}
          </List>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button variant="text" onClick={props.onClose}>Cancel</Button>
        <Button disabled={!props.selectedUsers.length || (props.groupMode && !props.groupTitle.trim())} onClick={() => void submit()}>
          Create
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function ChatInfoDialog({ open, chat, currentUserId, onClose }: { open: boolean; chat: Chat | null; currentUserId?: string; onClose: () => void }) {
  const chats = useChatsStore();
  const [title, setTitle] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [memberQuery, setMemberQuery] = useState('');
  const [memberResults, setMemberResults] = useState<User[]>([]);
  const [selectedNewMembers, setSelectedNewMembers] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const debouncedMemberQuery = useDebouncedValue(memberQuery);

  useEffect(() => {
    setTitle(chat?.title ?? '');
    setAvatarUrl(chat?.avatarUrl ?? '');
    setMemberQuery('');
    setMemberResults([]);
    setSelectedNewMembers([]);
  }, [chat?.id]);

  useEffect(() => {
    if (!debouncedMemberQuery.trim()) {
      setMemberResults([]);
      return;
    }
    void api.users
      .search(debouncedMemberQuery)
      .then((users) => setMemberResults(users.filter((user) => !chat?.members.some((member) => member.userId === user.id))))
      .catch((err) => setError(getErrorMessage(err)));
  }, [debouncedMemberQuery, chat?.id]);

  if (!chat) return null;
  const mine = chat.members.find((member) => member.userId === currentUserId);
  const canAdmin = mine?.role === 'OWNER' || mine?.role === 'ADMIN';

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Chat info</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          {chat.type === 'GROUP' && canAdmin && (
            <>
              <TextField label="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
              <TextField label="Avatar URL" value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} />
              <Button
                onClick={() =>
                  void chats.updateChat(chat.id, { title, avatarUrl: avatarUrl || undefined }).catch((err) => setError(getErrorMessage(err)))
                }
              >
                Save group
              </Button>
              <TextField label="Add members" value={memberQuery} onChange={(e) => setMemberQuery(e.target.value)} />
              {memberResults.map((user) => {
                const selected = selectedNewMembers.includes(user.id);
                return (
                  <ListItemButton
                    key={user.id}
                    selected={selected}
                    onClick={() =>
                      setSelectedNewMembers(selected ? selectedNewMembers.filter((id) => id !== user.id) : [...selectedNewMembers, user.id])
                    }
                  >
                    <ListItemAvatar><Avatar src={user.avatarUrl ?? undefined}>{user.username[0]?.toUpperCase()}</Avatar></ListItemAvatar>
                    <ListItemText primary={user.displayName || user.username} secondary={user.email} />
                    {selected && <Check />}
                  </ListItemButton>
                );
              })}
              <Button
                startIcon={<PersonAdd />}
                disabled={!selectedNewMembers.length}
                onClick={() =>
                  void chats
                    .addMembers(chat.id, selectedNewMembers)
                    .then(() => {
                      setSelectedNewMembers([]);
                      setMemberQuery('');
                      setMemberResults([]);
                    })
                    .catch((err) => setError(getErrorMessage(err)))
                }
              >
                Add selected
              </Button>
            </>
          )}
          <Typography fontWeight={700}>Members</Typography>
          {chat.members.map((member) => (
            <Stack key={member.id} direction="row" alignItems="center" spacing={1}>
              <Avatar src={member.user.avatarUrl ?? undefined}>{member.user.username[0]?.toUpperCase()}</Avatar>
              <Box flex={1}>
                <Typography>{member.user.displayName || member.user.username}</Typography>
                <Typography variant="caption" color={member.user.isOnline ? 'success.main' : 'text.secondary'}>
                  {member.user.isOnline ? 'online' : formatLastSeen(member.user.lastSeenAt)}
                </Typography>
              </Box>
              <Typography variant="caption">{member.role}</Typography>
              {chat.type === 'GROUP' && canAdmin && member.userId !== currentUserId && (
                <IconButton onClick={() => void chats.removeMember(chat.id, member.userId).catch((err) => setError(getErrorMessage(err)))}>
                  <Close />
                </IconButton>
              )}
            </Stack>
          ))}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button variant="text" onClick={onClose}>Close</Button>
        {chat.type === 'GROUP' && (
          <Button color="warning" onClick={() => void chats.removeMember(chat.id, currentUserId ?? '').then(onClose).catch((err) => setError(getErrorMessage(err)))}>
            Leave
          </Button>
        )}
        <Button color="error" onClick={() => void chats.deleteChat(chat.id).then(onClose).catch((err) => setError(getErrorMessage(err)))}>
          Delete chat
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function getChatTitle(chat: Chat, currentUserId?: string) {
  if (chat.type === 'GROUP') return chat.title || 'Group chat';
  const other = chat.members.find((member) => member.userId !== currentUserId)?.user;
  return other?.displayName || other?.username || 'Direct chat';
}

function isChatOnline(chat: Chat, currentUserId?: string) {
  return chat.type === 'DIRECT' && !!chat.members.find((member) => member.userId !== currentUserId)?.user.isOnline;
}

function getDirectStatus(chat: Chat, currentUserId?: string) {
  const other = chat.members.find((member) => member.userId !== currentUserId)?.user;
  if (!other) return '';
  return other.isOnline ? 'online' : formatLastSeen(other.lastSeenAt);
}

function statusIcon(message: Message) {
  const statuses = message.statuses.map((item) => item.status);
  if (statuses.includes('READ')) return <DoneAll fontSize="inherit" />;
  if (statuses.includes('DELIVERED')) return <DoneAll fontSize="inherit" />;
  return <Check fontSize="inherit" />;
}
