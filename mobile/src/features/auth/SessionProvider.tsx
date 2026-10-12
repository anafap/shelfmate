import { useQueryClient } from '@tanstack/react-query';
import { createContext, PropsWithChildren, useContext, useEffect, useState, useSyncExternalStore } from 'react';
import { restoreSession, getSession, subscribeSession } from '@/lib/session';

const Context = createContext({ session: getSession(), loading: true, error: '', retry: () => {} });
export const useSession = () => useContext(Context);
export function SessionProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient();
  const session = useSyncExternalStore(subscribeSession, getSession, getSession);
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
  useEffect(() => { queryClient.clear(); }, [queryClient, session?.user.id]);
  return <Context.Provider value={{ session, loading, error, retry: () => setAttempt(n => n + 1) }}>{children}</Context.Provider>;
}
