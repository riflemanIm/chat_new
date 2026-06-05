import { useEffect } from 'react';
import { AppRouter } from './app/router/AppRouter';
import { useAuthStore } from './features/auth/auth.store';

export function App() {
  const restoreSession = useAuthStore((state) => state.restoreSession);

  useEffect(() => {
    void restoreSession();
  }, [restoreSession]);

  return <AppRouter />;
}
