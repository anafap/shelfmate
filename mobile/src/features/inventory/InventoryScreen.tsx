import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, router, useLocalSearchParams } from 'expo-router';
import { SymbolView, type AndroidSymbol, type SFSymbol } from 'expo-symbols';
import { useContext, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { FoundationScreen } from '@/components/FoundationScreen';
import { FAB_SCROLL_END_PADDING, FloatingActionButton } from '@/components/FloatingActionButton';
import { Action, styles } from '@/features/auth/AccountScreen';
import { useHousehold } from '@/features/auth/HouseholdScreen';
import { api, ApiError } from '@/lib/session';
import { Choices, InventoryForm } from './InventoryForm';
import { Category, InventoryItem, InventoryPage, expiryTone, inventoryPath } from './types';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

export default function InventoryScreen() {
  const household = useHousehold(); const client = useQueryClient();
  const params = useLocalSearchParams<{ itemId?: string }>();
  const focusedId = typeof params.itemId === 'string' ? params.itemId : undefined;
  const [searchInput, setSearchInput] = useState(''); const [search, setSearch] = useState('');
  const [category, setCategory] = useState(''); const [status, setStatus] = useState('Active');
  const [sort, setSort] = useState('expiry'); const [page, setPage] = useState(1);
  const [transition, setTransition] = useState<{ item: InventoryItem; action: 'consume' | 'discard' } | null>(null);
  const [editor, setEditor] = useState<InventoryItem | null>(null);
  const [message, setMessage] = useState(''); const [openDropdown, setOpenDropdown] = useState<'status' | 'sort' | null>(null);
  const [openItemId, setOpenItemId] = useState<string | null>(focusedId ?? null);
  const { width } = useWindowDimensions();
  const insets = useContext(SafeAreaInsetsContext);
  useEffect(() => {
    if (!message) return;
    const timeout = setTimeout(() => setMessage(''), 2400);
    return () => clearTimeout(timeout);
  }, [message]);
  const categories = useQuery({ queryKey: ['categories', household.data?.id], queryFn: () => api<Category[]>('/households/current/categories'), enabled: !!household.data, retry: false });
  const inventory = useQuery({ queryKey: ['inventory', household.data?.id, focusedId, category, status, search, sort, page], queryFn: async () => {
    if (focusedId) return { items: [await api<InventoryItem>(`${inventoryPath}/${focusedId}`)], total: 1, page: 1, pageSize: 20 };
    const query = new URLSearchParams({ status, search, sort, page: String(page), pageSize: '20' });
    if (category) query.set('category', category);
    return api<InventoryPage>(`${inventoryPath}?${query}`);
  }, enabled: !!household.data, retry: false });
  const lifecycle = useMutation({ mutationFn: async () => {
    if (!transition) return;
    await api(`${inventoryPath}/${transition.item.id}/${transition.action}`, { version: transition.item.version }, 'POST');
  }, onSuccess: async () => {
    setTransition(null); setMessage('Item moved to history.');
    await client.invalidateQueries({ queryKey: ['inventory', household.data?.id] });
    await client.invalidateQueries({ queryKey: ['dashboard', household.data?.id] });
  }});
  function filter(setter: (value: string) => void, value: string) { setter(value); setPage(1); }
  const conflict = lifecycle.error instanceof ApiError && lifecycle.error.status === 409;
  return <View style={ui.screen}>
    <FoundationScreen title="Inventory" description="Find what you have and review what’s coming up." hideHeading={!focusedId} fill testID="inventory-scroll" topPadding={!focusedId ? 8 : undefined} bottomPadding={focusedId ? undefined : FAB_SCROLL_END_PADDING}>
      {household.isPending ? <ActivityIndicator accessibilityLabel="Loading household" /> : household.isError ? <View style={styles.card}><Text style={styles.error}>{household.error.message}</Text><Action title="Retry household" onPress={() => { household.refetch(); }} /></View> : !household.data ? <View style={styles.card}><Text style={styles.body}>Create or join a household before adding inventory.</Text><Link href="/" style={{ minHeight: 48, padding: 12, color: '#22634b', fontSize: 16 }}>Go to household setup</Link></View> : <>
        {focusedId ? <Link href="/inventory" accessibilityRole="button" style={ui.backLink}>← All products</Link> : <View style={ui.listHeader}>
          <View style={ui.titleRow}><Text accessibilityRole="header" style={ui.title}>Inventory</Text>{inventory.data && <Text style={ui.count}>{inventory.data.total} {inventory.data.total === 1 ? 'product' : 'products'}</Text>}</View>
          <View style={ui.searchBar}><SymbolView name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }} tintColor="#66766d" size={19} /><TextInput accessibilityLabel="Search products" placeholder="Search products…" placeholderTextColor="#66766d" value={searchInput} maxLength={120} returnKeyType="search" onChangeText={value => { setSearchInput(value); filter(setSearch, value.trim()); }} style={ui.searchInput} /></View>
          <Choices label="Category filter" values={[{ value: '', label: 'All' }, ...(categories.data?.map(c => ({ value: c.id, label: c.name })) ?? [])]} selected={category} onSelect={value => filter(setCategory, value)} />
          <View style={ui.dropdownRow}>
            <FilterDropdown label="Status" value={status} open={openDropdown === 'status'} onPress={() => setOpenDropdown(openDropdown === 'status' ? null : 'status')} options={['Active', 'Consumed', 'Discarded', 'All']} onSelect={value => { filter(setStatus, value); setOpenDropdown(null); }} />
            <FilterDropdown label="Sort" value={sortLabel(sort)} open={openDropdown === 'sort'} onPress={() => setOpenDropdown(openDropdown === 'sort' ? null : 'sort')} options={[{ label: 'Nearest expiry', value: 'expiry' }, { label: 'Name (A–Z)', value: 'name' }, { label: 'Recently updated', value: 'updated' }]} onSelect={value => { filter(setSort, value); setOpenDropdown(null); }} />
          </View>
          {!!(searchInput || search || category || status !== 'Active' || sort !== 'expiry') && <Pressable accessibilityRole="button" style={ui.clearFilters} onPress={() => { setSearchInput(''); setSearch(''); setCategory(''); setStatus('Active'); setSort('expiry'); setPage(1); }}><Text style={ui.clearFiltersText}>Clear filters</Text></Pressable>}
        </View>}
        {categories.isError && <Text style={styles.error}>Could not load categories: {categories.error.message}</Text>}
        {inventory.isError && <View style={styles.card}><Text accessibilityRole="alert" style={styles.error}>{inventory.error.message}{inventory.data ? ' Showing previously loaded items.' : ''}</Text><Action title={focusedId ? 'Retry product' : 'Refresh inventory'} disabled={inventory.isFetching} onPress={() => { inventory.refetch(); }} /></View>}
        {!!message && <Text accessibilityLiveRegion="polite" style={ui.feedback}>{message}</Text>}
        {inventory.isPending && <ActivityIndicator accessibilityLabel="Loading inventory" />}
        {!inventory.isPending && !inventory.isError && inventory.data?.items.length === 0 && <View style={styles.card}><Text style={styles.heading}>{inventory.data.total === 0 ? 'No matching products yet' : 'No products on this page'}</Text><Text style={styles.body}>Add a product or change the filters to view household inventory and history.</Text></View>}
        <View style={ui.grid}>{inventory.data?.items.map(item => <View key={item.id} style={[ui.product, item.status === 'Active' && expiryTone(item) === 'red' && ui.expiredProduct, { width: width >= 1000 ? '48.5%' : '100%' }]}>
          <Pressable accessibilityRole="button" accessibilityLabel={`Open ${item.name}`} accessibilityState={{ expanded: openItemId === item.id }} onPress={() => setOpenItemId(openItemId === item.id ? null : item.id)} style={ui.productHeader}>
          <View style={ui.productIcon}><SymbolView name={{ ios: 'shippingbox.fill', android: 'inventory_2', web: 'inventory_2' }} tintColor="#008b50" size={22} /></View>
          <View style={ui.productCopy}><View style={ui.productTop}><Text numberOfLines={1} accessibilityRole="header" style={ui.productName}>{item.name}</Text><Text style={ui.quantity}>{formatQuantityUnit(item.quantity, item.unit)}</Text></View><Text numberOfLines={1} style={ui.meta}>{categories.data?.find(c => c.id === item.categoryId)?.name ?? 'Category'} · {item.storageLocation || 'Location not set'}</Text>
            <View style={ui.dateRow}><Text style={[ui.badge, ui[`badge_${expiryTone(item)}`]]}>{inventoryExpiryLabel(item)}</Text>{item.expiryDate && <Text style={ui.dateText}>{item.expiryType === 'Estimated' ? 'Estimated' : 'Printed'} · {item.expiryDate}</Text>}</View>
          </View><SymbolView name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} tintColor="#7a8981" size={17} />
          </Pressable>
          {openItemId === item.id && <View style={ui.details}>
            {editor?.id === item.id ? <InventoryForm key={item.version} item={item} categories={categories.data ?? []} onCancel={() => setEditor(null)} onReload={latest => { setEditor(latest); client.invalidateQueries({ queryKey: ['inventory', household.data?.id] }); client.invalidateQueries({ queryKey: ['dashboard', household.data?.id] }); }} onSaved={async () => { setEditor(null); setMessage('Product saved'); await client.invalidateQueries({ queryKey: ['inventory', household.data?.id] }); await client.invalidateQueries({ queryKey: ['dashboard', household.data?.id] }); }} /> : <>
            <Text style={ui.detailsTitle}>Product details</Text><Text style={ui.meta}>Category · {categories.data?.find(c => c.id === item.categoryId)?.name ?? 'Category'}</Text><Text style={ui.meta}>Location · {item.storageLocation || 'Not set'}</Text><Text style={ui.meta}>Quantity · {formatQuantityUnit(item.quantity, item.unit)}</Text>
            {item.expiryType === 'Estimated' && <Text style={styles.body}>Estimated dates are editable guides, not verified safety deadlines.</Text>}{item.purchaseDate && <Text style={styles.body}>Purchased: {item.purchaseDate}</Text>}{item.notes && <Text style={styles.body}>{item.notes}</Text>}
            {item.status === 'Active' && <>
              {transition?.item.id === item.id ? <><Text style={styles.body}>Mark {item.name} as {transition.action === 'consume' ? 'consumed' : 'discarded'}? It will move to history and future item reminders will stop.</Text>{lifecycle.isError && <Text accessibilityRole="alert" style={styles.error}>{lifecycle.error.message}</Text>}{conflict && <Action title="Reload inventory and review" disabled={inventory.isFetching} onPress={async () => { const result = await inventory.refetch(); if (result.isSuccess) { setTransition(null); lifecycle.reset(); setMessage('Latest details loaded. Review before making changes.'); } }} />}<Action title={lifecycle.isPending ? 'Saving…' : 'Confirm move to history'} disabled={lifecycle.isPending || conflict} onPress={() => lifecycle.mutate()} /><Action variant="secondary" title="Keep active" disabled={lifecycle.isPending} onPress={() => { setTransition(null); lifecycle.reset(); }} /></> : <View style={ui.actionRow}>
                <InventoryAction label={`Edit ${item.name}`} title="Edit" icon="pencil" tone="neutral" onPress={() => setEditor(item)} />
                <InventoryAction label={`Mark ${item.name} consumed`} title="Consumed" icon="check" tone="green" onPress={() => { lifecycle.reset(); setTransition({ item, action: 'consume' }); }} />
                <InventoryAction label={`Mark ${item.name} discarded`} title="Discarded" icon="trash" tone="red" onPress={() => { lifecycle.reset(); setTransition({ item, action: 'discard' }); }} />
              </View>}
            </>}
            </>}
          </View>}
        </View>)}</View>
        {inventory.data && inventory.data.total > inventory.data.pageSize && <View style={ui.toolbar}><Text style={styles.body}>Page {page} of {Math.ceil(inventory.data.total / inventory.data.pageSize)}</Text><Action variant="secondary" title="Previous page" disabled={page <= 1 || inventory.isFetching} onPress={() => setPage(p => p - 1)} /><Action variant="secondary" title="Next page" disabled={page * inventory.data.pageSize >= inventory.data.total || inventory.isFetching} onPress={() => setPage(p => p + 1)} /></View>}
      </>}
    </FoundationScreen>
    {!focusedId && !!household.data && <FloatingActionButton label="Add product" bottomInset={width >= 1000 ? insets?.bottom ?? 0 : 0} onPress={() => router.push('/add-inventory')} testID="inventory-fab" />}
  </View>;
}

const ui = StyleSheet.create({
  screen: { flex: 1 }, listHeader: { gap: 8 }, titleRow: { minHeight: 34, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, title: { color: '#102d24', fontSize: 28, lineHeight: 34, fontWeight: '800', letterSpacing: -0.6 }, count: { color: '#596b62', fontSize: 13 },
  toolbar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }, searchBar: { minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 13, borderRadius: 13, backgroundColor: '#eef2ef' }, searchInput: { flex: 1, minHeight: 46, paddingVertical: 8, color: '#193b2e', fontSize: 15 }, dropdownRow: { flexDirection: 'row', alignItems: 'center', gap: 8 }, feedback: { color: '#22634b', fontSize: 13, fontWeight: '700' },
  dropdown: { flex: 1, minWidth: 0, position: 'relative' }, dropdownOpen: { zIndex: 10 }, dropdownButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 11, borderWidth: 1, borderColor: '#dce6df', borderRadius: 11, backgroundColor: '#fff' }, dropdownLabel: { color: '#64736b', fontSize: 11 }, dropdownValue: { flex: 1, color: '#193b2e', fontSize: 13, fontWeight: '700' }, dropdownOptions: { position: 'absolute', zIndex: 10, top: 48, left: 0, right: 0, padding: 5, borderWidth: 1, borderColor: '#dce6df', borderRadius: 12, backgroundColor: '#fff', elevation: 6, shadowColor: '#18382b', shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } }, dropdownOption: { minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 9, borderRadius: 8 }, dropdownOptionSelected: { backgroundColor: '#edf5ef' }, dropdownOptionText: { color: '#193b2e', fontSize: 13 }, clearFilters: { alignSelf: 'flex-end', minHeight: 24, justifyContent: 'center', paddingHorizontal: 7 }, clearFiltersText: { color: '#22634b', fontSize: 12, fontWeight: '600' },
  actionRow: { flexDirection: 'row', gap: 7 }, actionButton: { flex: 1, minWidth: 0, minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: 6, borderWidth: 1, borderRadius: 10 }, actionNeutral: { backgroundColor: '#f0f5f1', borderColor: '#dce6df' }, actionGreen: { backgroundColor: '#eaf6ed', borderColor: '#d3e8d8' }, actionRed: { backgroundColor: '#fff5f3', borderColor: '#f2deda' }, actionText: { fontSize: 12, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'flex-start' }, quantity: { color: '#52665a', backgroundColor: '#f0f5f1', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 9, fontWeight: '600', fontSize: 12 },
  badge: { alignSelf: 'flex-start', color: '#22634b', backgroundColor: '#edf5ef', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, fontSize: 11, fontWeight: '700' }, badge_red: { color: '#9c2727', backgroundColor: '#ffe9e7' }, badge_orange: { color: '#a94d00', backgroundColor: '#fff0e3' }, badge_amber: { color: '#85520c', backgroundColor: '#fff4dc' }, badge_green: { color: '#22634b', backgroundColor: '#eaf6ed' }, badge_neutral: { color: '#52665a', backgroundColor: '#f0f5f1' }, expiredProduct: { backgroundColor: '#fff7f5', borderColor: '#f2deda' },
  product: { minHeight: 82, gap: 9, padding: 9, borderRadius: 15, backgroundColor: '#fff', borderWidth: 1, borderColor: '#f0f3f1', shadowColor: '#18382b', shadowOpacity: 0.035, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 1 }, productHeader: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 9 }, productIcon: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#edf6ef' }, productCopy: { flex: 1, minWidth: 0, gap: 3 }, productTop: { flexDirection: 'row', alignItems: 'center', gap: 6 }, productName: { flex: 1, color: '#102d24', fontSize: 16, fontWeight: '800' }, meta: { color: '#627269', fontSize: 12, lineHeight: 16 },
  dateRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 }, dateText: { color: '#52665a', fontSize: 11 }, backLink: { alignSelf: 'flex-start', minHeight: 48, padding: 12, color: '#22634b', fontSize: 16, fontWeight: '600' }, details: { width: '100%', gap: 10, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#e0e8e2' }, detailsTitle: { color: '#193b2e', fontSize: 16, fontWeight: '800' },
});

function sortLabel(value: string) {
  if (value === 'name') return 'Name (A–Z)';
  if (value === 'updated') return 'Recently updated';
  return 'Nearest expiry';
}

function inventoryExpiryLabel(item: InventoryItem) {
  if (item.status !== 'Active') return item.status;
  if (item.expiryStatus === 'Unknown') return 'Expiry unknown';
  if (item.expiryStatus === 'Expired') {
    if (item.daysRemaining !== null && item.daysRemaining < 0) {
      const daysAgo = -item.daysRemaining;
      const elapsed = daysAgo === 1 ? 'yesterday' : `${daysAgo} days ago`;
      return item.expiryType === 'Estimated' ? `Estimated date passed ${elapsed}` : `Expired ${elapsed}`;
    }
    return item.expiryType === 'Estimated' ? 'Estimated date passed · review item' : 'Expired · review item';
  }
  if (item.daysRemaining === 0) return item.expiryType === 'Estimated' ? 'Estimated date is today' : 'Expires today';
  if (item.expiryStatus === 'ExpiringSoon' && item.daysRemaining !== null) {
    const duration = item.daysRemaining === 1 ? 'tomorrow' : `in ${item.daysRemaining} days`;
    return item.expiryType === 'Estimated' ? `Estimated date ${duration}` : `Expires ${duration}`;
  }
  return 'In stock';
}

function formatQuantityUnit(quantity: number, unit: string) {
  const normalizedUnit = unit.toLocaleLowerCase();
  const pluralUnits: Record<string, string> = { piece: 'pieces', pieces: 'pieces', pack: 'packs', packs: 'packs', bottle: 'bottles', bottles: 'bottles', box: 'boxes', boxes: 'boxes' };
  const pluralUnit = pluralUnits[normalizedUnit];
  if (!pluralUnit) return `${quantity} ${unit}`;
  if (quantity === 1) {
    const singularUnit: Record<string, string> = { pieces: 'piece', packs: 'pack', bottles: 'bottle', boxes: 'box' };
    return `${quantity} ${singularUnit[pluralUnit]}`;
  }
  return `${quantity} ${pluralUnit}`;
}

function FilterDropdown({ label, value, open, onPress, options, onSelect }: {
  label: string; value: string; open: boolean; onPress: () => void;
  options: string[] | { label: string; value: string }[]; onSelect: (value: string) => void;
}) {
  const values = options.map(option => typeof option === 'string' ? { label: option, value: option } : option);
  return <View style={[ui.dropdown, open && ui.dropdownOpen]}>
    <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${value}`} accessibilityState={{ expanded: open }} onPress={onPress} style={ui.dropdownButton}>
      <Text style={ui.dropdownLabel}>{label}</Text><Text numberOfLines={1} style={ui.dropdownValue}>{value}</Text><SymbolView name={{ ios: 'chevron.down', android: 'arrow_drop_down', web: 'arrow_drop_down' }} tintColor="#64736b" size={16} />
    </Pressable>
    {open && <View style={ui.dropdownOptions}>{values.map(option => <Pressable key={option.value} accessibilityRole="button" accessibilityLabel={`${label} option: ${option.label}`} accessibilityState={{ selected: value === option.label || value === option.value }} onPress={() => onSelect(option.value)} style={[ui.dropdownOption, (value === option.label || value === option.value) && ui.dropdownOptionSelected]}><Text style={ui.dropdownOptionText}>{option.label}</Text>{(value === option.label || value === option.value) && <SymbolView name={{ ios: 'checkmark', android: 'check', web: 'check' }} tintColor="#22634b" size={15} />}</Pressable>)}</View>}
  </View>;
}

function InventoryAction({ label, title, icon, tone, onPress }: { label: string; title: string; icon: string; tone: 'neutral' | 'green' | 'red'; onPress: () => void }) {
  const color = tone === 'red' ? '#a63c35' : tone === 'green' ? '#22634b' : '#425b4d';
  const symbols: Record<string, { ios: SFSymbol; android: AndroidSymbol; web: AndroidSymbol }> = {
    pencil: { ios: 'pencil', android: 'edit', web: 'edit' },
    check: { ios: 'checkmark.circle', android: 'check_circle_outline', web: 'check_circle_outline' },
    trash: { ios: 'trash', android: 'delete_outline', web: 'delete_outline' },
  };
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={[ui.actionButton, tone === 'red' ? ui.actionRed : tone === 'green' ? ui.actionGreen : ui.actionNeutral]}><SymbolView name={symbols[icon]} tintColor={color} size={16} /><Text numberOfLines={1} style={[ui.actionText, { color }]}>{title}</Text></Pressable>;
}
