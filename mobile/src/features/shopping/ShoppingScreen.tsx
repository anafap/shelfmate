import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useContext, useEffect, useState } from 'react';
import { Link } from 'expo-router';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View, useWindowDimensions } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { FoundationScreen } from '@/components/FoundationScreen';
import { FAB_SCROLL_END_PADDING, FloatingActionButton } from '@/components/FloatingActionButton';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { Action, Field, styles } from '@/features/auth/AccountScreen';
import { HouseholdScreen, useHousehold } from '@/features/auth/HouseholdScreen';
import { Choices, InventoryForm } from '@/features/inventory/InventoryForm';
import { Category, InventoryItem, InventoryPage, inventoryPath } from '@/features/inventory/types';
import { api } from '@/lib/session';

export type ShoppingItem = { id: string; householdId: string; name: string; quantity: number | null; unit: string | null; categoryId: string | null; notes: string | null; status: 'ToBuy' | 'Purchased'; version: string; purchasedByName: string | null; purchasedAt: string | null; linkedInventoryItemId: string | null };
const path = '/households/current/shopping-items';
export default function ShoppingScreen() {
  const household = useHousehold(); const client = useQueryClient();
  const { width } = useWindowDimensions(); const insets = useContext(SafeAreaInsetsContext);
  const [adding, setAdding] = useState(false); const [expandedPurchaseId, setExpandedPurchaseId] = useState<string | null>(null);
  const [name, setName] = useState(''); const [editing, setEditing] = useState<ShoppingItem | null>(null);
  const [quantity, setQuantity] = useState('1'); const [unit, setUnit] = useState('piece'); const [notes, setNotes] = useState(''); const [category, setCategory] = useState('');
  const [transfer, setTransfer] = useState<ShoppingItem | null>(null); const [separate, setSeparate] = useState(false);
  const [transferName, setTransferName] = useState(''); const [detail, setDetail] = useState<ShoppingItem | null>(null);
  const [openItemId, setOpenItemId] = useState<string | null>(null); const [showPurchased, setShowPurchased] = useState(false); const [message, setMessage] = useState('');
  useEffect(() => { if (!message) return; const timer = setTimeout(() => setMessage(''), 4000); return () => clearTimeout(timer); }, [message]);
  const list = useQuery({ queryKey: ['shopping', household.data?.id], queryFn: () => api<ShoppingItem[]>(path), enabled: !!household.data, retry: false });
  const categories = useQuery({ queryKey: ['categories', household.data?.id], queryFn: () => api<Category[]>('/households/current/categories'), enabled: !!household.data, retry: false });
  const matches = useQuery({ queryKey: ['transferMatches', household.data?.id, transferName.trim().toLowerCase()], enabled: !!household.data && !!transfer && !!transferName.trim(), retry: false, queryFn: async () => {
    const found: InventoryItem[] = []; let page = 1; let total = 0;
    do { const result = await api<InventoryPage>(`${inventoryPath}?status=Active&search=${encodeURIComponent(transferName.trim())}&sort=name&page=${page}&pageSize=100`); found.push(...result.items.filter(item => item.name.trim().toLowerCase() === transferName.trim().toLowerCase())); total = result.total; page++; } while ((page - 1) * 100 < total);
    return found;
  } });
  async function refresh() { await Promise.all(['shopping', 'dashboard', 'inventory'].map(key => client.invalidateQueries({ queryKey: [key, household.data?.id] }))); }
  const action = useMutation({ mutationFn: (task: () => Promise<unknown>) => task(), onSuccess: refresh });
  const save = useMutation({ mutationFn: async () => {
    const trimmed = name.trim(); if (!trimmed) throw new Error('Enter a shopping item name.');
    const qty = Number(quantity.replace(',', '.')); if (!Number.isFinite(qty) || qty <= 0) throw new Error('Enter a positive quantity.');
    await api(editing ? `${path}/${editing.id}` : path, { name: trimmed, ...(editing ? { quantity: qty, unit, notes: notes.trim() || null, categoryId: category || null, version: editing.version } : {}) }, editing ? 'PATCH' : 'POST');
    setName(''); setEditing(null); setAdding(false); setMessage(editing ? 'Shopping item updated.' : `${trimmed} added to shopping.`);
  }, onSuccess: refresh });
  function edit(item: ShoppingItem) { setDetail(null); setEditing(item); setName(item.name); setQuantity(String(item.quantity ?? 1)); setUnit(item.unit ?? 'piece'); setNotes(item.notes ?? ''); setCategory(item.categoryId ?? ''); save.reset(); }
  function closeEdit() { if (save.isPending) return; setEditing(null); setAdding(false); setName(''); setQuantity('1'); setNotes(''); setCategory(''); save.reset(); }
  function remove(item: ShoppingItem) {
    Alert.alert('Remove from shopping history?', `“${item.name}” will be removed from this list. Any inventory item linked to it will stay in your inventory.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => action.mutate(async () => { await api(`${path}/${item.id}?version=${item.version}`, undefined, 'DELETE'); setDetail(null); setOpenItemId(null); setMessage(`${item.name} removed from shopping history.`); }) },
    ]);
  }
  if (!household.isPending && !household.isError && !household.data) return <HouseholdScreen />;
  return <View style={ui.screen}><FoundationScreen title="Shopping" description="" hideHeading fill testID="shopping-scroll" topPadding={8} bottomPadding={FAB_SCROLL_END_PADDING + (width >= 1000 ? insets?.bottom ?? 0 : 0)}>
    {household.isPending ? <ActivityIndicator /> : household.isError ? <><Text style={styles.error}>{household.error.message}</Text><Action title="Retry household" onPress={() => { household.refetch(); }} /></> : <>
      <Text accessibilityRole="header" style={ui.title}>Shopping</Text>
      {!!message && <Text accessibilityLiveRegion="polite" style={ui.feedback}>{message}</Text>}
      {list.isPending && <ActivityIndicator accessibilityLabel="Loading shopping" />}
      {list.isError && <View style={ui.errorCard}><Text accessibilityRole="alert" style={styles.error}>{list.error.message}{list.data ? ' Showing previously loaded items.' : ''}</Text><Action variant="secondary" title="Retry shopping list" disabled={list.isFetching} onPress={() => { list.refetch(); }} /></View>}
      {action.isError && <Text accessibilityRole="alert" style={styles.error}>{action.error.message}</Text>}
      {!list.isPending && !list.isError && list.data?.length === 0 && <View style={ui.empty}><Text style={ui.emptyTitle}>Your list is clear</Text><Text style={ui.emptyCopy}>Add the things your household needs for the next shop.</Text></View>}
      {!!list.data?.length && <>
        <Section title="To buy" count={list.data.filter(item => item.status === 'ToBuy').length} />
        {list.data.filter(item => item.status === 'ToBuy').length === 0 ? <Text style={ui.sectionHint}>Everything is checked off.</Text> : list.data.filter(item => item.status === 'ToBuy').map(item => renderItem(item))}
        {!!list.data.some(item => item.status === 'Purchased') && <>
          <Pressable accessibilityRole="button" accessibilityLabel={showPurchased ? 'Hide purchased items' : 'Show purchased items'} accessibilityState={{ expanded: showPurchased }} onPress={() => { setShowPurchased(!showPurchased); setExpandedPurchaseId(null); setOpenItemId(null); }} style={ui.purchasedHeader}>
            <View style={{ flex: 1 }}><Text style={ui.sectionTitle}>Purchased</Text><Text style={ui.sectionHint}>{list.data.filter(item => item.status === 'Purchased').length} {list.data.filter(item => item.status === 'Purchased').length === 1 ? 'item' : 'items'} · saved for your history</Text></View>
            <SymbolView name={{ ios: showPurchased ? 'chevron.up' : 'chevron.down', android: showPurchased ? 'expand_less' : 'expand_more', web: showPurchased ? 'expand_less' : 'expand_more' }} tintColor="#596b62" size={22} />
          </Pressable>
          {showPurchased && list.data.filter(item => item.status === 'Purchased').map(item => renderItem(item, expandedPurchaseId === item.id))}
        </>}
      </>}
      {transfer && categories.data && <View style={{ gap: 12 }}>
        <Text style={styles.heading}>Add {transfer.name} to inventory</Text><Text style={styles.body}>Review the product details. Expiry date and storage are optional.</Text>
        {matches.isPending && <ActivityIndicator accessibilityLabel="Checking inventory for matches" />}
        {matches.isError && <View style={styles.card}><Text accessibilityRole="alert" style={styles.error}>Could not check existing inventory: {matches.error.message}</Text><Action variant="secondary" title="Retry matching products" onPress={() => { matches.refetch(); }} /></View>}
        {!!matches.data?.length && <View style={styles.card}><Text style={styles.heading}>Already in inventory</Text>{matches.data.map(item => <View key={item.id} style={{ gap: 4 }}><Link href={{ pathname: '/inventory', params: { itemId: item.id } }} accessibilityRole="button" style={ui.matchLink}>{item.name} · {item.quantity} {item.unit}</Link><Text style={styles.body}>{item.storageLocation}{item.expiryDate ? ` · ${item.expiryType === 'Estimated' ? 'Estimated' : 'Printed'} ${item.expiryDate}` : ''}</Text></View>)}</View>}
        {!!matches.data?.length && <View style={styles.card}><Text style={styles.body}>I reviewed these products and want a separate new item</Text><Switch accessibilityLabel="Confirm separate inventory item" value={separate} onValueChange={setSeparate} /></View>}
        <InventoryForm key={transfer.version} item={null} initial={transfer} categories={categories.data} saveLabel="Transfer to inventory" onNameChange={value => { setTransferName(value); setSeparate(false); }} onCancel={() => setTransfer(null)} onReload={() => {}} submit={body => {
          if (!matches.isSuccess) throw new Error('Wait for the inventory check before transferring.'); if (matches.data.length && !separate) throw new Error('Review the matching product or confirm a separate item.');
          return api(`${path}/${transfer.id}/transfer-to-inventory`, { version: transfer.version, item: body, confirmSeparateItem: separate }, 'POST');
        }} onSaved={async () => { setTransfer(null); setMessage('Purchase transferred to inventory.'); await refresh(); }} />
        <Action variant="secondary" title="Cancel transfer" onPress={() => setTransfer(null)} />
      </View>}
      <Modal visible={!!detail && !editing} animationType="slide" transparent onRequestClose={() => setDetail(null)}>
        <View style={ui.modalBackdrop}><View style={ui.modalCard}>
          <View style={ui.modalHeading}><Text accessibilityRole="header" style={ui.modalTitle} numberOfLines={3}>{detail?.name}</Text><Pressable accessibilityRole="button" accessibilityLabel="Close item details" onPress={() => setDetail(null)} style={ui.close}><Text style={ui.closeText}>×</Text></Pressable></View>
          {detail && <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={ui.modalContent}>
            <View style={ui.stateLine}><View style={[ui.statusDot, detail.status === 'Purchased' && ui.statusDotPurchased]} /><Text style={ui.stateText}>{detail.status === 'Purchased' ? detail.linkedInventoryItemId ? 'Added to inventory' : 'Purchased' : 'On your shopping list'}</Text></View>
            {(detail.quantity || detail.unit) && <Info label="Quantity" value={`${detail.quantity ?? 1} ${detail.unit ?? 'piece'}`} />}
            {detail.purchasedAt && <Info label="Purchased by" value={detail.purchasedByName || 'Household member'} />}
            {detail.purchasedAt && <Info label="Purchase time" value={formatPurchaseDate(detail.purchasedAt)} />}
            {detail.linkedInventoryItemId && <Link href={{ pathname: '/inventory', params: { itemId: detail.linkedInventoryItemId } }} asChild><Pressable accessibilityRole="button" style={ui.inventoryLink}><Text style={ui.inventoryLinkText}>View in inventory</Text></Pressable></Link>}
            {detail.notes && <Info label="Note" value={detail.notes} />}
            <View style={ui.modalActions}>
              {!detail.linkedInventoryItemId && detail.status === 'Purchased' && <Action title="Add to inventory" disabled={!categories.data || !!transfer} onPress={() => { setTransferName(detail.name); setSeparate(false); setTransfer(detail); setDetail(null); }} />}
              {!detail.linkedInventoryItemId && <Action variant="secondary" title="Edit item" onPress={() => edit(detail)} />}
              <Action variant="secondary" title="More actions" onPress={() => { setOpenItemId(detail.id); setDetail(null); }} />
            </View>
          </ScrollView>}
        </View></View>
      </Modal>
      <Modal visible={adding || !!editing} animationType="slide" transparent onRequestClose={closeEdit}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={ui.modalBackdrop}><View style={[ui.modalCard, { paddingBottom: Math.max(insets?.bottom ?? 0, 20) }]}>
          <View style={ui.modalHeading}><Text accessibilityRole="header" style={ui.modalTitle}>{editing ? 'Edit shopping item' : 'Add Shopping Item'}</Text><Pressable accessibilityRole="button" accessibilityLabel={editing ? 'Close edit item' : 'Close add item'} disabled={save.isPending} onPress={closeEdit} style={ui.close}><Text style={ui.closeText}>×</Text></Pressable></View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={ui.modalContent}>
          <Field label="Item name" value={name} onChangeText={setName} maxLength={120} autoFocus editable={!save.isPending} returnKeyType="done" onSubmitEditing={() => { if (name.trim() && !save.isPending) save.mutate(); }} />
          {editing && <>
          <Field label="Quantity" value={quantity} onChangeText={setQuantity} keyboardType="decimal-pad" />
          <Choices label="Unit" values={['piece', 'g', 'kg', 'ml', 'l', 'pack', 'bottle', 'box'].map(value => ({ value, label: value }))} selected={unit} onSelect={setUnit} />
          <Choices label="Category" values={[{ value: '', label: 'Unspecified' }, ...(categories.data?.map(c => ({ value: c.id, label: c.name })) ?? [])]} selected={category} onSelect={setCategory} />
          <Field label="Notes" value={notes} onChangeText={setNotes} maxLength={2000} multiline />
          </>}
          {save.isError && <Text accessibilityRole="alert" style={styles.error}>{save.error.message}</Text>}
          <View style={ui.modalActions}><Action title={save.isPending ? 'Saving…' : editing ? 'Save changes' : 'Add to shopping'} disabled={save.isPending || !name.trim()} onPress={() => save.mutate()} /><Action variant="secondary" title="Cancel" disabled={save.isPending} onPress={closeEdit} /></View>
          </ScrollView>
        </View></KeyboardAvoidingView>
      </Modal>
    </>}
  </FoundationScreen>
    {!!household.data && !transfer && <FloatingActionButton label="Add shopping item" bottomInset={width >= 1000 ? insets?.bottom ?? 0 : 0} onPress={() => { closeEdit(); setOpenItemId(null); setAdding(true); }} testID="shopping-fab" />}
  </View>;

  function renderItem(item: ShoppingItem, purchasedExpanded = false) {
    const purchased = item.status === 'Purchased';
    return <View key={item.id} style={[ui.row, purchased && ui.purchasedRow]}>
      <Pressable accessibilityRole="checkbox" accessibilityLabel={purchased ? `Uncheck ${item.name}` : `Mark ${item.name} purchased`} accessibilityState={{ checked: purchased, disabled: action.isPending || !!editing || !!transfer || !!item.linkedInventoryItemId }} disabled={action.isPending || !!editing || !!transfer || !!item.linkedInventoryItemId} style={ui.checkTarget} onPress={() => action.mutate(async () => {
        const result = await api<ShoppingItem>(`${path}/${item.id}/purchase`, { version: item.version, purchased: !purchased, operationId: item.version }, 'POST');
        if (result.status === 'Purchased') { setShowPurchased(true); setMessage(`${item.name} marked purchased. Add it to inventory when you’re ready.`); } else setMessage(`${item.name} moved back to To buy.`);
      })}><View style={[ui.check, purchased && ui.checked]}>{purchased && <SymbolView name={{ ios: 'checkmark', android: 'check', web: 'check' }} tintColor="#fff" size={16} />}</View></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={purchased ? `${purchasedExpanded ? 'Hide' : 'Show'} ${item.name} purchase details` : `View ${item.name} details`} accessibilityState={purchased ? { expanded: purchasedExpanded } : undefined} onPress={() => { setOpenItemId(null); if (purchased) setExpandedPurchaseId(purchasedExpanded ? null : item.id); else setDetail(item); }} style={ui.itemContent}>
        <View style={ui.itemTitleRow}><Text numberOfLines={2} style={[ui.itemName, purchased && ui.purchasedName]}>{item.name}</Text>{purchased && <SymbolView name={{ ios: purchasedExpanded ? 'chevron.up' : 'chevron.down', android: purchasedExpanded ? 'expand_less' : 'expand_more', web: purchasedExpanded ? 'expand_less' : 'expand_more' }} tintColor="#596b62" size={16} />}</View>
        <Text numberOfLines={1} style={ui.itemMeta}>{purchased ? item.linkedInventoryItemId ? 'In Inventory' : 'Not in Inventory' : 'To buy'}{(item.quantity || item.unit) ? `  ·  ${item.quantity ?? 1} ${item.unit ?? 'piece'}` : ''}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={`Options for ${item.name}`} accessibilityState={{ expanded: openItemId === item.id }} style={ui.options} onPress={() => setOpenItemId(openItemId === item.id ? null : item.id)}><SymbolView name={{ ios: 'ellipsis', android: 'more_vert', web: 'more_vert' }} tintColor="#52665a" size={23} /></Pressable>
      {purchasedExpanded && <View style={ui.purchaseInfo}>
        <View style={ui.purchaseMeta}><Text style={ui.purchaseLabel}>Purchased by</Text><Text style={ui.purchaseValue} numberOfLines={2}>{item.purchasedByName || 'Household member'}</Text></View>
        <View style={ui.purchaseMeta}><Text style={ui.purchaseLabel}>When</Text><Text style={ui.purchaseValue} numberOfLines={2}>{item.purchasedAt ? formatPurchaseDate(item.purchasedAt) : 'Time unavailable'}</Text></View>
        {item.linkedInventoryItemId && <Link href={{ pathname: '/inventory', params: { itemId: item.linkedInventoryItemId } }} accessibilityRole="button" style={ui.matchLink}>View in inventory</Link>}
        {!item.linkedInventoryItemId && <Action variant="secondary" title="Add to inventory" disabled={!categories.data || !!transfer} onPress={() => { setTransferName(item.name); setSeparate(false); setTransfer(item); }} />}
      </View>}
      {openItemId === item.id && <View style={ui.actionMenu}>
        {!item.linkedInventoryItemId && <Pressable accessibilityRole="button" style={ui.menuAction} onPress={() => edit(item)}><Text style={ui.menuText}>Edit item</Text></Pressable>}
        {purchased && !item.linkedInventoryItemId && <Pressable accessibilityRole="button" style={ui.menuAction} onPress={() => { setTransferName(item.name); setSeparate(false); setTransfer(item); setOpenItemId(null); }}><Text style={ui.menuText}>Add to inventory</Text></Pressable>}
        <Pressable accessibilityRole="button" style={ui.menuAction} onPress={() => { setOpenItemId(null); remove(item); }}><Text style={ui.removeText}>Remove from shopping history</Text></Pressable>
      </View>}
    </View>;
  }
}
function Section({ title, count }: { title: string; count: number }) { return <View style={ui.sectionHeader}><Text accessibilityRole="header" style={ui.sectionTitle}>{title}</Text><Text style={ui.countPill}>{count}</Text></View>; }
function Info({ label, value }: { label: string; value: string }) { return <View style={ui.infoRow}><Text style={ui.infoLabel}>{label}</Text><Text selectable style={ui.infoValue}>{value}</Text></View>; }
function formatPurchaseDate(value: string) { const date = new Date(value); if (!Number.isFinite(date.getTime())) return 'Recently'; return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date); }

const ui = StyleSheet.create({
  screen: { flex: 1 }, title: { color: '#102d24', fontSize: 28, lineHeight: 34, fontWeight: '800', letterSpacing: -0.6, marginBottom: 2 },
  feedback: { color: '#22634b', fontSize: 13, lineHeight: 19, paddingHorizontal: 3 },
  errorCard: { padding: 16, gap: 8, borderRadius: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e0e8e2' },
  empty: { padding: 18, gap: 5, borderRadius: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e0e8e2' }, emptyTitle: { color: '#193b2e', fontSize: 17, fontWeight: '700' }, emptyCopy: { color: '#596b62', fontSize: 14, lineHeight: 20 },
  sectionHeader: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 5 }, sectionTitle: { color: '#193b2e', fontSize: 20, fontWeight: '700', letterSpacing: -0.3 }, countPill: { minWidth: 25, overflow: 'hidden', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 12, textAlign: 'center', color: '#22634b', backgroundColor: '#eaf3ed', fontSize: 13, fontWeight: '700' }, sectionHint: { marginTop: -5, color: '#596b62', fontSize: 13, lineHeight: 19 },
  purchasedHeader: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8, paddingHorizontal: 12, borderRadius: 14, backgroundColor: '#edf2ef' },
  row: { minHeight: 68, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, paddingVertical: 7, paddingHorizontal: 8, borderRadius: 15, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e0e8e2' }, purchasedRow: { backgroundColor: '#fdfefd' },
  checkTarget: { width: 48, height: 48, flexShrink: 0, alignItems: 'center', justifyContent: 'center' }, check: { width: 25, height: 25, borderRadius: 8, borderWidth: 2, borderColor: '#22634b', alignItems: 'center', justifyContent: 'center' }, checked: { backgroundColor: '#22634b' },
  itemContent: { flex: 1, minWidth: 80, minHeight: 48, justifyContent: 'center', gap: 2 }, itemTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 }, itemName: { flex: 1, color: '#193b2e', fontSize: 16, lineHeight: 21, fontWeight: '700' }, purchasedName: { color: '#52665a' }, itemMeta: { color: '#596b62', fontSize: 13, lineHeight: 18 },
  options: { width: 44, height: 48, flexShrink: 0, alignItems: 'center', justifyContent: 'center' }, actionMenu: { width: '100%', paddingLeft: 54, paddingTop: 5, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#e0e8e2' }, menuAction: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 }, menuText: { color: '#193b2e', fontSize: 15, fontWeight: '600' }, removeText: { color: '#9c2727', fontSize: 15, fontWeight: '600' },
  purchaseInfo: { width: '100%', flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 2, paddingTop: 9, paddingBottom: 4, paddingLeft: 56, paddingRight: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#e5ebe7' }, purchaseMeta: { flex: 1, minWidth: 90, gap: 2 }, purchaseLabel: { color: '#718078', fontSize: 11, fontWeight: '600' }, purchaseValue: { color: '#52665a', fontSize: 13, lineHeight: 18 },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(16,42,48,0.34)' }, modalCard: { maxHeight: '90%', gap: 14, padding: 20, paddingBottom: 28, borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: '#f9fbf9' }, modalContent: { gap: 14, paddingBottom: 12 }, modalHeading: { flexDirection: 'row', alignItems: 'center', gap: 12 }, modalTitle: { flex: 1, color: '#193b2e', fontSize: 23, lineHeight: 29, fontWeight: '700' }, close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: '#edf2ef' }, closeText: { color: '#193b2e', fontSize: 28, lineHeight: 30 }, stateLine: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, borderRadius: 12, backgroundColor: '#eaf3ed' }, statusDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#ad5c00' }, statusDotPurchased: { backgroundColor: '#22634b' }, stateText: { color: '#22634b', fontSize: 14, fontWeight: '700' }, infoRow: { gap: 3, paddingVertical: 4 }, infoLabel: { color: '#596b62', fontSize: 13, fontWeight: '600' }, infoValue: { color: '#193b2e', fontSize: 16, lineHeight: 22 }, inventoryLink: { minHeight: 44, justifyContent: 'center' }, inventoryLinkText: { color: '#22634b', fontSize: 15, fontWeight: '700', textDecorationLine: 'underline' }, modalActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingTop: 4 },
  matchLink: { minHeight: 44, paddingVertical: 10, color: '#22634b', fontSize: 16, fontWeight: '600', textDecorationLine: 'underline' },
});
