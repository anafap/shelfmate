import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { FoundationScreen } from '@/components/FoundationScreen';
import { Action, Field, styles } from '@/features/auth/AccountScreen';
import { HouseholdScreen, useHousehold } from '@/features/auth/HouseholdScreen';
import { Choices, InventoryForm } from '@/features/inventory/InventoryForm';
import { Category } from '@/features/inventory/types';
import { api } from '@/lib/session';

export type ShoppingItem = { id: string; householdId: string; name: string; quantity: number | null; unit: string | null; categoryId: string | null; notes: string | null; status: 'ToBuy' | 'Purchased'; version: string; purchasedByName: string | null; purchasedAt: string | null; linkedInventoryItemId: string | null };
const path = '/households/current/shopping-items';
export default function ShoppingScreen() {
  const household = useHousehold(); const client = useQueryClient();
  const [name, setName] = useState(''); const [editing, setEditing] = useState<ShoppingItem | null>(null);
  const [quantity, setQuantity] = useState('1'); const [unit, setUnit] = useState('piece'); const [notes, setNotes] = useState(''); const [category, setCategory] = useState('');
  const [removing, setRemoving] = useState<ShoppingItem | null>(null); const [transfer, setTransfer] = useState<ShoppingItem | null>(null); const [separate, setSeparate] = useState(false);
  const [openItemId, setOpenItemId] = useState<string | null>(null);
  const [showPurchased, setShowPurchased] = useState(false);
  const [message, setMessage] = useState('');
  const list = useQuery({ queryKey: ['shopping', household.data?.id], queryFn: () => api<ShoppingItem[]>(path), enabled: !!household.data, retry: false });
  const categories = useQuery({ queryKey: ['categories', household.data?.id], queryFn: () => api<Category[]>('/households/current/categories'), enabled: !!household.data, retry: false });
  async function refresh() { await Promise.all(['shopping', 'dashboard', 'inventory'].map(key => client.invalidateQueries({ queryKey: [key, household.data?.id] }))); }
  const action = useMutation({ mutationFn: (task: () => Promise<unknown>) => task(), onSuccess: refresh });
  const save = useMutation({ mutationFn: async () => {
    if (!name.trim()) throw new Error('Enter a shopping item name.');
    const qty = Number(quantity.replace(',', '.'));
    if (editing && (!Number.isFinite(qty) || qty <= 0)) throw new Error('Enter a positive quantity.');
    await api(editing ? `${path}/${editing.id}` : path, { name: name.trim(), ...(editing ? { quantity: qty, unit, notes: notes || null, categoryId: category || null, version: editing.version } : {}) }, editing ? 'PATCH' : 'POST');
    setName(''); setEditing(null);
  }, onSuccess: refresh });
  function edit(item: ShoppingItem) { setEditing(item); setName(item.name); setQuantity(String(item.quantity ?? 1)); setUnit(item.unit ?? 'piece'); setNotes(item.notes ?? ''); setCategory(item.categoryId ?? ''); save.reset(); }
  if (!household.isPending && !household.isError && !household.data) return <HouseholdScreen />;
  return <FoundationScreen title="Shopping" description="What does your household need next?" compact>
    {household.isPending ? <ActivityIndicator /> : household.isError ? <><Text style={styles.error}>{household.error.message}</Text><Action title="Retry household" onPress={() => { household.refetch(); }} /></> : <>
      {!transfer && <View style={styles.card}>
        <Field label={editing ? 'Edit shopping name' : 'Quick add shopping item'} value={name} onChangeText={setName} maxLength={120} editable={!save.isPending} />
        {editing && <>
          <Field label="Shopping quantity" value={quantity} onChangeText={setQuantity} keyboardType="decimal-pad" />
          <Choices label="Shopping unit" values={['piece', 'g', 'kg', 'ml', 'l', 'pack', 'bottle', 'box'].map(value => ({ value, label: value }))} selected={unit} onSelect={setUnit} />
          <Choices label="Shopping category" values={[{ value: '', label: 'Unspecified' }, ...(categories.data?.map(c => ({ value: c.id, label: c.name })) ?? [])]} selected={category} onSelect={setCategory} />
          <Field label="Shopping notes" value={notes} onChangeText={setNotes} maxLength={2000} multiline />
          <Action variant="secondary" title="Cancel edit" onPress={() => { setEditing(null); setName(''); save.reset(); }} />
          {save.isError && <Action variant="secondary" title="Reload shopping edit (replaces draft)" onPress={async () => { const latest = await list.refetch(); const item = latest.data?.find(x => x.id === editing.id); if (item) edit(item); }} />}
        </>}
        {save.isError && <Text accessibilityRole="alert" style={styles.error}>{save.error.message}</Text>}
        <Action title={editing ? 'Save shopping changes' : 'Add to shopping'} disabled={save.isPending} onPress={() => save.mutate()} />
      </View>}
      <View style={ui.listHeader}><Text style={styles.heading}>To buy</Text><Pressable accessibilityRole="button" accessibilityLabel="Refresh shopping" disabled={list.isFetching} onPress={() => { list.refetch(); categories.refetch(); }}><Text style={ui.textAction}>{list.isFetching ? 'Refreshing…' : 'Refresh'}</Text></Pressable></View>
      {list.isPending && <ActivityIndicator accessibilityLabel="Loading shopping" />}
      {list.isError && <Text accessibilityRole="alert" style={styles.error}>{list.error.message}{list.data ? ' Showing previously loaded items.' : ''}</Text>}
      {action.isError && <Text accessibilityRole="alert" style={styles.error}>{action.error.message}</Text>}
      {!!message && <Text accessibilityLiveRegion="polite" style={styles.body}>{message}</Text>}
      {!list.isPending && !list.isError && list.data?.length === 0 && <View style={styles.card}><Text style={styles.heading}>Nothing on your shopping list</Text><Text style={styles.body}>Quick add something you need at home.</Text></View>}
      {!!list.data?.length && list.data.every(item => item.status === 'Purchased') && <Text style={styles.body}>Nothing left to buy.</Text>}
      {transfer && categories.data && <View style={{ gap: 12 }}>
        <Text style={styles.heading}>Add {transfer.name} to inventory</Text>
        <Text style={styles.body}>Check the quantity and date. Review any matching product in Inventory before adding a separate one.</Text>
        <View style={styles.card}><Text style={styles.body}>I reviewed existing inventory and want a separate new product</Text><Switch accessibilityLabel="Confirm separate inventory item" value={separate} onValueChange={setSeparate} /></View>
        <InventoryForm key={transfer.version} item={null} initial={transfer} categories={categories.data} saveLabel="Transfer to inventory" onCancel={() => setTransfer(null)} onReload={() => {}} submit={body => api(`${path}/${transfer.id}/transfer-to-inventory`, { version: transfer.version, item: body, confirmSeparateItem: separate }, 'POST')} onSaved={async () => { setTransfer(null); setMessage('Purchase transferred to inventory.'); await refresh(); }} />
        <Action variant="secondary" title="Reload purchase (discards edits)" onPress={async () => { const result = await list.refetch(); const latest = result.data?.find(x => x.id === transfer.id); if (latest) { setTransfer(latest.linkedInventoryItemId ? null : latest); setSeparate(false); setMessage(latest.linkedInventoryItemId ? 'Transfer already completed.' : 'Purchase reloaded. Review before transferring.'); } }} />
      </View>}
      {list.data?.filter(item => item.status === 'ToBuy').map(item => renderItem(item))}
      {!!list.data?.some(item => item.status === 'Purchased') && <View style={ui.listHeader}><Text style={styles.heading}>Purchased · {list.data.filter(item => item.status === 'Purchased').length}</Text><Pressable accessibilityRole="button" accessibilityLabel={showPurchased ? 'Hide purchased items' : 'Show purchased items'} accessibilityState={{ expanded: showPurchased }} onPress={() => setShowPurchased(!showPurchased)}><Text style={ui.textAction}>{showPurchased ? 'Hide' : 'Show'}</Text></Pressable></View>}
      {showPurchased && list.data?.filter(item => item.status === 'Purchased').map(item => renderItem(item))}
    </>}
  </FoundationScreen>;

  function renderItem(item: ShoppingItem) { return <View key={item.id} style={ui.row}>
        <View style={ui.rowTop}>
          {!item.linkedInventoryItemId ? <Pressable accessibilityRole="checkbox" accessibilityLabel={item.status === 'Purchased' ? `Uncheck ${item.name}` : `Mark ${item.name} purchased`} accessibilityState={{ checked: item.status === 'Purchased', disabled: action.isPending || !!editing || !!transfer }} disabled={action.isPending || !!editing || !!transfer} style={ui.checkTarget} onPress={() => action.mutate(async () => { const result = await api<ShoppingItem>(`${path}/${item.id}/purchase`, { version: item.version, purchased: item.status !== 'Purchased', operationId: item.version }, 'POST'); if (result.status === 'Purchased') { setShowPurchased(true); setMessage(`Purchased ${item.name}. You can add it to inventory when ready.`); } })}>
            <View style={[ui.check, item.status === 'Purchased' && ui.checked]}><Text style={ui.checkMark}>{item.status === 'Purchased' ? '✓' : ''}</Text></View>
          </Pressable> : <View style={ui.checkTarget}><View style={[ui.check, ui.checked]}><Text style={ui.checkMark}>✓</Text></View></View>}
          <View style={ui.rowContent}><Text style={[ui.itemName, item.status === 'Purchased' && ui.purchasedName]}>{item.name}</Text><Text style={styles.body}>{item.quantity ? `${item.quantity} ${item.unit ?? 'piece'}` : item.status === 'Purchased' ? 'Purchased' : 'To buy'}</Text></View>
          <Pressable accessibilityRole="button" accessibilityLabel={`Options for ${item.name}`} accessibilityState={{ expanded: openItemId === item.id }} style={ui.options} onPress={() => setOpenItemId(openItemId === item.id ? null : item.id)}><Text style={ui.optionsText}>•••</Text></Pressable>
        </View>
        {item.purchasedAt && <Text style={ui.meta}>Purchased by {item.purchasedByName} · {new Date(item.purchasedAt).toLocaleString()}</Text>}
        {item.linkedInventoryItemId ? <Text style={ui.meta}>Added to inventory</Text> : item.status === 'Purchased' && <Action variant="secondary" title={`Transfer ${item.name} to inventory`} disabled={!categories.data || !!editing || !!transfer} onPress={() => { setSeparate(false); setTransfer(item); }} />}
        {openItemId === item.id && <View style={ui.details}>
          {item.notes && <Text style={styles.body}>{item.notes}</Text>}
          {!item.linkedInventoryItemId && <Action variant="secondary" title={`Edit shopping ${item.name}`} disabled={action.isPending || !!transfer} onPress={() => edit(item)} />}
          {removing?.id === item.id ? <><Text style={styles.body}>Remove this shopping item? Its transferred inventory record will be kept.</Text><Action variant="danger" title="Confirm shopping removal" disabled={action.isPending} onPress={() => action.mutate(async () => { await api(`${path}/${item.id}?version=${removing.version}`, undefined, 'DELETE'); setRemoving(null); setOpenItemId(null); })} /><Action variant="secondary" title="Keep shopping item" onPress={() => setRemoving(null)} /></> : <Action variant="danger" title={`Remove shopping ${item.name}`} disabled={!!editing || !!transfer || action.isPending} onPress={() => setRemoving(item)} />}
        </View>}
      </View>; }
}
const ui = StyleSheet.create({
  listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  textAction: { color: '#22634b', fontSize: 15, fontWeight: '600', padding: 12 },
  row: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#e0e8e2', padding: 16, gap: 12 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  checkTarget: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  check: { width: 26, height: 26, borderRadius: 8, borderWidth: 2, borderColor: '#22634b', alignItems: 'center', justifyContent: 'center' },
  checked: { backgroundColor: '#22634b' },
  checkMark: { color: '#fff', fontSize: 18, fontWeight: '700', lineHeight: 21 },
  rowContent: { flex: 1 },
  itemName: { fontSize: 18, fontWeight: '600', color: '#193b2e' },
  purchasedName: { color: '#596b62', textDecorationLine: 'line-through' },
  options: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  optionsText: { color: '#22634b', fontSize: 21, fontWeight: '700' },
  meta: { color: '#596b62', fontSize: 13, paddingLeft: 60 },
  details: { gap: 12, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#e0e8e2' },
});
