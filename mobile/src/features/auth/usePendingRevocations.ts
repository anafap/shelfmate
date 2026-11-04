import { useEffect } from 'react';
import { AppState } from 'react-native';
import { flushPendingRevocations } from '@/lib/session';

export function usePendingRevocations() {
  useEffect(() => {
    const flush = () => { void flushPendingRevocations().catch(() => {}); };
    flush();
    const foreground = AppState.addEventListener('change', state => { if (state === 'active') flush(); });
    const timer = setInterval(flush, 30000);
    return () => { foreground.remove(); clearInterval(timer); };
  }, []);
}
