import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowBack, DarkMode, LightMode, Logout } from '@mui/icons-material';
import { Alert, Avatar, Box, Button, IconButton, Paper, Stack, TextField, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useAuthStore } from '../../features/auth/auth.store';
import { getErrorMessage } from '../../shared/lib/errors';
import { formatLastSeen } from '../../shared/lib/date';
import { useThemeMode } from '../../shared/hooks/useThemeMode';

const schema = z.object({
  username: z.string().min(3),
  displayName: z.string().optional(),
  avatarUrl: z.string().url().optional().or(z.literal('')),
});

type FormValues = z.infer<typeof schema>;

export function ProfilePage() {
  const navigate = useNavigate();
  const { mode, toggleMode } = useThemeMode();
  const { user, updateProfile, logout } = useAuthStore();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { username: '', displayName: '', avatarUrl: '' },
  });

  useEffect(() => {
    if (user) {
      form.reset({
        username: user.username,
        displayName: user.displayName ?? '',
        avatarUrl: user.avatarUrl ?? '',
      });
    }
  }, [form, user]);

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    setSuccess(false);
    try {
      await updateProfile({
        username: values.username,
        displayName: values.displayName || undefined,
        avatarUrl: values.avatarUrl || undefined,
      });
      setSuccess(true);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  });

  return (
    <Box minHeight="100vh" sx={{ bgcolor: 'background.default', p: { xs: 2, md: 4 } }}>
      <Paper sx={{ maxWidth: 720, mx: 'auto', p: 3 }}>
        <Stack spacing={3}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <IconButton component={Link} to="/">
              <ArrowBack />
            </IconButton>
            <Stack direction="row" spacing={1}>
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
          </Stack>
          <Stack direction="row" spacing={2} alignItems="center">
            <Avatar src={user?.avatarUrl ?? undefined} sx={{ width: 72, height: 72 }}>
              {user?.username?.[0]?.toUpperCase()}
            </Avatar>
            <Stack>
              <Typography variant="h5" fontWeight={700}>
                {user?.displayName || user?.username}
              </Typography>
              <Typography color={user?.isOnline ? 'success.main' : 'text.secondary'}>
                {user?.isOnline ? 'online' : formatLastSeen(user?.lastSeenAt ?? null)}
              </Typography>
            </Stack>
          </Stack>
          <Stack component="form" spacing={2} onSubmit={onSubmit}>
            {error && <Alert severity="error">{error}</Alert>}
            {success && <Alert severity="success">Profile updated</Alert>}
            <Controller
              name="username"
              control={form.control}
              render={({ field, fieldState }) => (
                <TextField {...field} label="Username" error={!!fieldState.error} helperText={fieldState.error?.message} />
              )}
            />
            <Controller name="displayName" control={form.control} render={({ field }) => <TextField {...field} label="Display name" />} />
            <Controller
              name="avatarUrl"
              control={form.control}
              render={({ field, fieldState }) => (
                <TextField {...field} label="Avatar URL" error={!!fieldState.error} helperText={fieldState.error?.message} />
              )}
            />
            <Button type="submit" sx={{ alignSelf: 'flex-start' }}>
              Save
            </Button>
          </Stack>
        </Stack>
      </Paper>
    </Box>
  );
}
