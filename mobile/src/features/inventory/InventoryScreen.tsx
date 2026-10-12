import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { FoundationScreen } from '@/components/FoundationScreen';
import { Action, Field, styles } from '@/features/auth/AccountScreen';
import { useHousehold } from '@/features/auth/HouseholdScreen';
import { api, ApiError } from '@/lib/session';
import { Choices, InventoryForm } from './InventoryForm';
import { Category, InventoryItem, InventoryPage, expiryLabel, inventoryPath } from './types';

export default function InventoryScreen() {
  const household = useHousehold(); const client = useQueryClient();
  const [searchInput, setSearchInput] = useState(''); const [search, setSearch] = useState('');
  const [category, setCategory] = useState(''); const [status, setStatus] = useState('Active');
  const [sort, setSort] = useState('expiry'); const [page, setPage] = useState(1);
  const [editor, setEditor] = useState<InventoryItem | 'new' | null>(null);
  const [transition, setTransition] = useState<{ item: InventoryItem; action: 'consume' | 'discard' } | null>(null);
  const [message, setMessage] = useState('');
  const [moreFilters, setMoreFilters] = useState(false);
  const [openItemId, setOpenItemId] = useState<string | null>(null);
  const { width } = useWindowDimensions();
  const categories = useQuery({ queryKey: ['categories', household.data?.id], queryFn: () => api<Category[]>('/households/current/categories'), enabled: !!household.data, retry: false });
  const inventory = useQuery({ queryKey: ['inventory', household.data?.id, category, status, search, sort, page], queryFn: () => {
    const params = new URLSearchParams({ status, search, sort, page: String(page), pageSize: '20' });
    if (category) params.set('category', category);
    return api<InventoryPage>(`${inventoryPath}?${params}`);
  }, enabled: !!household.data, retry: false });
  const lifecycle = useMutation({ mutationFn: async () => {
    if (!transition) return;
    await api(`${inventoryPath}/${transition.item.id}/${transition.action}`, { version: transition.item.version }, 'POST');
  }, onSuccess: async () => {
    setTransition(null); setMessage('Item moved to history.');
    await client.invalidateQueries({ queryKey: ['inventory', household.data?.id] });
    await client.invalidateQueries({ queryKey: ['dashboard', household.data?.id] });
  }});
  function filter(setter: (v: string) => void, value: string) { setter(value); setPage(1); }
  const conflict = lifecycle.error instanceof ApiError && lifecycle.error.status === 409;
  const editingId = editor && editor !== 'new' ? editor.id : null;
  const editorForm = editor && categories.data ? <InventoryForm key={editor === 'new' ? 'new' : editor.version} item={editor === 'new' ? null : editor} categories={categories.data} onCancel={() => setEditor(null)} onReload={latest => { setEditor(latest.status === 'Active' ? latest : null); setMessage('Latest details loaded. Review before making changes.'); client.invalidateQueries({ queryKey: ['inventory', household.data?.id] }); client.invalidateQueries({ queryKey: ['dashboard', household.data?.id] }); }} onSaved={async () => { setEditor(null); setMessage('Product saved.'); setPage(1); await client.invalidateQueries({ queryKey: ['inventory', household.data?.id] });
    await client.invalidateQueries({ queryKey: ['dashboard', household.data?.id] }); }} /> : null;
  return <FoundationScreen title="Inventory" description="Find what you have. Review what’s coming up. Add a product in just a few taps.">
    {household.isPending ? <ActivityIndicator accessibilityLabel="Loading household" /> : household.isError ? <View style={styles.card}><Text style={styles.error}>{household.error.message}</Text><Action title="Retry household" onPress={() => { household.refetch(); }} /></View> : !household.data ? <View style={styles.card}><Text style={styles.body}>Create or join a household before adding inventory.</Text><Link href="/" style={{ minHeight: 48, padding: 12, color: '#22634b', fontSize: 16 }}>Go to household setup</Link></View> : <>
      <View style={styles.card}>
        <View style={ui.toolbar}><View style={{ flex: 1 }}><Text style={styles.heading}>Your products</Text><Text style={styles.body}>Shared with your household</Text></View>
        <Action title="Add product" disabled={!categories.data?.length || !!editor || !!transition} onPress={() => { setEditor('new'); setMessage(''); }} />
        </View>
        <View style={ui.searchRow}><View style={{ flex: 1 }}><Field label="Search products" placeholder="Try milk, rice, or coffee…" value={searchInput} onChangeText={setSearchInput} maxLength={120} editable={!editor && !transition} onSubmitEditing={() => filter(setSearch, searchInput.trim())} /></View>
        <Action variant="secondary" title="Search" disabled={!!editor || !!transition} onPress={() => filter(setSearch, searchInput.trim())} /></View>
        <Choices label="Category filter" values={[{ value: '', label: 'All categories' }, ...(categories.data?.map(c => ({ value: c.id, label: c.name })) ?? [])]} selected={category} disabled={!!editor || !!transition} onSelect={v => filter(setCategory, v)} />
        <View style={ui.toolbar}>
          <Action variant="secondary" title={moreFilters ? 'Hide filters' : 'More filters'} onPress={() => setMoreFilters(!moreFilters)} />
          <Action variant="secondary" title={inventory.isFetching ? 'Refreshing…' : 'Refresh inventory'} disabled={inventory.isFetching} onPress={() => { inventory.refetch(); categories.refetch(); }} />
          {!!(searchInput || search || category || status !== 'Active' || sort !== 'expiry') && <Action variant="secondary" title="Clear filters" disabled={!!editor || !!transition} onPress={() => { setSearchInput(''); setSearch(''); setCategory(''); setStatus('Active'); setSort('expiry'); setPage(1); }} />}
        </View>
        {moreFilters && <>
        <Choices label="Status filter" values={['Active', 'Consumed', 'Discarded', 'All'].map(value => ({ value, label: value }))} selected={status} disabled={!!editor || !!transition} onSelect={v => filter(setStatus, v)} />
        <Choices label="Sort" values={[{ value: 'expiry', label: 'Nearest date' }, { value: 'name', label: 'Name' }, { value: 'updated', label: 'Recently updated' }]} selected={sort} disabled={!!editor || !!transition} onSelect={v => filter(setSort, v)} />
        </>}
        {categories.isError && <Text style={styles.error}>Could not load categories: {categories.error.message}</Text>}
        {inventory.isError && <Text accessibilityRole="alert" style={styles.error}>{inventory.error.message}{inventory.data ? ' Showing previously loaded items.' : ''}</Text>}
        {inventory.data && <Text style={styles.body}>{inventory.data.total} {inventory.data.total === 1 ? 'product' : 'products'} · {status === 'All' ? 'All statuses' : status} · {sort === 'expiry' ? 'Nearest date first' : sort === 'name' ? 'Sorted by name' : 'Recently updated'}. Refresh to see household changes.</Text>}
        {!!message && <Text accessibilityLiveRegion="polite" style={styles.body}>{message}</Text>}
      </View>
      {(editor === 'new' || (editingId && !inventory.data?.items.some(item => item.id === editingId))) && editorForm}
      {inventory.isPending && <ActivityIndicator accessibilityLabel="Loading inventory" />}
      {!inventory.isPending && !inventory.isError && inventory.data?.items.length === 0 && <View style={styles.card}><Text style={styles.heading}>{inventory.data.total === 0 ? 'No matching products yet' : 'No products on this page'}</Text><Text style={styles.body}>Add your first product or change the filters to view household inventory and history.</Text></View>}
      <View style={ui.grid}>{inventory.data?.items.map(item => editingId === item.id ? <View key={item.id} style={{ width: '100%' }}>{editorForm}</View> : <View key={item.id} style={[styles.card, ui.product, { width: width >= 1000 ? '48.5%' : '100%' }]}>
        <View style={ui.toolbar}><View style={{ flex: 1, gap: 4 }}><Text accessibilityRole="header" style={styles.heading}>{item.name}</Text><Text style={styles.body}>{categories.data?.find(c => c.id === item.categoryId)?.name ?? 'Category'} · {item.storageLocation}</Text></View><Text style={ui.quantity}>{item.quantity} {item.unit}</Text></View>
        <View style={ui.dateRow}><Text style={[ui.badge, item.status === 'Active' && item.expiryStatus === 'Expired' ? ui.expired : item.status === 'Active' && item.expiryStatus === 'ExpiringSoon' ? ui.soon : null]}>{expiryLabel(item)}</Text>{item.expiryDate && <Text style={ui.dateText}>{item.expiryType === 'Estimated' ? 'Estimated' : 'Printed'} · {item.expiryDate}</Text>}</View>
        {item.status === 'Active' && <Pressable accessibilityRole="button" accessibilityLabel={`Options for ${item.name}`} accessibilityState={{ expanded: openItemId === item.id }} style={ui.options} onPress={() => setOpenItemId(openItemId === item.id ? null : item.id)}><Text style={ui.optionsText}>{openItemId === item.id ? 'Hide options' : 'Options'}</Text></Pressable>}
        {openItemId === item.id && <View style={ui.details}>
          {item.expiryType === 'Estimated' && <Text style={styles.body}>Estimated dates are editable guides, not verified safety deadlines.</Text>}
          {item.purchaseDate && <Text style={styles.body}>Purchased: {item.purchaseDate}</Text>}
          {item.notes && <Text style={styles.body}>{item.notes}</Text>}
          {item.status === 'Active' && <>
          <Action variant="secondary" title="Edit product" label={`Edit ${item.name}`} disabled={!!editor || !!transition} onPress={() => { setEditor(item); setMessage(''); }} />
          {transition?.item.id === item.id ? <>
            <Text style={styles.body}>Mark {item.name} as {transition.action === 'consume' ? 'consumed' : 'discarded'}? It will move to history and future item reminders will stop.</Text>
            {lifecycle.isError && <Text accessibilityRole="alert" style={styles.error}>{lifecycle.error.message}</Text>}
            {conflict && <Action title="Reload inventory and review" disabled={inventory.isFetching} onPress={async () => { const result = await inventory.refetch(); if (result.isSuccess) { setTransition(null); lifecycle.reset(); setMessage('Latest inventory loaded. Review the item before changing it.'); } }} />}
            <Action title={lifecycle.isPending ? 'Saving…' : 'Confirm move to history'} disabled={lifecycle.isPending || conflict} onPress={() => lifecycle.mutate()} />
            <Action variant="secondary" title="Keep active" disabled={lifecycle.isPending} onPress={() => { setTransition(null); lifecycle.reset(); }} />
          </> : <View style={ui.toolbar}>
            <View style={{ flex: 1 }}><Action variant="secondary" title="Consumed" label={`Mark ${item.name} consumed`} disabled={!!editor || !!transition} onPress={() => { lifecycle.reset(); setTransition({ item, action: 'consume' }); }} /></View>
            <View style={{ flex: 1 }}><Action variant="danger" title="Discarded" label={`Mark ${item.name} discarded`} disabled={!!editor || !!transition} onPress={() => { lifecycle.reset(); setTransition({ item, action: 'discard' }); }} /></View>
          </View>}
        </>}
        </View>}
      </View>)}</View>
      {inventory.data && inventory.data.total > inventory.data.pageSize && <View style={ui.toolbar}>
        <Text style={styles.body}>Page {page} of {Math.ceil(inventory.data.total / inventory.data.pageSize)}</Text>
        <Action variant="secondary" title="Previous page" disabled={page <= 1 || inventory.isFetching || !!editor || !!transition} onPress={() => setPage(p => p - 1)} />
        <Action variant="secondary" title="Next page" disabled={page * inventory.data.pageSize >= inventory.data.total || inventory.isFetching || !!editor || !!transition} onPress={() => setPage(p => p + 1)} />
      </View>}
    </>}
  </FoundationScreen>;
}

const ui = StyleSheet.create({
  toolbar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12 },
  searchRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-end' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start' },
  quantity: { color: '#52665a', backgroundColor: '#f0f5f1', padding: 10, borderRadius: 10, fontWeight: '600', fontSize: 15 },
  badge: { alignSelf: 'flex-start', color: '#22634b', backgroundColor: '#edf5ef', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, fontSize: 14, fontWeight: '600' },
  expired: { color: '#9c2727', backgroundColor: '#fff0ed' },
  soon: { color: '#85520c', backgroundColor: '#fff4dc' },
  product: { gap: 12 },
  dateRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  dateText: { color: '#52665a', fontSize: 14 },
  options: { minHeight: 44, alignSelf: 'flex-start', justifyContent: 'center' },
  optionsText: { color: '#22634b', fontSize: 15, fontWeight: '600' },
  details: { gap: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#e0e8e2' },
});
