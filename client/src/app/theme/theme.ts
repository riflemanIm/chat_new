import { createTheme, PaletteMode } from '@mui/material/styles';

export function createAppTheme(mode: PaletteMode) {
  return createTheme({
    palette: {
      mode,
      primary: { main: '#2563eb' },
      secondary: { main: '#0f766e' },
      background: {
        default: mode === 'light' ? '#f5f7fb' : '#101418',
        paper: mode === 'light' ? '#ffffff' : '#171c22',
      },
    },
    shape: {
      borderRadius: 8,
    },
    typography: {
      fontFamily: ['Inter', 'Roboto', 'Arial', 'sans-serif'].join(','),
      button: {
        textTransform: 'none',
        fontWeight: 600,
      },
    },
    components: {
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
          },
        },
      },
      MuiButton: {
        defaultProps: {
          variant: 'contained',
        },
      },
    },
  });
}
