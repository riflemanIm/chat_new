import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Button, Stack, TextField, Typography } from '@mui/material';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useAuthStore } from '../../features/auth/auth.store';
import { getErrorMessage } from '../../shared/lib/errors';
import { AuthLayout } from '../../shared/ui/AuthLayout';

const schema = z.object({
  login: z.string().min(3),
  password: z.string().min(6),
});

type FormValues = z.infer<typeof schema>;

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const login = useAuthStore((state) => state.login);
  const loading = useAuthStore((state) => state.loading);
  const [error, setError] = useState<string | null>(null);
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { login: '', password: '' },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    try {
      await login(values);
      const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? '/';
      navigate(from, { replace: true });
    } catch (err) {
      setError(getErrorMessage(err));
    }
  });

  return (
    <AuthLayout title="Sign in" subtitle="Open your chat workspace">
      <Stack component="form" spacing={2} onSubmit={onSubmit}>
        {error && <Alert severity="error">{error}</Alert>}
        <Controller
          name="login"
          control={form.control}
          render={({ field, fieldState }) => (
            <TextField {...field} label="Email or username" error={!!fieldState.error} helperText={fieldState.error?.message} />
          )}
        />
        <Controller
          name="password"
          control={form.control}
          render={({ field, fieldState }) => (
            <TextField
              {...field}
              type="password"
              label="Password"
              error={!!fieldState.error}
              helperText={fieldState.error?.message}
            />
          )}
        />
        <Button type="submit" disabled={loading}>
          Sign in
        </Button>
        <Typography variant="body2" color="text.secondary">
          No account? <Link to="/register">Create one</Link>
        </Typography>
      </Stack>
    </AuthLayout>
  );
}
