import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
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
  }});
  function filter(setter: (v: string) => void, value: string) { setter(value); setPage(1); }
  const conflict = lifecycle.error instanceof ApiError && lifecycle.error.status === 409;
  const editingId = editor && editor !== 'new' ? editor.id : null;
  const editorForm = editor && categories.data ? <InventoryForm key={editor === 'new' ? 'new' : editor.version} item={editor === 'new' ? null : editor} categories={categories.data} onCancel={() => setEditor(null)} onReload={latest => { setEditor(latest.status === 'Active' ? latest : null); setMessage('Latest details loaded. Review before making changes.'); client.invalidateQueries({ queryKey: ['inventory', household.data?.id] }); }} onSaved={async () => { setEditor(null); setMessage('Product saved.'); setPage(1); await client.invalidateQueries({ queryKey: ['inventory', household.data?.id] }); }} /> : null;
  return <FoundationScreen title="Inventory" description="What is at home, with the dates you entered. Refresh to see the latest household changes.">
    {household.isPending ? <ActivityIndicator accessibilityLabel="Loading household" /> : household.isError ? <View style={styles.card}><Text style={styles.error}>{household.error.message}</Text><Action title="Retry household" onPress={() => { household.refetch(); }} /></View> : !household.data ? <View style={styles.card}><Text style={styles.body}>Create or join a household before adding inventory.</Text><Link href="/" style={{ minHeight: 48, padding: 12, color: '#22634b', fontSize: 16 }}>Go to household setup</Link></View> : <>
      <View style={styles.card}>
        <Action title="Add product" disabled={!categories.data?.length || !!editor || !!transition} onPress={() => { setEditor('new'); setMessage(''); }} />
        <Field label="Search products" value={searchInput} onChangeText={setSearchInput} maxLength={120} editable={!editor && !transition} onSubmitEditing={() => filter(setSearch, searchInput.trim())} />
        <Action title="Search" disabled={!!editor || !!transition} onPress={() => filter(setSearch, searchInput.trim())} />
        <Choices label="Category filter" values={[{ value: '', label: 'All categories' }, ...(categories.data?.map(c => ({ value: c.id, label: c.name })) ?? [])]} selected={category} disabled={!!editor || !!transition} onSelect={v => filter(setCategory, v)} />
        <Choices label="Status filter" values={['Active', 'Consumed', 'Discarded', 'All'].map(value => ({ value, label: value }))} selected={status} disabled={!!editor || !!transition} onSelect={v => filter(setStatus, v)} />
        <Choices label="Sort" values={[{ value: 'expiry', label: 'Nearest date' }, { value: 'name', label: 'Name' }, { value: 'updated', label: 'Recently updated' }]} selected={sort} disabled={!!editor || !!transition} onSelect={v => filter(setSort, v)} />
        <Action title={inventory.isFetching ? 'Refreshing…' : 'Refresh inventory'} disabled={inventory.isFetching} onPress={() => { inventory.refetch(); categories.refetch(); }} />
        {categories.isError && <Text style={styles.error}>Could not load categories: {categories.error.message}</Text>}
        {inventory.isError && <Text accessibilityRole="alert" style={styles.error}>{inventory.error.message}{inventory.data ? ' Showing previously loaded items.' : ''}</Text>}
        {inventory.data && <Text style={styles.body}>{inventory.data.total} matching item(s) · page {page}. Date labels are calculated by your household calendar when loaded.</Text>}
        {!!message && <Text accessibilityLiveRegion="polite" style={styles.body}>{message}</Text>}
      </View>
      {(editor === 'new' || (editingId && !inventory.data?.items.some(item => item.id === editingId))) && editorForm}
      {inventory.isPending && <ActivityIndicator accessibilityLabel="Loading inventory" />}
      {!inventory.isPending && !inventory.isError && inventory.data?.items.length === 0 && <View style={styles.card}><Text style={styles.heading}>{inventory.data.total === 0 ? 'No matching products yet' : 'No products on this page'}</Text><Text style={styles.body}>Add your first product or change the filters to view household inventory and history.</Text></View>}
      {inventory.data?.items.map(item => editingId === item.id ? editorForm : <View key={item.id} style={styles.card}>
        <Text accessibilityRole="header" style={styles.heading}>{item.name}</Text>
        <Text style={styles.body}>{item.quantity} {item.unit} · {item.status}</Text>
        <Text style={styles.body}>{categories.data?.find(c => c.id === item.categoryId)?.name ?? 'Category'} · {item.storageLocation}</Text>
        <Text style={[styles.body, { fontWeight: '600', color: item.expiryStatus === 'Expired' ? '#9c2727' : '#193b2e' }]}>{expiryLabel(item)}</Text>
        {item.expiryDate && <Text style={styles.body}>{item.expiryType === 'Estimated' ? 'Estimated date' : 'Printed expiry date'}: {item.expiryDate}</Text>}
        {item.expiryType === 'Estimated' && <Text style={styles.body}>Estimated dates are editable guides, not verified safety deadlines.</Text>}
        {item.purchaseDate && <Text style={styles.body}>Purchased: {item.purchaseDate}</Text>}
        {item.notes && <Text style={styles.body}>{item.notes}</Text>}
        <Text style={styles.body}>Household date when loaded: {item.householdLocalDate}</Text>
        {item.status === 'Active' && <>
          <Action title={`Edit ${item.name}`} disabled={!!editor || !!transition} onPress={() => { setEditor(item); setMessage(''); }} />
          {transition?.item.id === item.id ? <>
            <Text style={styles.body}>Mark {item.name} as {transition.action === 'consume' ? 'consumed' : 'discarded'}? It will move to history and future item reminders will stop.</Text>
            {lifecycle.isError && <Text accessibilityRole="alert" style={styles.error}>{lifecycle.error.message}</Text>}
            {conflict && <Action title="Reload inventory and review" disabled={inventory.isFetching} onPress={async () => { const result = await inventory.refetch(); if (result.isSuccess) { setTransition(null); lifecycle.reset(); setMessage('Latest inventory loaded. Review the item before changing it.'); } }} />}
            <Action title={lifecycle.isPending ? 'Saving…' : 'Confirm move to history'} disabled={lifecycle.isPending || conflict} onPress={() => lifecycle.mutate()} />
            <Action title="Keep active" disabled={lifecycle.isPending} onPress={() => { setTransition(null); lifecycle.reset(); }} />
          </> : <>
            <Action title={`Mark ${item.name} consumed`} disabled={!!editor || !!transition} onPress={() => { lifecycle.reset(); setTransition({ item, action: 'consume' }); }} />
            <Action title={`Mark ${item.name} discarded`} disabled={!!editor || !!transition} onPress={() => { lifecycle.reset(); setTransition({ item, action: 'discard' }); }} />
          </>}
        </>}
      </View>)}
      {inventory.data && <View style={styles.card}>
        <Action title="Previous page" disabled={page <= 1 || inventory.isFetching || !!editor || !!transition} onPress={() => setPage(p => p - 1)} />
        <Action title="Next page" disabled={page * inventory.data.pageSize >= inventory.data.total || inventory.isFetching || !!editor || !!transition} onPress={() => setPage(p => p + 1)} />
      </View>}
    </>}
  </FoundationScreen>;
}
