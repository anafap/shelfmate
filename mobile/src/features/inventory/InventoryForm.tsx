import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Platform, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { DateField } from '@/components/DateField';
import { Action, Field, styles } from '@/features/auth/AccountScreen';
import { api, ApiError } from '@/lib/session';
import { Category, InventoryItem, inventoryPath } from './types';

export function Choices({ label, values, selected, onSelect, disabled }: {
  label: string; values: { value: string; label: string }[]; selected: string; onSelect: (value: string) => void; disabled?: boolean;
}) {
  return <View style={{ gap: 8 }}><Text style={styles.body}>{label}</Text><ScrollView horizontal={Platform.OS !== 'web'} showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 8, flexWrap: Platform.OS === 'web' ? 'wrap' : 'nowrap' }}>
    {values.map(v => <Pressable key={v.value} accessibilityRole="button" accessibilityLabel={`${label}: ${v.label}`} accessibilityState={{ selected: selected === v.value, disabled }} disabled={disabled} onPress={() => onSelect(v.value)} style={{ minHeight: 48, justifyContent: 'center', padding: 12, borderRadius: 24, borderWidth: 1, borderColor: selected === v.value ? '#22634b' : '#dce6df', backgroundColor: selected === v.value ? '#22634b' : '#fff' }}><Text style={{ fontSize: 16, color: selected === v.value ? '#fff' : '#22634b' }}>{v.label}</Text></Pressable>)}
  </ScrollView></View>;
}
function dateValue(text: string, label: string): string | null {
  const value = text.trim();
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`${label} must use YYYY-MM-DD.`);
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (year < 1900 || year > 2100 || date.toISOString().slice(0, 10) !== value) throw new Error(`${label} must be a valid calendar date between 1900 and 2100.`);
  return value;
}
export function InventoryForm({ item, categories, onSaved, onCancel, onReload, initial, submit, saveLabel }: {
  item: InventoryItem | null; categories: Category[]; onSaved: () => Promise<void>; onCancel: () => void; onReload: (item: InventoryItem) => void; initial?: { name: string; quantity?: number | null; unit?: string | null; categoryId?: string | null; notes?: string | null }; submit?: (body: unknown) => Promise<unknown>; saveLabel?: string;
}) {
  const [name, setName] = useState(item?.name ?? initial?.name ?? ''); const [quantity, setQuantity] = useState(String(item?.quantity ?? initial?.quantity ?? 1));
  const [categoryId, setCategory] = useState(item?.categoryId ?? initial?.categoryId ?? categories.find(c => c.key === 'other')?.id ?? categories[0]?.id ?? '');
  const [unit, setUnit] = useState(item?.unit ?? initial?.unit ?? 'piece');
  const [expiryDate, setExpiry] = useState(item?.expiryDate ?? '');
  const [expiryType, setType] = useState(item?.expiryType === 'Estimated' ? 'Estimated' : 'Printed');
  const [purchaseDate, setPurchase] = useState(item?.purchaseDate ?? '');
  const [location, setLocation] = useState(item?.storageLocation ?? 'Home'); const [notes, setNotes] = useState(item?.notes ?? initial?.notes ?? '');
  const [reminderEnabled, setReminder] = useState(item?.reminderEnabled ?? true); const [details, setDetails] = useState(!!item);
  const save = useMutation({ mutationFn: async () => {
    if (!name.trim()) throw new Error('Enter a product name.');
    if (!/^(\d+([.,]\d{1,3})?|[.,]\d{1,3})$/.test(quantity.trim()) || Number(quantity.replace(',', '.')) <= 0) throw new Error('Enter a positive quantity with up to three decimal places.');
    const date = dateValue(expiryDate, 'Expiry date');
    const body = { name: name.trim(), quantity: Number(quantity.replace(',', '.')), categoryId, unit,
      expiryDate: date, expiryType: date ? expiryType : 'Unknown', purchaseDate: dateValue(purchaseDate, 'Purchase date'),
      storageLocation: location, notes: notes || null, reminderEnabled, ...(item ? { version: item.version } : {}) };
    if (submit) return submit(body);
    await api(item ? `${inventoryPath}/${item.id}` : inventoryPath, body, item ? 'PATCH' : 'POST');
  }, onSuccess: onSaved });
  const reload = useMutation({ mutationFn: () => api<InventoryItem>(`${inventoryPath}/${item!.id}`), onSuccess: onReload });
  const busy = save.isPending || reload.isPending;
  const conflict = !!item && save.error instanceof ApiError && save.error.status === 409;
  return <View style={styles.card}>
    <Text style={styles.heading}>{item ? `Edit ${item.name}` : 'Add a product'}</Text>
    <Field label="Product name" value={name} onChangeText={setName} maxLength={120} editable={!busy} />
    <Field label="Quantity" value={quantity} onChangeText={setQuantity} keyboardType="decimal-pad" maxLength={14} editable={!busy} />
    <Text style={styles.body}>Category: {categories.find(c => c.id === categoryId)?.name} · Unit: {unit}</Text>
    <DateField label="Expiry date (optional)" value={expiryDate} onChange={setExpiry} disabled={busy} />
    {!!expiryDate.trim() && <Choices label="Date type" values={['Printed', 'Estimated'].map(value => ({ value, label: value }))} selected={expiryType} onSelect={setType} disabled={busy} />}
    {expiryType === 'Estimated' && !!expiryDate.trim() && <Text style={styles.body}>An estimated date is an editable guide, not a verified safety deadline.</Text>}
    <Action variant="secondary" title={details ? 'Hide optional details' : 'Category, unit & more details'} disabled={busy} onPress={() => setDetails(!details)} />
    {details && <>
      <Choices label="Product category" values={categories.map(c => ({ value: c.id, label: c.name }))} selected={categoryId} onSelect={setCategory} disabled={busy} />
      <Choices label="Unit" values={['piece', 'g', 'kg', 'ml', 'l', 'pack', 'bottle', 'box'].map(value => ({ value, label: value }))} selected={unit} onSelect={setUnit} disabled={busy} />
      <DateField label="Purchase date (optional)" value={purchaseDate} onChange={setPurchase} disabled={busy} />
      <Field label="Storage location" value={location} onChangeText={setLocation} maxLength={80} editable={!busy} />
      <Field label="Notes (optional)" value={notes} onChangeText={setNotes} maxLength={2000} multiline editable={!busy} />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}><Text style={[styles.body, { flex: 1 }]}>Allow item expiry reminders</Text><Switch accessibilityLabel="Allow item expiry reminders" disabled={busy} value={reminderEnabled} onValueChange={setReminder} /></View>
      <Text style={styles.body}>Reminder preferences and in-app reviews are available in Alerts. Push delivery depends on device permissions and setup.</Text>
    </>}
    {save.isError && <Text accessibilityRole="alert" style={styles.error}>{save.error.message}</Text>}
    {conflict && item && <>
      <Text style={styles.body}>Your draft has not been saved. Reloading replaces it with the latest household record so you can review it.</Text>
      <Action title="Reload latest details (replaces draft)" disabled={busy} onPress={() => reload.mutate()} />
    </>}
    {reload.isError && <Text accessibilityRole="alert" style={styles.error}>{reload.error.message}</Text>}
    <Action title={busy ? 'Please wait…' : saveLabel ?? (item ? 'Save changes' : 'Save product')} disabled={busy || conflict} onPress={() => save.mutate()} />
    <Action variant="secondary" title="Cancel" disabled={busy} onPress={onCancel} />
  </View>;
}
