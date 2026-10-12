import { useQuery } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { FoundationScreen } from '@/components/FoundationScreen';
import { Action, styles } from '@/features/auth/AccountScreen';
import { HouseholdScreen, useHousehold } from '@/features/auth/HouseholdScreen';
import { InventoryItem, expiryLabel } from '@/features/inventory/types';
import { api } from '@/lib/session';

export type Dashboard = {
  householdId: string; householdName: string; householdLocalDate: string;
  activeCount: number; expiringSoonCount: number; expiryTodayOrPastCount: number;
  shoppingListCount: number | null; useFirst: InventoryItem[];
};
export default function DashboardScreen() {
  const household = useHousehold();
  const dashboard = useQuery({ queryKey: ['dashboard', household.data?.id], queryFn: () => api<Dashboard>('/households/current/dashboard'), enabled: !!household.data, retry: false });
  if (household.isPending) return <FoundationScreen title="Home" description="Loading your household…"><ActivityIndicator accessibilityLabel="Loading household" /></FoundationScreen>;
  if (household.isError) return <FoundationScreen title="Home" description="Your household could not be loaded."><Text style={styles.error}>{household.error.message}</Text><Action title="Retry household" onPress={() => { household.refetch(); }} /></FoundationScreen>;
  if (!household.data) return <HouseholdScreen />;
  const data = dashboard.data;
  return <FoundationScreen title={household.data.name} description="A quick look at what’s at home and which entered dates to review first.">
    <View style={ui.toolbar}>
      <Text style={[styles.body, { flex: 1 }]}>Shared household overview</Text>
      <Action variant="secondary" title={dashboard.isFetching ? 'Refreshing…' : 'Refresh dashboard'} disabled={dashboard.isFetching} onPress={() => { dashboard.refetch(); }} />
    </View>
    {dashboard.isPending && <ActivityIndicator accessibilityLabel="Loading dashboard" />}
    {dashboard.isError && <View style={styles.card}>
      <Text accessibilityRole="alert" style={styles.error}>{dashboard.error.message}</Text>
      {data && <Text style={styles.body}>Showing the previously loaded summary. It may be out of date.</Text>}
      <Action variant="secondary" title="Retry dashboard" disabled={dashboard.isFetching} onPress={() => { dashboard.refetch(); }} />
    </View>}
    {data && <>
      <View style={ui.stats}>
        <Stat label="Active products" count={data.activeCount} detail="Currently at home" />
        <Stat label="Expiring soon" count={data.expiringSoonCount} detail="Entered dates in 1–7 days" />
        <Stat label="Today or past date" count={data.expiryTodayOrPastCount} detail="Review these products" />
        <View style={[styles.card, ui.stat]}><Text style={styles.body}>Shopping list</Text><Text style={styles.heading}>Coming next</Text><Text style={styles.body}>Shared shopping is not available yet.</Text></View>
      </View>
      <Text style={styles.body}>Household date when loaded: {data.householdLocalDate}. Refresh to see the latest household changes.</Text>
      <View style={styles.card}>
        <Text accessibilityRole="header" style={styles.heading}>Use First</Text>
        <Text style={styles.body}>Up to 10 active products, nearest entered date first. Review dates and product condition before use.</Text>
        {data.useFirst.length === 0 ? <>
          <Text style={styles.heading}>{data.activeCount === 0 ? 'Your shelves are ready' : 'No dates to prioritize'}</Text>
          <Text style={styles.body}>{data.activeCount === 0 ? 'Add your first product in Inventory to start your household overview.' : 'Your active products have no expiry dates. Add a printed or explicitly estimated date when you have one.'}</Text>
        </> : data.useFirst.map(item => <View key={item.id} style={ui.item}>
          <View style={ui.toolbar}><Text accessibilityRole="header" style={[styles.heading, { flex: 1 }]}>{item.name}</Text><Text style={styles.body}>{item.quantity} {item.unit}</Text></View>
          <Text style={[styles.body, { fontWeight: '600', color: item.expiryStatus === 'Expired' ? '#9c2727' : '#22634b' }]}>{expiryLabel(item)}</Text>
          <Text style={styles.body}>{item.expiryType === 'Estimated' ? 'Estimated date' : 'Printed expiry date'}: {item.expiryDate} · {item.storageLocation}</Text>
          {item.expiryType === 'Estimated' && <Text style={styles.body}>An estimated date is an editable guide, not a verified safety deadline.</Text>}
        </View>)}
        <Link href="/inventory" accessibilityRole="button" style={ui.link}>Manage products in Inventory</Link>
      </View>
    </>}
  </FoundationScreen>;
}
function Stat({ label, count, detail }: { label: string; count: number; detail: string }) {
  return <View style={[styles.card, ui.stat]}><Text style={styles.body}>{label}</Text><Text style={ui.count}>{count}</Text><Text style={styles.body}>{detail}</Text></View>;
}
const ui = StyleSheet.create({
  toolbar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  stat: { flexGrow: 1, flexBasis: 180 },
  count: { fontSize: 36, fontWeight: '700', color: '#193b2e' },
  item: { gap: 8, borderTopWidth: 1, borderTopColor: '#e0e8e2', paddingTop: 16 },
  link: { minHeight: 48, padding: 14, backgroundColor: '#f0f5f1', borderRadius: 10, color: '#22634b', fontSize: 16, fontWeight: '600' },
});
