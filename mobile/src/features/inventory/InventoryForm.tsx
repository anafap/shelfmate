import { PageHeader, pageUi } from '@/components/PageHeader';
import { controlUi } from '@/theme/controlStyles';
import { colors } from '@/theme/tokens';
import { useMutation } from '@tanstack/react-query';
import { useContext, useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { DateField } from '@/components/DateField';
import { Action, Field, styles } from '@/features/auth/AccountScreen';
import { api, ApiError } from '@/lib/session';
import { Category, InventoryItem, expiryLabel, formatProductDate, expiryTone, inventoryPath } from './types';

export function Choices({ label, values, selected, onSelect, disabled }: {
  label: string; values: { value: string; label: string }[]; selected: string; onSelect: (value: string) => void; disabled?: boolean;
}) {
  return <View style={{ gap: 8 }}><Text style={styles.body}>{label}</Text><ScrollView horizontal={Platform.OS !== 'web'} showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 8, flexWrap: Platform.OS === 'web' ? 'wrap' : 'nowrap' }}>
    {values.map(v => <Pressable key={v.value} accessibilityRole="button" accessibilityLabel={`${label}: ${v.label}`} accessibilityState={{ selected: selected === v.value, disabled }} disabled={disabled} onPress={() => onSelect(v.value)} style={{ minHeight: 48, justifyContent: 'center', padding: 12, borderRadius: 24, borderWidth: 1, borderColor: selected === v.value ? colors.green : '#dce6df', backgroundColor: selected === v.value ? colors.green : colors.surface }}><Text style={{ fontSize: 16, color: selected === v.value ? colors.surface : colors.green }}>{v.label}</Text></Pressable>)}
  </ScrollView></View>;
}

function FormSelect({ label, value, values, onSelect, disabled }: {
  label: string; value: string; values: { value: string; label: string }[]; onSelect: (value: string) => void; disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selectedLabel = values.find(option => option.value === value)?.label ?? 'Choose';
  return <View style={ui.selectField}>
    <Text style={ui.fieldLabel}>{label} *</Text>
    <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${selectedLabel}`} accessibilityState={{ expanded: open, disabled }} disabled={disabled} onPress={() => setOpen(current => !current)} style={ui.selectButton}>
      <Text style={ui.selectValue}>{selectedLabel}</Text>
      <SymbolView name={{ ios: 'chevron.down', android: 'arrow_drop_down', web: 'arrow_drop_down' }} tintColor={colors.muted} size={18} />
    </Pressable>
    {open && <View style={ui.selectOptions}>{values.map(option => <Pressable key={option.value} accessibilityRole="button" accessibilityLabel={`Choose ${option.label}`} accessibilityState={{ selected: option.value === value }} onPress={() => { onSelect(option.value); setOpen(false); }} style={[ui.selectOption, option.value === value && ui.selectOptionSelected]}><Text style={[ui.selectOptionText, option.value === value && ui.selectOptionTextSelected]}>{option.label}</Text></Pressable>)}</View>}
  </View>;
}

function EditorButton({ title, accessibilityLabel, onPress, disabled, variant = 'primary' }: {
  title: string; accessibilityLabel?: string; onPress: () => void; disabled?: boolean; variant?: 'primary' | 'secondary';
}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? title} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [ui.editorButton, variant === 'secondary' && ui.editorButtonSecondary, pressed && ui.editorButtonPressed, disabled && ui.editorButtonDisabled]}>
    <Text style={[ui.editorButtonText, variant === 'secondary' && ui.editorButtonTextSecondary]}>{title}</Text>
  </Pressable>;
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
export function InventoryForm({ item, categories, onSaved, onCancel, onReload, initial, submit, saveLabel, onNameChange, layout = 'card', onBusyChange }: {
  item: InventoryItem | null; categories: Category[]; onSaved: () => Promise<void>; onCancel: () => void; onReload: (item: InventoryItem) => void; initial?: { name: string; quantity?: number | null; unit?: string | null; categoryId?: string | null; notes?: string | null }; submit?: (body: unknown) => Promise<unknown>; saveLabel?: string; onNameChange?: (name: string) => void; layout?: 'card' | 'editor'; onBusyChange?: (busy: boolean) => void;
}) {
  const [name, setName] = useState(item?.name ?? initial?.name ?? ''); const [quantity, setQuantity] = useState(String(item?.quantity ?? initial?.quantity ?? 1));
  const [categoryId, setCategory] = useState(item?.categoryId ?? initial?.categoryId ?? categories.find(c => c.key === 'other')?.id ?? categories[0]?.id ?? '');
  const [categoryOpen, setCategoryOpen] = useState(false);
  const insets = useContext(SafeAreaInsetsContext);
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
  useEffect(() => { onBusyChange?.(busy); }, [busy, onBusyChange]);
  const conflict = !!item && save.error instanceof ApiError && save.error.status === 409;
  const selectedCategory = categories.find(c => c.id === categoryId)?.name ?? 'Choose category';
  const nameField = <Field label="Product name" value={name} onChangeText={value => { setName(value); onNameChange?.(value); }} maxLength={120} editable={!busy} style={styles.input} />;
  const quantityField = <Field label="Quantity" value={quantity} onChangeText={setQuantity} keyboardType="decimal-pad" maxLength={14} editable={!busy} style={styles.input} />;
  const expiryFields = <>
    <DateField label="Expiry date (optional)" value={expiryDate} onChange={setExpiry} disabled={busy} />
    {!!expiryDate.trim() && <Choices label="Date type" values={['Printed', 'Estimated'].map(value => ({ value, label: value }))} selected={expiryType} onSelect={setType} disabled={busy} />}
    {expiryType === 'Estimated' && !!expiryDate.trim() && <Text style={styles.body}>An estimated date is an editable guide, not a verified safety deadline.</Text>}
  </>;
  const optionalFields = <>
    <DateField label="Purchase date (optional)" value={purchaseDate} onChange={setPurchase} disabled={busy} />
    {layout === 'card' && <Field label="Storage location" value={location} onChangeText={setLocation} maxLength={80} editable={!busy} />}
    <Field label="Notes (optional)" value={notes} onChangeText={setNotes} maxLength={2000} multiline editable={!busy} />
    <View style={ui.reminderRow}><View style={ui.reminderCopy}><Text style={ui.reminderTitle}>Allow item expiry reminders</Text><Text style={ui.reminderDescription}>Review this item as its entered date approaches.</Text></View><Switch accessibilityLabel="Allow item expiry reminders" disabled={busy} value={reminderEnabled} onValueChange={setReminder} /></View>
    {layout === 'card' && <Text style={styles.body}>Reminder preferences and in-app reviews are available in Alerts. Push delivery depends on device permissions and setup.</Text>}
  </>;
  const errorFields = <>
    {save.isError && <Text accessibilityRole="alert" style={styles.error}>{save.error.message}</Text>}
    {conflict && item && <>
      <Text style={styles.body}>Your draft has not been saved. Reloading replaces it with the latest household record so you can review it.</Text>
      {layout === 'editor' ? <EditorButton title="Reload latest details" variant="secondary" disabled={busy} onPress={() => reload.mutate()} /> : <Action title="Reload latest details (replaces draft)" disabled={busy} onPress={() => reload.mutate()} />}
    </>}
    {reload.isError && <Text accessibilityRole="alert" style={styles.error}>{reload.error.message}</Text>}
  </>;
  if (layout === 'editor') return <KeyboardAvoidingView style={ui.editorRoot} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <View style={ui.editorScreen}>
      <PageHeader title={item ? 'Edit Product' : 'Add to Inventory'} onBack={busy ? undefined : onCancel} backLabel="Back to Inventory" />
      <ScrollView style={ui.editorScroll} contentContainerStyle={ui.editorContent} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
      {!!item && <View style={[ui.summary, ui[`summary_${expiryTone(item)}`]]}>
        <View style={ui.summaryIcon}><SymbolView name={{ ios: 'shippingbox.fill', android: 'inventory_2', web: 'inventory_2' }} tintColor={colors.green} size={25} /></View>
        <View style={ui.summaryCopy}>
          <Text style={ui.summaryName}>{item.name}</Text>
          <Text style={ui.summaryMeta}>{selectedCategory} · {location || 'Location not set'}</Text>
          <View style={ui.summaryExpiryRow}><Text style={[ui.summaryBadge, ui[`summaryBadge_${expiryTone(item)}`]]}>{expiryLabel(item)}</Text>{item.expiryDate && <Text style={ui.summaryDate}>{item.expiryType} · {formatProductDate(item.expiryDate)}</Text>}</View>
        </View>
      </View>}
      <View style={ui.editorFields}>
        {nameField}
        <View style={ui.fieldRow}>
          <View style={ui.fieldColumn}>{quantityField}</View>
          <View style={ui.fieldColumn}><FormSelect label="Unit" value={unit} values={['piece', 'g', 'kg', 'ml', 'l', 'pack', 'bottle', 'box'].map(value => ({ value, label: value }))} disabled={busy} onSelect={setUnit} /></View>
        </View>
        <View style={ui.fieldRow}>
          <View style={ui.fieldColumn}><FormSelect label="Category" value={categoryId} values={categories.map(category => ({ value: category.id, label: category.name }))} disabled={busy} onSelect={setCategory} /></View>
          <View style={ui.fieldColumn}><Field label="Storage location" value={location} onChangeText={setLocation} maxLength={80} editable={!busy} style={styles.input} /></View>
        </View>
        {expiryFields}
        {!item && <Action variant="secondary" title={details ? 'Hide optional details' : 'More details'} disabled={busy} onPress={() => setDetails(!details)} />}
        {(item || details) && optionalFields}
        {errorFields}
      </View>
      </ScrollView>
      <View style={[ui.editorFooter, { paddingBottom: Math.max(insets?.bottom ?? 0, 12) }]}>
        <View style={ui.footerButtons}>
          <EditorButton title="Cancel" variant="secondary" disabled={busy} onPress={onCancel} />
          <EditorButton title={busy ? 'Saving…' : saveLabel ?? (item ? 'Save Changes' : 'Save product')} accessibilityLabel={saveLabel ?? (item ? 'Save Changes' : 'Save product')} disabled={busy || conflict} onPress={() => save.mutate()} />
        </View>
      </View>
    </View>
  </KeyboardAvoidingView>;
  return <View style={ui.editorFields}>
    <Field label="Product name" value={name} onChangeText={value => { setName(value); onNameChange?.(value); }} maxLength={120} editable={!busy} />
    <Field label="Quantity" value={quantity} onChangeText={setQuantity} keyboardType="decimal-pad" maxLength={14} editable={!busy} />
    <View style={{ gap: 8 }}>
      <Text style={styles.body}>Category</Text>
      <Action variant="secondary" title={`${selectedCategory}${!item && categoryId === categories.find(c => c.key === 'other')?.id ? ' (default)' : ''} · Change`} label={`Category: ${selectedCategory}`} disabled={busy} onPress={() => setCategoryOpen(!categoryOpen)} />
      {categoryOpen && <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {[...categories].sort((a, b) => Number(b.key === 'other') - Number(a.key === 'other')).map(c => <Pressable key={c.id} accessibilityRole="button" accessibilityLabel={`Choose ${c.name}`} accessibilityState={{ selected: categoryId === c.id, disabled: busy }} disabled={busy} onPress={() => { setCategory(c.id); setCategoryOpen(false); }} style={{ minHeight: 48, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: categoryId === c.id ? colors.green : '#dce6df', backgroundColor: categoryId === c.id ? colors.green : colors.surface, justifyContent: 'center' }}><Text style={{ color: categoryId === c.id ? colors.surface : colors.green, fontSize: 15 }}>{c.name}</Text></Pressable>)}
      </View>}
    </View>
    {expiryFields}
    <Action variant="secondary" title={details ? 'Hide optional details' : 'Unit & more details'} disabled={busy} onPress={() => setDetails(!details)} />
    {details && <>
      <Choices label="Unit" values={['piece', 'g', 'kg', 'ml', 'l', 'pack', 'bottle', 'box'].map(value => ({ value, label: value }))} selected={unit} onSelect={setUnit} disabled={busy} />
      {optionalFields}
    </>}
    {errorFields}
    <Action title={busy ? 'Please wait…' : saveLabel ?? (item ? 'Save changes' : 'Save product')} disabled={busy || conflict} onPress={() => save.mutate()} />
    <Action variant="secondary" title="Cancel" disabled={busy} onPress={onCancel} />
  </View>;
}

const ui = StyleSheet.create({
  editorRoot: { flex: 1, backgroundColor: colors.background }, editorScreen: { flex: 1, width: '100%', maxWidth: 560, alignSelf: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 6 },
  summary: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }, summary_red: { borderColor: '#f0d7d4', backgroundColor: '#fff7f5' }, summary_orange: { borderColor: '#f1ddca', backgroundColor: '#fff9f3' }, summary_amber: { borderColor: '#efe2c8', backgroundColor: '#fffbf2' }, summary_green: { borderColor: '#dce9df', backgroundColor: '#fbfdfb' }, summary_neutral: { borderColor: colors.border, backgroundColor: colors.surface },
  summaryIcon: { width: 52, height: 52, flexShrink: 0, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: '#eaf6ed' }, summaryCopy: { flex: 1, minWidth: 0, gap: 4 }, summaryName: { color: colors.ink, fontSize: 18, fontWeight: '800' }, summaryMeta: { color: colors.muted, fontSize: 14 }, summaryExpiryRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }, summaryBadge: { overflow: 'hidden', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 14, color: colors.muted, backgroundColor: '#eff3f2', fontSize: 12, fontWeight: '700' }, summaryBadge_red: { color: colors.danger, backgroundColor: '#ffe9e7' }, summaryBadge_orange: { color: '#a94d00', backgroundColor: '#fff0e3' }, summaryBadge_amber: { color: '#85520c', backgroundColor: '#fff4dc' }, summaryBadge_green: { color: colors.green, backgroundColor: '#edf7ef' }, summaryBadge_neutral: { color: colors.muted, backgroundColor: '#eff3f2' }, summaryDate: { color: colors.muted, fontSize: 12 },
  editorScroll: { flex: 1 }, editorContent: { gap: 12, paddingBottom: 12 }, editorFields: { ...pageUi.panel }, fieldRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: 12 }, fieldColumn: { flex: 1, minWidth: 130 }, fieldLabel: controlUi.label, selectField: { gap: 6 }, selectButton: { ...controlUi.frame, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }, selectValue: { ...controlUi.value, flex: 1 }, selectOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 }, selectOption: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 10, borderRadius: 10, borderWidth: 1, borderColor: '#dce6df', backgroundColor: colors.surface }, selectOptionSelected: { borderColor: colors.green, backgroundColor: '#eaf6ed' }, selectOptionText: { color: colors.muted, fontSize: 13 }, selectOptionTextSelected: { color: colors.green, fontWeight: '700' },
  reminderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingTop: 4 }, reminderCopy: { flex: 1, gap: 3 }, reminderTitle: { color: colors.text, fontSize: 14, fontWeight: '700' }, reminderDescription: { color: colors.muted, fontSize: 12, lineHeight: 17 },
  editorFooter: { paddingTop: 10, paddingHorizontal: 4, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.background }, footerButtons: { flexDirection: 'row', gap: 10 }, editorButton: { ...styles.button, flex: 1, alignSelf: 'stretch' }, editorButtonSecondary: styles.secondaryButton, editorButtonPressed: { opacity: 0.82 }, editorButtonDisabled: { opacity: 0.5 }, editorButtonText: styles.buttonText, editorButtonTextSecondary: styles.secondaryText,
});
