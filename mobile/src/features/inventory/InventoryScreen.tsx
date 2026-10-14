import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, router, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { FoundationScreen } from '@/components/FoundationScreen';
import { Action, Field, styles } from '@/features/auth/AccountScreen';
import { useHousehold } from '@/features/auth/HouseholdScreen';
import { api, ApiError } from '@/lib/session';
import { Choices, InventoryForm } from './InventoryForm';
import { Category, InventoryItem, InventoryPage, expiryLabel, expiryTone, inventoryPath } from './types';

export default function InventoryScreen() {
  const household = useHousehold(); const client = useQueryClient();
  const params = useLocalSearchParams<{ itemId?: string }>();
  const focusedId = typeof params.itemId === 'string' ? params.itemId : undefined;
  const [searchInput, setSearchInput] = useState(''); const [search, setSearch] = useState('');
  const [category, setCategory] = useState(''); const [status, setStatus] = useState('Active');
  const [sort, setSort] = useState('expiry'); const [page, setPage] = useState(1);
  const [transition, setTransition] = useState<{ item: InventoryItem; action: 'consume' | 'discard' } | null>(null);
  const [editor, setEditor] = useState<InventoryItem | null>(null);
  const [message, setMessage] = useState(''); const [moreFilters, setMoreFilters] = useState(false);
  const [openItemId, setOpenItemId] = useState<string | null>(focusedId ?? null);
  const { width } = useWindowDimensions();
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
    <FoundationScreen title="Inventory" description="Find what you have and review what’s coming up." hideHeading={!focusedId}>
      {household.isPending ? <ActivityIndicator accessibilityLabel="Loading household" /> : household.isError ? <View style={styles.card}><Text style={styles.error}>{household.error.message}</Text><Action title="Retry household" onPress={() => { household.refetch(); }} /></View> : !household.data ? <View style={styles.card}><Text style={styles.body}>Create or join a household before adding inventory.</Text><Link href="/" style={{ minHeight: 48, padding: 12, color: '#22634b', fontSize: 16 }}>Go to household setup</Link></View> : <>
        {focusedId ? <Link href="/inventory" accessibilityRole="button" style={ui.backLink}>← All products</Link> : <View style={ui.listHeader}>
          <View style={ui.titleRow}><Text accessibilityRole="header" style={ui.title}>Inventory</Text>{inventory.data && <Text style={ui.count}>{inventory.data.total} {inventory.data.total === 1 ? 'product' : 'products'}</Text>}</View>
          <View style={ui.searchRow}><View style={{ flex: 1 }}><Field label="Search products" placeholder="Search products…" value={searchInput} onChangeText={setSearchInput} maxLength={120} onSubmitEditing={() => filter(setSearch, searchInput.trim())} /></View><Action variant="secondary" title="Search" onPress={() => filter(setSearch, searchInput.trim())} /></View>
          <Choices label="Category filter" values={[{ value: '', label: 'All' }, ...(categories.data?.map(c => ({ value: c.id, label: c.name })) ?? [])]} selected={category} onSelect={value => filter(setCategory, value)} />
          <View style={ui.countSortRow}>
            <Action variant="secondary" title={moreFilters ? 'Hide filters' : 'Sort'} onPress={() => setMoreFilters(!moreFilters)} />
            <Pressable accessibilityRole="button" accessibilityLabel={inventory.isFetching ? 'Refreshing inventory' : 'Refresh inventory'} disabled={inventory.isFetching} style={ui.refresh} onPress={() => { inventory.refetch(); categories.refetch(); }}><Text style={ui.sortText}>{sort === 'expiry' ? 'Nearest expiry' : sort === 'name' ? 'Name' : 'Recently updated'}</Text><SymbolView name={{ ios: 'chevron.down', android: 'arrow_drop_down', web: 'arrow_drop_down' }} tintColor="#193b2e" size={17} /></Pressable>
            {!!(searchInput || search || category || status !== 'Active' || sort !== 'expiry') && <Action variant="secondary" title="Clear filters" onPress={() => { setSearchInput(''); setSearch(''); setCategory(''); setStatus('Active'); setSort('expiry'); setPage(1); }} />}
          </View>
          {moreFilters && <><Choices label="Status filter" values={['Active', 'Consumed', 'Discarded', 'All'].map(value => ({ value, label: value }))} selected={status} onSelect={value => filter(setStatus, value)} /><Choices label="Sort" values={[{ value: 'expiry', label: 'Nearest date' }, { value: 'name', label: 'Name' }, { value: 'updated', label: 'Recently updated' }]} selected={sort} onSelect={value => filter(setSort, value)} /></>}
        </View>}
        {categories.isError && <Text style={styles.error}>Could not load categories: {categories.error.message}</Text>}
        {inventory.isError && <View style={styles.card}><Text accessibilityRole="alert" style={styles.error}>{inventory.error.message}{inventory.data ? ' Showing previously loaded items.' : ''}</Text>{focusedId && <Action title="Retry product" disabled={inventory.isFetching} onPress={() => { inventory.refetch(); }} />}</View>}
        {!!message && <Text accessibilityLiveRegion="polite" style={styles.body}>{message}</Text>}
        {inventory.isPending && <ActivityIndicator accessibilityLabel="Loading inventory" />}
        {!inventory.isPending && !inventory.isError && inventory.data?.items.length === 0 && <View style={styles.card}><Text style={styles.heading}>{inventory.data.total === 0 ? 'No matching products yet' : 'No products on this page'}</Text><Text style={styles.body}>Add a product or change the filters to view household inventory and history.</Text></View>}
        <View style={ui.grid}>{inventory.data?.items.map(item => <View key={item.id} style={[ui.product, item.status === 'Active' && expiryTone(item) === 'red' && ui.expiredProduct, { width: width >= 1000 ? '48.5%' : '100%' }]}>
          <Pressable accessibilityRole="button" accessibilityLabel={`Open ${item.name}`} accessibilityState={{ expanded: openItemId === item.id }} onPress={() => setOpenItemId(openItemId === item.id ? null : item.id)} style={ui.productHeader}>
          <View style={ui.productIcon}><SymbolView name={{ ios: 'shippingbox.fill', android: 'inventory_2', web: 'inventory_2' }} tintColor="#008b50" size={22} /></View>
          <View style={ui.productCopy}><View style={ui.productTop}><Text numberOfLines={1} accessibilityRole="header" style={ui.productName}>{item.name}</Text><Text style={ui.quantity}>{item.quantity} {item.unit}</Text></View><Text numberOfLines={1} style={ui.meta}>{categories.data?.find(c => c.id === item.categoryId)?.name ?? 'Category'} · {item.storageLocation || 'Location not set'}</Text>
            <View style={ui.dateRow}><Text style={[ui.badge, ui[`badge_${expiryTone(item)}`]]}>{expiryLabel(item)}</Text>{item.expiryDate && <Text style={ui.dateText}>{item.expiryType === 'Estimated' ? 'Estimated' : 'Printed'} · {item.expiryDate}</Text>}</View>
          </View><SymbolView name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} tintColor="#7a8981" size={17} />
          </Pressable>
          {openItemId === item.id && <View style={ui.details}>
            {editor?.id === item.id ? <InventoryForm key={item.version} item={item} categories={categories.data ?? []} onCancel={() => setEditor(null)} onReload={latest => { setEditor(latest); client.invalidateQueries({ queryKey: ['inventory', household.data?.id] }); client.invalidateQueries({ queryKey: ['dashboard', household.data?.id] }); }} onSaved={async () => { setEditor(null); setMessage('Product saved.'); await client.invalidateQueries({ queryKey: ['inventory', household.data?.id] }); await client.invalidateQueries({ queryKey: ['dashboard', household.data?.id] }); }} /> : <>
            <Text style={ui.detailsTitle}>Product details</Text><Text style={ui.meta}>Category · {categories.data?.find(c => c.id === item.categoryId)?.name ?? 'Category'}</Text><Text style={ui.meta}>Location · {item.storageLocation || 'Not set'}</Text><Text style={ui.meta}>Quantity · {item.quantity} {item.unit}</Text>
            {item.expiryType === 'Estimated' && <Text style={styles.body}>Estimated dates are editable guides, not verified safety deadlines.</Text>}{item.purchaseDate && <Text style={styles.body}>Purchased: {item.purchaseDate}</Text>}{item.notes && <Text style={styles.body}>{item.notes}</Text>}
            {item.status === 'Active' && <><Action variant="secondary" title="Edit product" label={`Edit ${item.name}`} onPress={() => setEditor(item)} />
              {transition?.item.id === item.id ? <><Text style={styles.body}>Mark {item.name} as {transition.action === 'consume' ? 'consumed' : 'discarded'}? It will move to history and future item reminders will stop.</Text>{lifecycle.isError && <Text accessibilityRole="alert" style={styles.error}>{lifecycle.error.message}</Text>}{conflict && <Action title="Reload inventory and review" disabled={inventory.isFetching} onPress={async () => { const result = await inventory.refetch(); if (result.isSuccess) { setTransition(null); lifecycle.reset(); setMessage('Latest inventory loaded. Review the item before changing it.'); } }} />}<Action title={lifecycle.isPending ? 'Saving…' : 'Confirm move to history'} disabled={lifecycle.isPending || conflict} onPress={() => lifecycle.mutate()} /><Action variant="secondary" title="Keep active" disabled={lifecycle.isPending} onPress={() => { setTransition(null); lifecycle.reset(); }} /></> : <View style={ui.toolbar}><View style={{ flex: 1 }}><Action variant="secondary" title="Consumed" label={`Mark ${item.name} consumed`} onPress={() => { lifecycle.reset(); setTransition({ item, action: 'consume' }); }} /></View><View style={{ flex: 1 }}><Action variant="danger" title="Discarded" label={`Mark ${item.name} discarded`} onPress={() => { lifecycle.reset(); setTransition({ item, action: 'discard' }); }} /></View></View>}
            </>}
            </>}
          </View>}
        </View>)}</View>
        {inventory.data && inventory.data.total > inventory.data.pageSize && <View style={ui.toolbar}><Text style={styles.body}>Page {page} of {Math.ceil(inventory.data.total / inventory.data.pageSize)}</Text><Action variant="secondary" title="Previous page" disabled={page <= 1 || inventory.isFetching} onPress={() => setPage(p => p - 1)} /><Action variant="secondary" title="Next page" disabled={page * inventory.data.pageSize >= inventory.data.total || inventory.isFetching} onPress={() => setPage(p => p + 1)} /></View>}
      </>}
    </FoundationScreen>
    {!focusedId && !!household.data && <Pressable accessibilityRole="button" accessibilityLabel="Add product" style={ui.fab} onPress={() => router.push('/add-inventory')}><SymbolView name={{ ios: 'plus', android: 'add', web: 'add' }} tintColor="#fff" size={28} /></Pressable>}
  </View>;
}

const ui = StyleSheet.create({
  screen: { flex: 1 }, listHeader: { gap: 8 }, titleRow: { minHeight: 34, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, title: { color: '#102d24', fontSize: 28, lineHeight: 34, fontWeight: '800', letterSpacing: -0.6 }, count: { color: '#596b62', fontSize: 13 },
  toolbar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }, searchRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-end' }, countSortRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }, refresh: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8 }, sortText: { color: '#193b2e', fontSize: 14, fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'flex-start' }, quantity: { color: '#52665a', backgroundColor: '#f0f5f1', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 9, fontWeight: '600', fontSize: 12 },
  badge: { alignSelf: 'flex-start', color: '#22634b', backgroundColor: '#edf5ef', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, fontSize: 11, fontWeight: '700' }, badge_red: { color: '#9c2727', backgroundColor: '#ffe9e7' }, badge_orange: { color: '#a94d00', backgroundColor: '#fff0e3' }, badge_amber: { color: '#85520c', backgroundColor: '#fff4dc' }, badge_green: { color: '#22634b', backgroundColor: '#eaf6ed' }, badge_neutral: { color: '#52665a', backgroundColor: '#f0f5f1' }, expiredProduct: { backgroundColor: '#fff7f5', borderColor: '#f2deda' },
  product: { minHeight: 82, gap: 9, padding: 9, borderRadius: 15, backgroundColor: '#fff', borderWidth: 1, borderColor: '#f0f3f1', shadowColor: '#18382b', shadowOpacity: 0.035, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 1 }, productHeader: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 9 }, productIcon: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#edf6ef' }, productCopy: { flex: 1, minWidth: 0, gap: 3 }, productTop: { flexDirection: 'row', alignItems: 'center', gap: 6 }, productName: { flex: 1, color: '#102d24', fontSize: 16, fontWeight: '800' }, meta: { color: '#627269', fontSize: 12, lineHeight: 16 },
  dateRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 }, dateText: { color: '#52665a', fontSize: 11 }, backLink: { alignSelf: 'flex-start', minHeight: 48, padding: 12, color: '#22634b', fontSize: 16, fontWeight: '600' }, details: { width: '100%', gap: 10, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#e0e8e2' }, detailsTitle: { color: '#193b2e', fontSize: 16, fontWeight: '800' }, fab: { position: 'absolute', right: 18, bottom: 92, width: 58, height: 58, alignItems: 'center', justifyContent: 'center', borderRadius: 29, backgroundColor: '#008b50', borderWidth: 2, borderColor: '#fff', elevation: 7, shadowColor: '#102a30', shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
});
