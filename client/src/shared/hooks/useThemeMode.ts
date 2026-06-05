import { useContext } from 'react';
import { ThemeModeContext } from '../../app/providers/AppProviders';

export function useThemeMode() {
  return useContext(ThemeModeContext);
}
