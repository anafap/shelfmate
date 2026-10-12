import { HubConnectionBuilder, LogLevel } from '@microsoft/signalr';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useHousehold } from '@/features/auth/HouseholdScreen';
import { api, getSession } from '@/lib/session';

export function useLiveUpdates(userId?: string) {
  const household = useHousehold(); const client = useQueryClient();
  const [connectionState, setConnectionState] = useState<{ householdId?: string; userId?: string; status: string }>({ status: 'Connecting shared updates…' });
  const householdId = household.data?.id;
  useEffect(() => {
    if (!userId || !householdId) return;
    const setStatus = (status: string) => setConnectionState({ householdId, userId, status });
    let stopped = false; let retryTimer: ReturnType<typeof setTimeout> | undefined;
    const keys = ['household', 'members', 'invites', 'categories', 'inventory', 'shopping', 'dashboard', 'alerts', 'preferences'];
    function refetch(resource?: string) {
      const affected = resource === 'inventory' ? ['inventory', 'dashboard', 'alerts'] : resource === 'shopping' ? ['shopping', 'inventory', 'dashboard'] : keys;
      affected.forEach(key => { client.invalidateQueries({ queryKey: [key] }); });
    }
    const base = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '');
    if (!base) return;
    const connection = new HubConnectionBuilder().withUrl(`${base}/hubs/household`, {
      withCredentials: false, accessTokenFactory: async () => { await api('/me'); const current = getSession(); if (!current || current.user.id !== userId) throw new Error('Session changed.'); return current.accessToken; },
    }).configureLogging(LogLevel.None).withAutomaticReconnect([0, 2000, 5000, 10000]).build();
    connection.on('ResourceChanged', (event: { resource: string }) => { if (!stopped) refetch(event.resource); });
    connection.onreconnecting(() => { if (!stopped) setStatus('Shared updates disconnected · refresh is available'); });
    connection.onreconnected(() => { if (!stopped) { setStatus('Shared updates connected'); refetch(); } });
    async function start() {
      if (stopped) return;
      try { await connection.start(); if (stopped) { await connection.stop(); return; } setStatus('Shared updates connected'); refetch(); }
      catch { if (!stopped) { setStatus('Shared updates disconnected · refresh is available'); retryTimer = setTimeout(start, 10000); } }
    }
    connection.onclose(() => { if (!stopped) { setStatus('Shared updates disconnected · refresh is available'); retryTimer = setTimeout(start, 10000); } });
    const foreground = AppState.addEventListener('change', state => { if (state === 'active' && !stopped) refetch(); });
    start();
    return () => { stopped = true; clearTimeout(retryTimer); foreground.remove(); connection.off('ResourceChanged'); void connection.stop(); };
  }, [client, householdId, userId]);
  return householdId ? connectionState.householdId === householdId && connectionState.userId === userId ? connectionState.status : 'Connecting shared updates…' : '';
}
