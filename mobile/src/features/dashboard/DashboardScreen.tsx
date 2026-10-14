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
  expiredCount?: number; expiresTodayCount?: number;
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
        <Link href="/settings" asChild>
          <Pressable accessibilityRole="button" accessibilityLabel="Settings" style={ui.settingsButton}>
            <SymbolView name={{ ios: 'gearshape.fill', android: 'settings', web: 'settings' }} tintColor={palette.ink} size={21} />
          </Pressable>
        </Link>
      </View>
      <Link href="/settings" asChild>
        <Pressable accessibilityRole="button" accessibilityLabel={`${household.data.name}, household settings`} style={ui.householdChip}>
          <SymbolView name={{ ios: 'house', android: 'home', web: 'home' }} tintColor={palette.ink} size={19} />
          <Text style={ui.householdName} numberOfLines={1}>{household.data.name}</Text>
          <SymbolView name={{ ios: 'chevron.down', android: 'arrow_drop_down', web: 'arrow_drop_down' }} tintColor={palette.muted} size={18} />
        </Pressable>
      </Link>
      <View style={ui.memberLine}>
        <Link href="/settings" asChild>
          <Pressable accessibilityRole="button" accessibilityLabel="Manage household members" style={ui.memberLink}>
            <SymbolView name={{ ios: 'person.2.fill', android: 'group', web: 'group' }} tintColor={palette.muted} size={17} />
            <Text style={ui.memberText}>{members.data ? `${members.data.length} ${members.data.length === 1 ? 'member' : 'members'}` : 'Shared household'} · Manage</Text>
          </Pressable>
        </Link>
        <Pressable accessibilityRole="button" accessibilityLabel={dashboard.isFetching ? 'Refreshing home' : 'Refresh home'} accessibilityState={{ disabled: dashboard.isFetching }} disabled={dashboard.isFetching} onPress={() => { dashboard.refetch(); }} style={ui.refreshButton}>
          <SymbolView name={{ ios: 'arrow.clockwise', android: 'refresh', web: 'refresh' }} tintColor={palette.green} size={18} />
        </Pressable>
      </View>
    </View>

    <View style={[ui.metrics, wide && ui.metricsWide]}>
      <Metric label="Expired" helper="before today" count={data?.expiredCount} tone="red" />
      <Metric label="Expiring soon" helper={data?.expiringSoonThreshold === undefined ? 'within warning window' : `next ${data.expiringSoonThreshold} days`} count={data?.expiringSoonCount} tone="amber" />
      <Metric label="In stock" helper="active products" count={data?.activeCount} tone="green" />
    </View>
    <View style={ui.todayLine}>
      <SymbolView name={{ ios: 'calendar', android: 'today', web: 'today' }} tintColor={uiColors.amber} size={17} />
      <Text style={ui.todayText}>Expires today</Text>
      <Text style={ui.todayCount}>{data?.expiresTodayCount ?? '—'}</Text>
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
        <Link href="/inventory" accessibilityRole="button" style={ui.viewAll}>View all <SymbolView name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} tintColor={palette.muted} size={15} /></Link>
      </View>
      {data.useFirst.length === 0 ? <View style={ui.emptyCard}>
        <Text style={ui.emptyTitle}>{data.activeCount === 0 ? 'Your shelves are ready' : 'Nothing needs prioritizing'}</Text>
        <Text style={ui.emptyText}>{data.activeCount === 0 ? 'Add a product to start your household inventory.' : 'Active products have no dates in your reminder window.'}</Text>
      </View> : <View style={[ui.productList, wide && ui.productListWide]}>
        {data.useFirst.slice(0, 3).map(item => <ProductCard key={item.id} item={item} category={categories.data?.find(c => c.id === item.categoryId)?.name} />)}
      </View>}

      <View style={ui.quickActions}>
        <Link href="/inventory?add=1" asChild>
          <Pressable accessibilityRole="button" style={ui.addButton}>
            <SymbolView name={{ ios: 'plus', android: 'add', web: 'add' }} tintColor="#fff" size={24} />
            <Text style={ui.addButtonText}>Add Item</Text>
          </Pressable>
        </Link>
        <View style={ui.secondaryActions}>
          <QuickAction href="/inventory" title="Mark as Used" tone="blue" />
          <QuickAction href="/shopping" title="Add to Shopping" tone="purple" />
        </View>
      </View>

      <View style={ui.sectionHeading}>
        <Text accessibilityRole="header" style={ui.sectionTitle}>Shopping List</Text>
        <Link href="/shopping" accessibilityRole="button" style={ui.viewAll}>View all <SymbolView name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} tintColor={palette.muted} size={15} /></Link>
      </View>
      <Link href="/shopping" asChild>
        <Pressable accessibilityRole="button" style={ui.shoppingCard}>
          <View style={ui.shoppingIcon}><SymbolView name={{ ios: 'cart.fill', android: 'shopping_cart', web: 'shopping_cart' }} tintColor={palette.green} size={27} /></View>
          <View style={ui.shoppingCopy}>
            <Text style={ui.shoppingCount}>{data.shoppingListCount === null ? 'List unavailable' : `${data.shoppingListCount} ${data.shoppingListCount === 1 ? 'item' : 'items'}`}</Text>
            <Text style={ui.shoppingSub}>{data.shoppingListCount === 0 ? 'Nothing to buy right now' : 'Shared with your household'}</Text>
          </View>
          <SymbolView name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} tintColor={palette.muted} size={17} />
        </Pressable>
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
  return <Link href={{ pathname: '/inventory', params: { itemId: item.id } }} asChild>
    <Pressable accessibilityRole="button" accessibilityLabel={`${item.name}, ${label}, ${item.quantity} ${item.unit}`} style={ui.productCard}>
      <View style={ui.productIcon}><SymbolView name={{ ios: 'shippingbox.fill', android: 'inventory_2', web: 'inventory_2' }} tintColor={palette.green} size={28} /></View>
      <View style={ui.productCopy}>
        <View style={ui.productTopline}>
          <Text numberOfLines={1} style={ui.productName}>{item.name}</Text>
          <View style={[ui.expiryPill, ui[`expiry_${tone}`]]}>
            <SymbolView name={expiryIcons[tone]} tintColor={uiColors[tone]} size={15} />
            <Text numberOfLines={1} style={[ui.expiryText, { color: uiColors[tone] }]}>{item.expiryType === 'Estimated' ? 'Estimated · ' : ''}{label}</Text>
          </View>
        </View>
        <Text numberOfLines={1} style={ui.productMeta}>{item.quantity} {item.unit}  ·  {category ?? 'Product'}  ·  {item.storageLocation || 'Storage not set'}</Text>
        {item.expiryDate && <Text numberOfLines={1} style={ui.productLocation}>Expiry date: {item.expiryDate}</Text>}
      </View>
      <View style={ui.cardChevron}>
        <SymbolView name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} tintColor={palette.muted} size={18} />
      </View>
    </Pressable>
  </Link>;
}

function QuickAction({ href, title, tone }: { href: '/inventory' | '/shopping'; title: string; tone: 'blue' | 'purple' }) {
  return <Link href={href} asChild>
    <Pressable accessibilityRole="button" style={StyleSheet.flatten([ui.quickAction, ui[`quick_${tone}`]])}>
      <SymbolView name={quickIcons[tone]} tintColor={tone === 'blue' ? '#1875d1' : '#6426a7'} size={26} />
      <View style={ui.quickCopy}><Text style={[ui.quickTitle, { color: tone === 'blue' ? '#1255a8' : '#53208f' }]}>{title}</Text></View>
    </Pressable>
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

const palette = { ink: '#102a30', green: '#16704c', border: '#e8eeeb', muted: '#586c73' };
const uiColors = { red: '#d82f35', amber: '#ad5c00', green: '#16704c', neutral: '#586c73' };
const metricIcons = { red: { ios: 'exclamationmark.circle.fill', android: 'error', web: 'error' }, amber: { ios: 'clock.fill', android: 'schedule', web: 'schedule' }, green: { ios: 'shippingbox.fill', android: 'inventory_2', web: 'inventory_2' } } as const;
const expiryIcons = { red: { ios: 'exclamationmark.circle.fill', android: 'error', web: 'error' }, amber: { ios: 'clock.fill', android: 'schedule', web: 'schedule' }, green: { ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' }, neutral: { ios: 'questionmark.circle.fill', android: 'help', web: 'help' } } as const;
const quickIcons = { blue: { ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' }, purple: { ios: 'cart.fill', android: 'shopping_cart', web: 'shopping_cart' } } as const;
const ui = StyleSheet.create({
  header: { gap: 2, marginBottom: -4 },
  brandRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { color: palette.green, fontSize: 27, lineHeight: 34, fontWeight: '800', letterSpacing: -1 },
  settingsButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 15, backgroundColor: '#edf2ef' },
  householdChip: { alignSelf: 'flex-start', minHeight: 42, maxWidth: '100%', flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, borderWidth: 1, borderColor: palette.border, borderRadius: 22, backgroundColor: '#fff' },
  householdName: { flexShrink: 1, fontSize: 16, fontWeight: '700', color: palette.ink },
  memberLine: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 6 },
  memberLink: { minHeight: 40, flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8 },
  refreshButton: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  memberText: { flexShrink: 1, color: palette.muted, fontSize: 14 },
  metrics: { flexDirection: 'row', gap: 8 },
  metricsWide: { gap: 16 },
  metric: { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3, paddingVertical: 8, borderRadius: 16, gap: 0 },
  metric_red: { backgroundColor: '#fff0ef' },
  metric_amber: { backgroundColor: '#fff6df' },
  metric_green: { backgroundColor: '#eaf6ed' },
  metricCount: { marginTop: 1, color: palette.ink, fontSize: 26, lineHeight: 30, fontWeight: '800', fontVariant: ['tabular-nums'] },
  metricLabel: { color: palette.ink, textAlign: 'center', fontSize: 13, fontWeight: '700' },
  metricHelper: { color: palette.muted, textAlign: 'center', fontSize: 11 },
  todayLine: { minHeight: 34, marginTop: -5, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 8 },
  todayText: { flex: 1, color: palette.ink, fontSize: 14, fontWeight: '700' },
  todayCount: { color: palette.ink, fontSize: 15, fontWeight: '800', fontVariant: ['tabular-nums'] },
  sectionHeading: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: -3 },
  sectionTitle: { flexShrink: 1, color: palette.ink, fontSize: 21, lineHeight: 28, fontWeight: '800', letterSpacing: -0.4 },
  viewAll: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 7, color: palette.ink, fontSize: 14, paddingHorizontal: 4 },
  productList: { gap: 7 },
  productListWide: { flexDirection: 'row', flexWrap: 'wrap' },
  productCard: { flexDirection: 'row', alignItems: 'center', gap: 9, padding: 9, minHeight: 88, flexGrow: 1, flexBasis: 300, borderRadius: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: '#f0f3f1', shadowColor: '#18382b', shadowOpacity: 0.035, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  productIcon: { width: 50, height: 50, flexShrink: 0, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: '#f3f7f4' },
  productCopy: { flex: 1, minWidth: 0, gap: 1 },
  productTopline: { minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 6 },
  productName: { flex: 1, minWidth: 0, color: palette.ink, fontSize: 16, lineHeight: 21, fontWeight: '800' },
  cardChevron: { width: 24, flexShrink: 0, alignItems: 'center', justifyContent: 'center' },
  expiryPill: { maxWidth: '58%', flexShrink: 0, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 14 },
  expiry_red: { backgroundColor: '#fff0ef' },
  expiry_amber: { backgroundColor: '#fff4dc' },
  expiry_green: { backgroundColor: '#edf7ef' },
  expiry_neutral: { backgroundColor: '#eff3f2' },
  expiryText: { flexShrink: 1, fontSize: 12, lineHeight: 16, fontWeight: '700' },
  productMeta: { flexShrink: 1, color: palette.muted, fontSize: 11, lineHeight: 15 },
  productLocation: { flexShrink: 1, color: palette.muted, fontSize: 11, lineHeight: 15 },
  emptyCard: { padding: 17, borderRadius: 18, backgroundColor: '#fff', borderWidth: 1, borderColor: palette.border, gap: 5 },
  emptyTitle: { color: palette.ink, fontSize: 17, fontWeight: '700' },
  emptyText: { color: palette.muted, fontSize: 14, lineHeight: 20 },
  quickActions: { gap: 8, marginTop: -2 },
  addButton: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, borderRadius: 16, backgroundColor: palette.green, elevation: 3 },
  addButtonText: { color: '#fff', fontSize: 18, fontWeight: '800' },
  secondaryActions: { flexDirection: 'row', gap: 10 },
  quickAction: { minHeight: 56, flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 9, borderRadius: 15 },
  quick_blue: { backgroundColor: '#e8f2ff' },
  quick_purple: { backgroundColor: '#f3eaff' },
  quickCopy: { minWidth: 0 },
  quickTitle: { flexShrink: 1, fontSize: 13, fontWeight: '800' },
  shoppingCard: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderWidth: 1, borderColor: palette.border, borderRadius: 17, backgroundColor: '#fff' },
  shoppingIcon: { width: 50, height: 50, flexShrink: 0, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: '#eaf6ed' },
  shoppingCopy: { flex: 1, gap: 3 },
  shoppingCount: { color: palette.ink, fontSize: 17, fontWeight: '800' },
  shoppingSub: { color: palette.muted, fontSize: 13 },
});
