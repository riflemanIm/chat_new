import { Box, Paper, Stack, Typography } from '@mui/material';
import { ReactNode } from 'react';

export function AuthLayout({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <Box minHeight="100vh" display="grid" sx={{ placeItems: 'center', px: 2, bgcolor: 'background.default' }}>
      <Paper sx={{ width: '100%', maxWidth: 420, p: 3 }}>
        <Stack spacing={3}>
          <Stack spacing={0.5}>
            <Typography variant="h4" fontWeight={700}>
              {title}
            </Typography>
            <Typography color="text.secondary">{subtitle}</Typography>
          </Stack>
          {children}
        </Stack>
      </Paper>
    </Box>
  );
}
