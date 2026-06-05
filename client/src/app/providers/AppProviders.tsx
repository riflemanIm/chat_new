import { CssBaseline } from '@mui/material';
import { ThemeProvider } from '@mui/material/styles';
import { ReactNode, createContext, useMemo, useState } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { createAppTheme } from '../theme/theme';

export type ThemeModeContextValue = {
  mode: 'light' | 'dark';
  toggleMode: () => void;
};

export const ThemeModeContext = createContext<ThemeModeContextValue>({
  mode: 'light',
  toggleMode: () => undefined,
});

export function AppProviders({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<'light' | 'dark'>(
    () => (localStorage.getItem('chat_theme_mode') as 'light' | 'dark' | null) ?? 'light',
  );
  const theme = useMemo(() => createAppTheme(mode), [mode]);
  const context = useMemo(
    () => ({
      mode,
      toggleMode: () =>
        setMode((current) => {
          const next = current === 'light' ? 'dark' : 'light';
          localStorage.setItem('chat_theme_mode', next);
          return next;
        }),
    }),
    [mode],
  );

  return (
    <ThemeModeContext.Provider value={context}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <BrowserRouter>{children}</BrowserRouter>
      </ThemeProvider>
    </ThemeModeContext.Provider>
  );
}
