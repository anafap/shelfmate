import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ActivityIndicator, Switch, Text, View } from 'react-native';
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
  return <FoundationScreen title="Shopping" description="A shared checklist for your next grocery run. Buying and adding to inventory are separate steps.">
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
      <Action variant="secondary" title="Refresh shopping" disabled={list.isFetching} onPress={() => { list.refetch(); categories.refetch(); }} />
      {list.isPending && <ActivityIndicator accessibilityLabel="Loading shopping" />}
      {list.isError && <Text accessibilityRole="alert" style={styles.error}>{list.error.message}{list.data ? ' Showing previously loaded items.' : ''}</Text>}
      {action.isError && <Text accessibilityRole="alert" style={styles.error}>{action.error.message}</Text>}
      {!!message && <Text accessibilityLiveRegion="polite" style={styles.body}>{message}</Text>}
      {!list.isPending && !list.isError && list.data?.length === 0 && <View style={styles.card}><Text style={styles.heading}>Nothing on your shopping list</Text><Text style={styles.body}>Quick add something you need at home.</Text></View>}
      {transfer && categories.data && <View style={{ gap: 12 }}>
        <Text style={styles.heading}>Add {transfer.name} to inventory</Text>
        <Text style={styles.body}>Review quantity and date. If this product is already at home, review its Inventory record before adding a separate purchase.</Text>
        <View style={styles.card}><Text style={styles.body}>I reviewed existing inventory and want a separate new product</Text><Switch accessibilityLabel="Confirm separate inventory item" value={separate} onValueChange={setSeparate} /></View>
        <InventoryForm key={transfer.version} item={null} initial={transfer} categories={categories.data} saveLabel="Transfer to inventory" onCancel={() => setTransfer(null)} onReload={() => {}} submit={body => api(`${path}/${transfer.id}/transfer-to-inventory`, { version: transfer.version, item: body, confirmSeparateItem: separate }, 'POST')} onSaved={async () => { setTransfer(null); setMessage('Purchase transferred to inventory.'); await refresh(); }} />
        <Action variant="secondary" title="Reload purchase before transfer (replaces draft)" onPress={async () => { const result = await list.refetch(); const latest = result.data?.find(x => x.id === transfer.id); if (latest) { setTransfer(latest.linkedInventoryItemId ? null : latest); setSeparate(false); setMessage(latest.linkedInventoryItemId ? 'Transfer already completed.' : 'Purchase reloaded. Review before transferring.'); } }} />
      </View>}
      {list.data?.map(item => <View key={item.id} style={styles.card}>
        <Text accessibilityRole="header" style={styles.heading}>{item.name}</Text>
        <Text style={styles.body}>{item.status === 'Purchased' ? 'Purchased' : 'To buy'}{item.quantity ? ` · ${item.quantity} ${item.unit ?? 'piece'}` : ''}</Text>
        {item.notes && <Text style={styles.body}>{item.notes}</Text>}
        {item.purchasedAt && <Text style={styles.body}>Purchased by {item.purchasedByName} · {new Date(item.purchasedAt).toLocaleString()}</Text>}
        {item.linkedInventoryItemId ? <Text style={styles.body}>Transfer already completed. Review the product in Inventory.</Text> : <>
          <Action title={item.status === 'Purchased' ? `Uncheck ${item.name}` : `Mark ${item.name} purchased`} disabled={action.isPending || !!editing || !!transfer} onPress={() => action.mutate(async () => { const result = await api<ShoppingItem>(`${path}/${item.id}/purchase`, { version: item.version, purchased: item.status !== 'Purchased', operationId: item.version }, 'POST'); if (result.status === 'Purchased') setMessage(`Purchased ${item.name}. You can transfer it to inventory when ready.`); })} />
          <Action variant="secondary" title={`Edit shopping ${item.name}`} disabled={action.isPending || !!transfer} onPress={() => edit(item)} />
          {item.status === 'Purchased' && <Action title={`Transfer ${item.name} to inventory`} disabled={!categories.data || !!editing || !!transfer} onPress={() => { setSeparate(false); setTransfer(item); }} />}
        </>}
        {removing?.id === item.id ? <><Text style={styles.body}>Remove this shopping item? Its transferred inventory record will be kept.</Text><Action variant="danger" title="Confirm shopping removal" disabled={action.isPending} onPress={() => action.mutate(async () => { await api(`${path}/${item.id}?version=${removing.version}`, undefined, 'DELETE'); setRemoving(null); })} /><Action variant="secondary" title="Keep shopping item" onPress={() => setRemoving(null)} /></> : <Action variant="danger" title={`Remove shopping ${item.name}`} disabled={!!editing || !!transfer || action.isPending} onPress={() => setRemoving(item)} />}
      </View>)}
    </>}
  </FoundationScreen>;
}
