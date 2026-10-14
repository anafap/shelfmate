import { useQuery, useQueryClient, useIsFetching } from '@tanstack/react-query';
import { Link, usePathname } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useHousehold } from './HouseholdScreen';
import { api } from '@/lib/session';
import { useContext } from 'react';
import { SyncStatusContext } from '@/features/sync/SyncStatusContext';

export function HouseholdHeader() {
  const household = useHousehold();
  const syncStatus = useContext(SyncStatusContext);
  const queryClient = useQueryClient();
  const pathname = usePathname();
  const members = useQuery({ queryKey: ['members', household.data?.id], queryFn: () => api<{ userId: string }[]>('/households/current/members'), enabled: !!household.data, retry: false });
  const dashboardFetching = useIsFetching({ queryKey: ['dashboard', household.data?.id] }) > 0;
  const disconnected = syncStatus.includes('disconnected');
  const live = syncStatus.endsWith('connected');
  const home = pathname === '/' || pathname === '/index';

  return <View style={ui.header}>
    <View style={ui.brandRow}>
      <Text accessibilityRole="header" style={ui.brand}>ShelfMate</Text>
      <Link href="/settings" asChild>
        <Pressable accessibilityRole="button" accessibilityLabel="Settings" style={ui.settingsButton}>
          <SymbolView name={{ ios: 'gearshape.fill', android: 'settings', web: 'settings' }} tintColor={palette.ink} size={21} />
        </Pressable>
      </Link>
    </View>
    {household.data ? <View style={ui.detailsRow}>
      <Link href="/settings" asChild>
        <Pressable accessibilityRole="button" accessibilityLabel={`${household.data.name}, household settings`} style={ui.householdChip}>
          <SymbolView name={{ ios: 'house', android: 'home', web: 'home' }} tintColor={palette.ink} size={18} />
          <Text style={ui.householdName} numberOfLines={1}>{household.data.name}</Text>
          <SymbolView name={{ ios: 'chevron.down', android: 'arrow_drop_down', web: 'arrow_drop_down' }} tintColor={palette.muted} size={17} />
        </Pressable>
      </Link>
      <View accessibilityRole="text" accessibilityLabel={members.data ? `${members.data.length} ${members.data.length === 1 ? 'member' : 'members'}` : 'Household members'} style={ui.memberInfo}>
        <SymbolView name={{ ios: 'person.2.fill', android: 'group', web: 'group' }} tintColor={palette.muted} size={16} />
        <Text style={ui.memberText}>{members.data ? `${members.data.length} ${members.data.length === 1 ? 'member' : 'members'}` : 'Members'}</Text>
      </View>
      <View accessibilityRole="text" accessibilityLabel={syncStatus} accessibilityLiveRegion="polite" style={ui.syncStatus}>
        <View style={[ui.syncDot, disconnected && ui.syncDotDisconnected]} />
        <Text style={[ui.syncText, disconnected && ui.syncTextDisconnected]}>{disconnected ? 'Offline' : live ? 'Live' : 'Syncing'}</Text>
      </View>
      {home && <Pressable accessibilityRole="button" accessibilityLabel={dashboardFetching ? 'Refreshing home' : 'Refresh home'} accessibilityState={{ disabled: dashboardFetching }} disabled={dashboardFetching} onPress={() => { void queryClient.invalidateQueries({ queryKey: ['dashboard', household.data?.id] }); }} style={ui.refreshButton}>
        <SymbolView name={{ ios: 'arrow.clockwise', android: 'refresh', web: 'refresh' }} tintColor={palette.green} size={18} />
      </Pressable>}
    </View> : <Text style={ui.setupText}>Set up your household</Text>}
  </View>;
}

const palette = { ink: '#102a30', green: '#16704c', border: '#e8eeeb', muted: '#586c73' };
const ui = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingTop: 3, paddingBottom: 5, gap: 0, backgroundColor: '#f5f7f5' },
  brandRow: { minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { color: palette.green, fontSize: 25, lineHeight: 31, fontWeight: '800', letterSpacing: -0.8 },
  settingsButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: '#edf2ef' },
  detailsRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8 },
  householdChip: { minHeight: 40, flex: 1, minWidth: 70, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, borderWidth: 1, borderColor: palette.border, borderRadius: 20, backgroundColor: '#fff' },
  householdName: { flex: 1, minWidth: 0, color: palette.ink, fontSize: 14, fontWeight: '700' },
  memberInfo: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 4 },
  memberText: { color: palette.muted, fontSize: 12, fontWeight: '600' },
  syncStatus: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 4 },
  syncDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#28865c' },
  syncDotDisconnected: { backgroundColor: '#ad5c00' },
  syncText: { color: '#22634b', fontSize: 12, fontWeight: '700' },
  syncTextDisconnected: { color: '#805000' },
  refreshButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  setupText: { minHeight: 40, paddingTop: 8, color: palette.muted, fontSize: 13 },
});
