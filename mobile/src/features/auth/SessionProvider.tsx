import { useQueryClient } from '@tanstack/react-query';
import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useState, useSyncExternalStore } from 'react';
import { restoreSession, getSession, subscribeSession } from '@/lib/session';

const Context = createContext({ session: getSession(), loading: true, error: '', retry: () => {} });
export const useSession = () => useContext(Context);
export function SessionProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient();
  const subscribe = useCallback((listener: () => void) => {
    let userId = getSession()?.user.id;
    return subscribeSession(() => {
      const nextUserId = getSession()?.user.id;
      if (nextUserId !== userId) {
        userId = nextUserId;
        queryClient.clear();
      }
      listener();
    });
  }, [queryClient]);
  const session = useSyncExternalStore(subscribe, getSession, getSession);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    restoreSession().catch(e => { if (active && e.status !== 401) setError(e.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [attempt]);
  return <Context.Provider value={{ session, loading, error, retry: () => setAttempt(n => n + 1) }}>{children}</Context.Provider>;
}
