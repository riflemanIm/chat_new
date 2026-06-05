import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Button, Stack, TextField, Typography } from '@mui/material';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useAuthStore } from '../../features/auth/auth.store';
import { getErrorMessage } from '../../shared/lib/errors';
import { AuthLayout } from '../../shared/ui/AuthLayout';

const schema = z.object({
  email: z.string().email(),
  username: z.string().min(3),
  displayName: z.string().optional(),
  password: z.string().min(6),
});

type FormValues = z.infer<typeof schema>;

export function RegisterPage() {
  const navigate = useNavigate();
  const register = useAuthStore((state) => state.register);
  const loading = useAuthStore((state) => state.loading);
  const [error, setError] = useState<string | null>(null);
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', username: '', displayName: '', password: '' },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    try {
      await register({ ...values, displayName: values.displayName || undefined });
      navigate('/', { replace: true });
    } catch (err) {
      setError(getErrorMessage(err));
    }
  });

  return (
    <AuthLayout title="Create account" subtitle="Start messaging with your team">
      <Stack component="form" spacing={2} onSubmit={onSubmit}>
        {error && <Alert severity="error">{error}</Alert>}
        <Controller
          name="email"
          control={form.control}
          render={({ field, fieldState }) => (
            <TextField {...field} label="Email" error={!!fieldState.error} helperText={fieldState.error?.message} />
          )}
        />
        <Controller
          name="username"
          control={form.control}
          render={({ field, fieldState }) => (
            <TextField {...field} label="Username" error={!!fieldState.error} helperText={fieldState.error?.message} />
          )}
        />
        <Controller name="displayName" control={form.control} render={({ field }) => <TextField {...field} label="Display name" />} />
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
          Register
        </Button>
        <Typography variant="body2" color="text.secondary">
          Already registered? <Link to="/login">Sign in</Link>
        </Typography>
      </Stack>
    </AuthLayout>
  );
}
