import { useQuery } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useContext, useEffect, useState } from 'react';
import { ActivityIndicator, BackHandler, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { FoundationScreen } from '@/components/FoundationScreen';
import { FAB_SCROLL_END_PADDING, FloatingActionButton } from '@/components/FloatingActionButton';
import { Action, styles } from '@/features/auth/AccountScreen';
import { HouseholdScreen, useHousehold } from '@/features/auth/HouseholdScreen';
import { Category, InventoryItem, expiryLabel, expiryTone, formatProductDate } from '@/features/inventory/types';
import { api } from '@/lib/session';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

export type Dashboard = {
  householdId: string; householdName: string; householdLocalDate: string;
  activeCount: number; expiringSoonCount: number; expiryTodayOrPastCount: number;
  expiredCount?: number; expiresTodayCount?: number;
  shoppingListCount: number | null; expiringSoonThreshold?: number; useFirst: InventoryItem[];
};

export default function DashboardScreen() {
  const household = useHousehold();
  const { width } = useWindowDimensions();
  const insets = useContext(SafeAreaInsetsContext);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const dashboard = useQuery({ queryKey: ['dashboard', household.data?.id], queryFn: () => api<Dashboard>('/households/current/dashboard'), enabled: !!household.data, retry: false });
  const categories = useQuery({ queryKey: ['categories', household.data?.id], queryFn: () => api<Category[]>('/households/current/categories'), enabled: !!household.data, retry: false });
  useEffect(() => {
    if (!addMenuOpen) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { setAddMenuOpen(false); return true; });
    return () => subscription.remove();
  }, [addMenuOpen]);

  if (household.isPending) return <FoundationScreen title="Home" description="Loading your household…"><ActivityIndicator accessibilityLabel="Loading household" /></FoundationScreen>;
  if (household.isError) return <FoundationScreen title="Home" description="Your household could not be loaded."><Text style={styles.error}>{household.error.message}</Text><Action title="Retry household" onPress={() => { household.refetch(); }} /></FoundationScreen>;
  if (!household.data) return <HouseholdScreen />;

  const data = dashboard.data;
  const wide = width >= 720;
  return <View style={ui.screen}>
    <FoundationScreen title="" description="" hideHeading>
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
        <Link href="/inventory" asChild><Pressable accessibilityRole="button" style={ui.viewAll}><Text style={ui.viewAllText}>View all</Text><SymbolView name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} tintColor={palette.muted} size={15} /></Pressable></Link>
      </View>
      {data.useFirst.length === 0 ? <View style={ui.emptyCard}>
        <Text style={ui.emptyTitle}>{data.activeCount === 0 ? 'Your shelves are ready' : 'Nothing needs prioritizing'}</Text>
        <Text style={ui.emptyText}>{data.activeCount === 0 ? 'Add a product to start your household inventory.' : 'Active products have no dates in your reminder window.'}</Text>
      </View> : <View style={[ui.productList, wide && ui.productListWide]}>
        {data.useFirst.slice(0, 3).map(item => <ProductCard key={item.id} item={item} category={categories.data?.find(c => c.id === item.categoryId)?.name} />)}
      </View>}

      <View style={ui.sectionHeading}>
        <Text accessibilityRole="header" style={ui.sectionTitle}>Shopping List</Text>
        <Link href="/shopping" asChild><Pressable accessibilityRole="button" style={ui.viewAll}><Text style={ui.viewAllText}>View all</Text><SymbolView name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} tintColor={palette.muted} size={15} /></Pressable></Link>
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
      <View style={ui.scrollEndSpace} />
    </>}
    </FoundationScreen>
    <FloatingActionButton
      label="Add item"
      expanded={addMenuOpen}
      bottomInset={width >= 1000 ? insets?.bottom ?? 0 : 0}
      onPress={() => setAddMenuOpen(open => !open)}
      onDismiss={() => setAddMenuOpen(false)}
      testID="home-fab"
      menuContent={<View style={ui.addMenu}>
        <Link href="/add-inventory" asChild>
          <Pressable accessibilityRole="button" style={ui.addOption} onPress={() => setAddMenuOpen(false)}>
            <View style={ui.addOptionIcon}><SymbolView name={{ ios: 'shippingbox.fill', android: 'inventory_2', web: 'inventory_2' }} tintColor={palette.green} size={23} /></View>
            <View style={ui.addOptionCopy}><Text style={ui.addOptionTitle}>Add to Inventory</Text><Text style={ui.addOptionHint}>Track a product and its expiry</Text></View>
            <SymbolView name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} tintColor={palette.muted} size={16} />
          </Pressable>
        </Link>
        <Link href="/shopping" asChild>
          <Pressable accessibilityRole="button" style={ui.addOption} onPress={() => setAddMenuOpen(false)}>
            <View style={[ui.addOptionIcon, ui.shoppingOptionIcon]}><SymbolView name={{ ios: 'cart.fill', android: 'shopping_cart', web: 'shopping_cart' }} tintColor="#6426a7" size={23} /></View>
            <View style={ui.addOptionCopy}><Text style={ui.addOptionTitle}>Add to Shopping List</Text><Text style={ui.addOptionHint}>Add something you need to buy</Text></View>
            <SymbolView name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} tintColor={palette.muted} size={16} />
          </Pressable>
        </Link>
      </View>}
    />
  </View>;
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
  const tone = expiryTone(item);
  return <Link href={{ pathname: '/inventory', params: { itemId: item.id } }} asChild>
    <Pressable accessibilityRole="button" accessibilityLabel={`${item.name}, ${label}, ${item.quantity} ${item.unit}`} style={StyleSheet.flatten([ui.productCard, tone === 'red' && ui.productCard_red])}>
      <View style={ui.productIcon}><SymbolView name={{ ios: 'shippingbox.fill', android: 'inventory_2', web: 'inventory_2' }} tintColor={palette.green} size={28} /></View>
      <View style={ui.productCopy}>
        <View style={ui.productTopline}>
          <Text style={ui.productName}>{item.name}</Text>
          <View style={[ui.expiryPill, ui[`expiry_${tone}`]]}>
            <SymbolView name={expiryIcons[tone]} tintColor={uiColors[tone]} size={15} />
            <Text style={[ui.expiryText, { color: uiColors[tone] }]}>{label}</Text>
          </View>
        </View>
        <Text style={ui.productMeta}>{item.quantity} {item.unit}  ·  {category ?? 'Product'}  ·  {item.storageLocation || 'Storage not set'}</Text>
        {item.expiryDate && <Text style={ui.productLocation}>{item.expiryType === 'Estimated' ? 'Estimated date' : 'Expiry date'}: {formatProductDate(item.expiryDate)}</Text>}
      </View>
      <View style={ui.cardChevron}>
        <SymbolView name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} tintColor={palette.muted} size={18} />
      </View>
    </Pressable>
  </Link>;
}

export function naturalExpiry(item: InventoryItem) {
  return expiryLabel(item);
}

const palette = { ink: '#102a30', green: '#16704c', border: '#e8eeeb', muted: '#586c73' };
const uiColors = { red: '#d82f35', orange: '#c45a00', amber: '#ad5c00', green: '#16704c', neutral: '#586c73' };
const metricIcons = { red: { ios: 'exclamationmark.circle.fill', android: 'error', web: 'error' }, amber: { ios: 'clock.fill', android: 'schedule', web: 'schedule' }, green: { ios: 'shippingbox.fill', android: 'inventory_2', web: 'inventory_2' } } as const;
const expiryIcons = { red: { ios: 'exclamationmark.circle.fill', android: 'error', web: 'error' }, orange: { ios: 'clock.fill', android: 'today', web: 'today' }, amber: { ios: 'clock.fill', android: 'schedule', web: 'schedule' }, green: { ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' }, neutral: { ios: 'questionmark.circle.fill', android: 'help', web: 'help' } } as const;
const ui = StyleSheet.create({
  screen: { flex: 1 },
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
  sectionHeading: { minHeight: 42, flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: -5 },
  sectionTitle: { flex: 1, flexShrink: 1, color: palette.ink, fontSize: 21, lineHeight: 28, fontWeight: '800', letterSpacing: -0.4 },
  viewAll: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: 4 },
  viewAllText: { color: palette.ink, fontSize: 14 },
  productList: { gap: 7 },
  productListWide: { flexDirection: 'row', flexWrap: 'wrap' },
  productCard: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 8, minHeight: 78, flexGrow: 1, flexBasis: 300, borderRadius: 15, backgroundColor: '#fff', borderWidth: 1, borderColor: '#f0f3f1', shadowColor: '#18382b', shadowOpacity: 0.035, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  productCard_red: { backgroundColor: '#fff4f2', borderColor: '#f5dfdc' },
  productIcon: { width: 44, height: 44, flexShrink: 0, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#f3f7f4' },
  productCopy: { flex: 1, minWidth: 0, gap: 1 },
  productTopline: { minWidth: 0, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  productName: { flex: 1, minWidth: 90, color: palette.ink, fontSize: 16, lineHeight: 21, fontWeight: '800' },
  cardChevron: { width: 24, flexShrink: 0, alignItems: 'center', justifyContent: 'center' },
  expiryPill: { maxWidth: '100%', flexShrink: 0, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 14 },
  expiry_red: { backgroundColor: '#ffe9e7' },
  expiry_orange: { backgroundColor: '#fff0e3' },
  expiry_amber: { backgroundColor: '#fff4dc' },
  expiry_green: { backgroundColor: '#edf7ef' },
  expiry_neutral: { backgroundColor: '#eff3f2' },
  expiryText: { flexShrink: 1, fontSize: 12, lineHeight: 16, fontWeight: '700' },
  productMeta: { flexShrink: 1, color: palette.muted, fontSize: 13, lineHeight: 18 },
  productLocation: { flexShrink: 1, color: palette.muted, fontSize: 13, lineHeight: 18 },
  emptyCard: { padding: 17, borderRadius: 18, backgroundColor: '#fff', borderWidth: 1, borderColor: palette.border, gap: 5 },
  emptyTitle: { color: palette.ink, fontSize: 17, fontWeight: '700' },
  emptyText: { color: palette.muted, fontSize: 14, lineHeight: 20 },
  addMenu: { alignSelf: 'flex-end', width: '100%', maxWidth: 420, padding: 6, gap: 0, borderRadius: 18, backgroundColor: '#fff', shadowColor: '#102a30', shadowOpacity: 0.18, shadowRadius: 14, shadowOffset: { width: 0, height: 5 }, elevation: 8 },
  addOption: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 8, borderRadius: 13, backgroundColor: '#fff' },
  addOptionIcon: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#eaf6ed' },
  shoppingOptionIcon: { backgroundColor: '#f3eaff' },
  addOptionCopy: { flex: 1, gap: 2 },
  addOptionTitle: { color: palette.ink, fontSize: 15, fontWeight: '800' },
  addOptionHint: { color: palette.muted, fontSize: 12 },
  shoppingCard: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderWidth: 1, borderColor: palette.border, borderRadius: 17, backgroundColor: '#fff' },
  scrollEndSpace: { height: FAB_SCROLL_END_PADDING },
  shoppingIcon: { width: 50, height: 50, flexShrink: 0, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: '#eaf6ed' },
  shoppingCopy: { flex: 1, gap: 3 },
  shoppingCount: { color: palette.ink, fontSize: 17, fontWeight: '800' },
  shoppingSub: { color: palette.muted, fontSize: 13 },
});
