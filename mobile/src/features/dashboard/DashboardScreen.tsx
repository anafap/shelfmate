import { useQuery } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { FoundationScreen } from '@/components/FoundationScreen';
import { Action, styles } from '@/features/auth/AccountScreen';
import { HouseholdScreen, useHousehold } from '@/features/auth/HouseholdScreen';
import { Category, InventoryItem, expiryLabel } from '@/features/inventory/types';
import { api } from '@/lib/session';

export type Dashboard = {
  householdId: string; householdName: string; householdLocalDate: string;
  activeCount: number; expiringSoonCount: number; expiryTodayOrPastCount: number;
  shoppingListCount: number | null; expiringSoonThreshold?: number; useFirst: InventoryItem[];
};

export default function DashboardScreen() {
  const household = useHousehold();
  const { width } = useWindowDimensions();
  const dashboard = useQuery({ queryKey: ['dashboard', household.data?.id], queryFn: () => api<Dashboard>('/households/current/dashboard'), enabled: !!household.data, retry: false });
  const members = useQuery({ queryKey: ['members', household.data?.id], queryFn: () => api<{ userId: string }[]>('/households/current/members'), enabled: !!household.data, retry: false });
  const categories = useQuery({ queryKey: ['categories', household.data?.id], queryFn: () => api<Category[]>('/households/current/categories'), enabled: !!household.data, retry: false });

  if (household.isPending) return <FoundationScreen title="Home" description="Loading your household…"><ActivityIndicator accessibilityLabel="Loading household" /></FoundationScreen>;
  if (household.isError) return <FoundationScreen title="Home" description="Your household could not be loaded."><Text style={styles.error}>{household.error.message}</Text><Action title="Retry household" onPress={() => { household.refetch(); }} /></FoundationScreen>;
  if (!household.data) return <HouseholdScreen />;

  const data = dashboard.data;
  const wide = width >= 720;
  return <FoundationScreen title="" description="" hideHeading>
    <View style={ui.header}>
      <View style={ui.brandRow}>
        <Text accessibilityRole="header" style={ui.brand}>ShelfMate</Text>
        <View style={ui.headerActions}>
          <Link href="/settings" accessibilityRole="button" accessibilityLabel="Household members and settings" style={ui.iconButton}>
            <SymbolView name={{ ios: 'person.2', android: 'group', web: 'group' }} tintColor={palette.ink} size={22} />
          </Link>
          <Link href="/settings" accessibilityRole="button" accessibilityLabel="Settings" style={ui.iconButton}>
            <SymbolView name={{ ios: 'gearshape', android: 'settings', web: 'settings' }} tintColor={palette.ink} size={22} />
          </Link>
        </View>
      </View>
      <Link href="/settings" accessibilityRole="button" accessibilityLabel={`${household.data.name}, household settings`} style={ui.householdChip}>
        <SymbolView name={{ ios: 'house', android: 'home', web: 'home' }} tintColor={palette.ink} size={19} />
        <Text style={ui.householdName} numberOfLines={1}>{household.data.name}</Text>
        <Text style={ui.chevron}>⌄</Text>
      </Link>
      <View style={ui.memberLine}>
        <Link href="/settings" accessibilityRole="button" style={ui.memberLink}>
          <View style={ui.onlineDot} />
          <Text style={ui.memberText}>{members.data ? `${members.data.length} ${members.data.length === 1 ? 'member' : 'members'}` : 'Shared household'} · Manage household</Text>
        </Link>
        <Pressable accessibilityRole="button" accessibilityLabel={dashboard.isFetching ? 'Refreshing home' : 'Refresh home'} accessibilityState={{ disabled: dashboard.isFetching }} disabled={dashboard.isFetching} onPress={() => { dashboard.refetch(); }} style={ui.refreshButton}>
          <SymbolView name={{ ios: 'arrow.clockwise', android: 'refresh', web: 'refresh' }} tintColor={palette.green} size={18} />
        </Pressable>
      </View>
    </View>

    <View style={[ui.metrics, wide && ui.metricsWide]}>
      <Metric label="Expired" helper="today or past" count={data?.expiryTodayOrPastCount} tone="red" />
      <Metric label="Expiring soon" helper={data?.expiringSoonThreshold ? `next ${data.expiringSoonThreshold} days` : 'coming up'} count={data?.expiringSoonCount} tone="amber" />
      <Metric label="In stock" helper="active products" count={data?.activeCount} tone="green" />
    </View>

    {dashboard.isPending && <ActivityIndicator accessibilityLabel="Loading dashboard" />}
    {dashboard.isError && <View style={styles.card}>
      <Text accessibilityRole="alert" style={styles.error}>{dashboard.error.message}</Text>
      {data && <Text style={styles.body}>Showing the last loaded summary. It may be out of date.</Text>}
      <Action variant="secondary" title="Retry home" disabled={dashboard.isFetching} onPress={() => { dashboard.refetch(); }} />
    </View>}

    {data && <>
      <View style={ui.sectionHeading}>
        <Text accessibilityRole="header" style={ui.sectionTitle}>Use these first</Text>
        <Link href="/inventory" accessibilityRole="button" style={ui.viewAll}>View all <Text style={ui.chevron}>›</Text></Link>
      </View>
      {data.useFirst.length === 0 ? <View style={ui.emptyCard}>
        <Text style={ui.emptyTitle}>{data.activeCount === 0 ? 'Your shelves are ready' : 'Nothing needs prioritizing'}</Text>
        <Text style={ui.emptyText}>{data.activeCount === 0 ? 'Add a product to start your household inventory.' : 'Active products have no dates in your reminder window.'}</Text>
      </View> : <View style={[ui.productList, wide && ui.productListWide]}>
        {data.useFirst.map(item => <ProductCard key={item.id} item={item} category={categories.data?.find(c => c.id === item.categoryId)?.name} />)}
      </View>}

      <View style={ui.quickActions}>
        <Link href="/inventory?add=1" accessibilityRole="button" style={ui.addButton}>
          <SymbolView name={{ ios: 'plus', android: 'add', web: 'add' }} tintColor="#fff" size={24} />
          <Text style={ui.addButtonText}>Add Item</Text>
        </Link>
        <View style={ui.secondaryActions}>
          <QuickAction href="/inventory" title="Mark as Used" subtitle="Choose a product" tone="blue" />
          <QuickAction href="/shopping" title="Shopping List" subtitle="Add what you need" tone="purple" />
        </View>
      </View>

      <View style={ui.sectionHeading}>
        <Text accessibilityRole="header" style={ui.sectionTitle}>Shopping List</Text>
        <Link href="/shopping" accessibilityRole="button" style={ui.viewAll}>View all <Text style={ui.chevron}>›</Text></Link>
      </View>
      <Link href="/shopping" accessibilityRole="button" style={ui.shoppingCard}>
        <View style={ui.shoppingIcon}><SymbolView name={{ ios: 'cart.fill', android: 'shopping_cart', web: 'shopping_cart' }} tintColor={palette.green} size={27} /></View>
        <View style={ui.shoppingCopy}>
          <Text style={ui.shoppingCount}>{data.shoppingListCount === null ? 'List unavailable' : `${data.shoppingListCount} ${data.shoppingListCount === 1 ? 'item' : 'items'}`}</Text>
          <Text style={ui.shoppingSub}>{data.shoppingListCount === 0 ? 'Nothing to buy right now' : 'Shared with your household'}</Text>
        </View>
        <Text style={ui.chevron}>›</Text>
      </Link>
    </>}
  </FoundationScreen>;
}

function Metric({ label, helper, count, tone }: { label: string; helper: string; count?: number; tone: 'red' | 'amber' | 'green' }) {
  return <View style={[ui.metric, ui[`metric_${tone}`]]}>
    <SymbolView name={metricIcons[tone]} tintColor={uiColors[tone]} size={28} />
    <Text style={ui.metricCount}>{count === undefined ? '—' : count}</Text>
    <Text style={ui.metricLabel}>{label}</Text>
    <Text style={ui.metricHelper}>{helper}</Text>
  </View>;
}

function ProductCard({ item, category }: { item: InventoryItem; category?: string }) {
  const label = naturalExpiry(item);
  const tone = item.expiryStatus === 'Expired' ? 'red' : item.expiryStatus === 'ExpiringSoon' ? 'amber' : item.expiryStatus === 'OK' ? 'green' : 'neutral';
  return <Link href={{ pathname: '/inventory', params: { itemId: item.id } }} accessibilityRole="button" accessibilityLabel={`${item.name}, ${label}, ${item.quantity} ${item.unit}`} style={ui.productCard}>
    <View style={ui.productIcon}><SymbolView name={{ ios: 'shippingbox.fill', android: 'inventory_2', web: 'inventory_2' }} tintColor={palette.green} size={32} /></View>
    <View style={ui.productCopy}>
      <View style={ui.productTitleRow}>
        <Text style={ui.productName} numberOfLines={1}>{item.name}</Text>
        <Text style={ui.productChevron}>›</Text>
      </View>
      <View style={[ui.expiryPill, ui[`expiry_${tone}`]]}>
        <SymbolView name={expiryIcons[tone]} tintColor={uiColors[tone]} size={15} />
        <Text style={[ui.expiryText, { color: uiColors[tone] }]}>{item.expiryType === 'Estimated' ? 'Estimated · ' : ''}{label}</Text>
      </View>
      <Text style={ui.productMeta} numberOfLines={2}>{item.quantity} {item.unit}  ·  {category ?? 'Product'}  ·  {item.storageLocation || 'Storage not set'}</Text>
      {item.expiryDate && <Text style={ui.productDate}>Expiry date: {item.expiryDate}</Text>}
    </View>
  </Link>;
}

function QuickAction({ href, title, subtitle, tone }: { href: '/inventory' | '/shopping'; title: string; subtitle: string; tone: 'blue' | 'purple' }) {
  return <Link href={href} accessibilityRole="button" style={[ui.quickAction, ui[`quick_${tone}`]]}>
    <SymbolView name={quickIcons[tone]} tintColor={tone === 'blue' ? '#1875d1' : '#6426a7'} size={26} />
    <View style={ui.quickCopy}><Text style={[ui.quickTitle, { color: tone === 'blue' ? '#1255a8' : '#53208f' }]}>{title}</Text><Text style={ui.quickSubtitle}>{subtitle}</Text></View>
  </Link>;
}

export function naturalExpiry(item: InventoryItem) {
  if (item.status !== 'Active') return item.status;
  if (item.expiryStatus === 'Unknown' || item.daysRemaining === null) return 'Expiry date unknown';
  if (item.daysRemaining === 0) return 'Expires today';
  if (item.daysRemaining === 1) return 'Expires tomorrow';
  if (item.daysRemaining === -1) return 'Expired yesterday';
  if (item.daysRemaining < -1) return `Expired ${Math.abs(item.daysRemaining)} days ago`;
  if (item.expiryStatus === 'ExpiringSoon') return `Expires in ${item.daysRemaining} days`;
  return expiryLabel(item);
}

const palette = { ink: '#102a30', green: '#16704c', border: '#e8eeeb', muted: '#586c73', background: '#f7faf8' };
const uiColors = { red: '#d82f35', amber: '#ad5c00', green: '#16704c', neutral: '#586c73' };
const metricIcons = { red: { ios: 'exclamationmark.circle.fill', android: 'error', web: 'error' }, amber: { ios: 'clock.fill', android: 'schedule', web: 'schedule' }, green: { ios: 'shippingbox.fill', android: 'inventory_2', web: 'inventory_2' } } as const;
const expiryIcons = { red: { ios: 'exclamationmark.circle.fill', android: 'error', web: 'error' }, amber: { ios: 'clock.fill', android: 'schedule', web: 'schedule' }, green: { ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' }, neutral: { ios: 'questionmark.circle.fill', android: 'help', web: 'help' } } as const;
const quickIcons = { blue: { ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' }, purple: { ios: 'cart.fill', android: 'shopping_cart', web: 'shopping_cart' } } as const;
const ui = StyleSheet.create({
  header: { gap: 9, marginBottom: 2 },
  brandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  brand: { fontSize: 31, lineHeight: 39, fontWeight: '800', letterSpacing: -1.2, color: palette.green },
  headerActions: { flexDirection: 'row', gap: 10 },
  iconButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 17, backgroundColor: '#eef2f0' },
  householdChip: { alignSelf: 'flex-start', minHeight: 44, maxWidth: '100%', flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 15, borderWidth: 1, borderColor: palette.border, borderRadius: 24, backgroundColor: '#fff' },
  householdName: { flexShrink: 1, fontSize: 17, fontWeight: '700', color: palette.ink },
  chevron: { color: palette.muted, fontSize: 24, lineHeight: 26 },
  memberLine: { minHeight: 34, flexDirection: 'row', alignItems: 'center', gap: 9 },
  memberLink: { minHeight: 40, flex: 1, flexDirection: 'row', alignItems: 'center', gap: 9 },
  refreshButton: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  onlineDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: palette.green },
  memberText: { flexShrink: 1, color: palette.muted, fontSize: 14 },
  metrics: { flexDirection: 'row', gap: 10 },
  metricsWide: { gap: 16 },
  metric: { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5, paddingVertical: 16, borderRadius: 20, gap: 2 },
  metric_red: { backgroundColor: '#fff0ef' },
  metric_amber: { backgroundColor: '#fff6df' },
  metric_green: { backgroundColor: '#eaf6ed' },
  metricCount: { marginTop: 1, color: palette.ink, fontSize: 31, lineHeight: 37, fontWeight: '800', fontVariant: ['tabular-nums'] },
  metricLabel: { color: palette.ink, textAlign: 'center', fontSize: 13, fontWeight: '700' },
  metricHelper: { color: palette.muted, textAlign: 'center', fontSize: 11 },
  sectionHeading: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 3 },
  sectionTitle: { color: palette.ink, fontSize: 22, lineHeight: 28, fontWeight: '800', letterSpacing: -0.4 },
  viewAll: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 7, color: palette.ink, fontSize: 14, paddingHorizontal: 4 },
  productList: { gap: 10 },
  productListWide: { flexDirection: 'row', flexWrap: 'wrap' },
  productCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, minHeight: 130, flexGrow: 1, flexBasis: 300, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: '#f0f3f1', shadowColor: '#18382b', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 1 },
  productIcon: { width: 74, height: 82, alignItems: 'center', justifyContent: 'center', borderRadius: 17, backgroundColor: '#f3f7f4' },
  productCopy: { flex: 1, minWidth: 0, gap: 6 },
  productTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  productName: { flex: 1, color: palette.ink, fontSize: 18, fontWeight: '800' },
  productChevron: { color: palette.muted, fontSize: 25, lineHeight: 27 },
  expiryPill: { alignSelf: 'flex-start', maxWidth: '100%', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 14 },
  expiry_red: { backgroundColor: '#fff0ef' },
  expiry_amber: { backgroundColor: '#fff4dc' },
  expiry_green: { backgroundColor: '#edf7ef' },
  expiry_neutral: { backgroundColor: '#eff3f2' },
  expiryText: { flexShrink: 1, fontSize: 13, fontWeight: '700' },
  productMeta: { color: palette.muted, fontSize: 12, lineHeight: 17 },
  productDate: { color: palette.muted, fontSize: 12 },
  emptyCard: { padding: 17, borderRadius: 18, backgroundColor: '#fff', borderWidth: 1, borderColor: palette.border, gap: 5 },
  emptyTitle: { color: palette.ink, fontSize: 17, fontWeight: '700' },
  emptyText: { color: palette.muted, fontSize: 14, lineHeight: 20 },
  quickActions: { gap: 10, marginTop: 1 },
  addButton: { minHeight: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, borderRadius: 18, backgroundColor: palette.green },
  addButtonText: { color: '#fff', fontSize: 18, fontWeight: '800' },
  secondaryActions: { flexDirection: 'row', gap: 10 },
  quickAction: { minHeight: 78, flex: 1, flexDirection: 'row', alignItems: 'center', gap: 9, padding: 11, borderRadius: 18 },
  quick_blue: { backgroundColor: '#e8f2ff' },
  quick_purple: { backgroundColor: '#f3eaff' },
  quickCopy: { flex: 1, minWidth: 0 },
  quickTitle: { fontSize: 13, fontWeight: '800' },
  quickSubtitle: { color: palette.muted, fontSize: 11, lineHeight: 15 },
  shoppingCard: { minHeight: 86, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderWidth: 1, borderColor: palette.border, borderRadius: 19, backgroundColor: '#fff' },
  shoppingIcon: { width: 58, height: 58, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: '#eaf6ed' },
  shoppingCopy: { flex: 1, gap: 3 },
  shoppingCount: { color: palette.ink, fontSize: 17, fontWeight: '800' },
  shoppingSub: { color: palette.muted, fontSize: 13 },
});
