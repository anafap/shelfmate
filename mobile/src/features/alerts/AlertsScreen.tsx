import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ActivityIndicator, Platform, Switch, Text, View } from 'react-native';
import { FoundationScreen } from '@/components/FoundationScreen';
import { Action, Field, styles } from '@/features/auth/AccountScreen';
import { HouseholdScreen, useHousehold } from '@/features/auth/HouseholdScreen';
import { Category, InventoryItem, expiryLabel } from '@/features/inventory/types';
import { api } from '@/lib/session';
import { registerPushDevice } from '@/lib/push';

export type Preferences = { pushEnabled: boolean; inAppEnabled: boolean; dayOffsets: number[]; mutedCategoryIds: string[]; localDeliveryTime: string };
export default function AlertsScreen() {
  const household = useHousehold(); const client = useQueryClient();
  const [editing, setEditing] = useState(false); const [pushEnabled, setPush] = useState(false); const [inAppEnabled, setInApp] = useState(true);
  const [offsets, setOffsets] = useState('7,3,1,0'); const [muted, setMuted] = useState<string[]>([]); const [time, setTime] = useState('09:00'); const [notice, setNotice] = useState('');
  const preferences = useQuery({ queryKey: ['preferences', household.data?.id], queryFn: () => api<Preferences>('/me/notification-preferences'), enabled: !!household.data, retry: false });
  const alerts = useQuery({ queryKey: ['alerts', household.data?.id], queryFn: () => api<InventoryItem[]>('/households/current/alerts'), enabled: !!household.data, retry: false });
  const categories = useQuery({ queryKey: ['categories', household.data?.id], queryFn: () => api<Category[]>('/households/current/categories'), enabled: !!household.data, retry: false });
  function edit() {
    const p = preferences.data; if (!p) return;
    setPush(p.pushEnabled); setInApp(p.inAppEnabled); setOffsets(p.dayOffsets.join(',')); setMuted(p.mutedCategoryIds); setTime(p.localDeliveryTime); setEditing(true); setNotice('');
  }
  const save = useMutation({ mutationFn: async () => {
    const days = offsets.trim() ? offsets.split(',').map(x => Number(x.trim())) : [];
    if (offsets.trim() && (!/^[0-9]+(\s*,\s*[0-9]+)*$/.test(offsets.trim()) || days.some(x => !Number.isInteger(x) || x < 0 || x > 365) || new Set(days).size !== days.length)) throw new Error('Enter distinct day offsets from 0 to 365, separated by commas.');
    let push = pushEnabled;
    if (push && Platform.OS !== 'web') {
      push = await registerPushDevice();
      if (!push) setNotice('Push permission was denied. In-app reminders remain available.');
    }
    const result = await api<Preferences>('/me/notification-preferences', { pushEnabled: push, inAppEnabled, dayOffsets: days, mutedCategoryIds: muted, localDeliveryTime: time }, 'PUT');
    setPush(result.pushEnabled); setEditing(false);
  }, onSuccess: async () => { await Promise.all(['preferences', 'alerts', 'inventory', 'dashboard'].map(key => client.invalidateQueries({ queryKey: [key, household.data?.id] }))); } });
  if (!household.isPending && !household.isError && !household.data) return <HouseholdScreen />;
  return <FoundationScreen title="Alerts" description="Review products approaching an entered or estimated date. In-app reminders work even when push is unavailable." compact>
    {household.isPending ? <ActivityIndicator /> : household.isError ? <><Text style={styles.error}>{household.error.message}</Text><Action title="Retry household" onPress={() => { household.refetch(); }} /></> : <>
      <View style={styles.card}>
        <Text style={styles.heading}>Reminder preferences</Text>
        {preferences.isPending && <ActivityIndicator accessibilityLabel="Loading reminder preferences" />}
        {preferences.isError && <><Text style={styles.error}>{preferences.error.message}</Text><Action title="Retry preferences" onPress={() => { preferences.refetch(); }} /></>}
        {preferences.data && !editing && <>
          <Text style={styles.body}>In-app: {preferences.data.inAppEnabled ? 'On' : 'Off'} · Push: {preferences.data.pushEnabled ? 'On' : 'Off'}</Text>
          <Text style={styles.body}>Days before date: {preferences.data.dayOffsets.length ? preferences.data.dayOffsets.join(', ') : 'None'} · Local delivery: {preferences.data.localDeliveryTime}</Text>
          <Action variant="secondary" title="Edit reminder preferences" onPress={edit} />
        </>}
        {editing && <>
          <Toggle label="In-app reminders" value={inAppEnabled} onChange={setInApp} disabled={save.isPending} />
          <Toggle label="Push reminders" value={pushEnabled} onChange={setPush} disabled={save.isPending} />
          <Field label="Days before date (comma-separated, 0 means today)" value={offsets} onChangeText={setOffsets} editable={!save.isPending} />
          <Field label="Local delivery time (HH:mm)" value={time} onChangeText={setTime} maxLength={5} editable={!save.isPending} />
          <Text style={styles.body}>Delivery uses your household time zone. Device/platform settings may delay or prevent push messages.</Text>
          <Text style={styles.heading}>Mute categories</Text>
          {categories.isError && <Text style={styles.error}>{categories.error.message}</Text>}
          {categories.data?.map(c => <Toggle key={c.id} label={`Mute ${c.name}`} value={muted.includes(c.id)} onChange={value => setMuted(list => value ? [...list, c.id] : list.filter(id => id !== c.id))} disabled={save.isPending} />)}
          {save.isError && <Text accessibilityRole="alert" style={styles.error}>{save.error.message}</Text>}
          <Action title={save.isPending ? 'Saving…' : 'Save reminder preferences'} disabled={save.isPending} onPress={() => save.mutate()} />
          <Action variant="secondary" title="Cancel preferences" disabled={save.isPending} onPress={() => { setEditing(false); save.reset(); }} />
        </>}
        {!!notice && <Text accessibilityLiveRegion="polite" style={styles.body}>{notice}</Text>}
      </View>
      <Action variant="secondary" title="Refresh alerts" disabled={alerts.isFetching} onPress={() => { alerts.refetch(); preferences.refetch(); }} />
      {alerts.isPending && <ActivityIndicator accessibilityLabel="Loading alerts" />}
      {alerts.isError && <Text accessibilityRole="alert" style={styles.error}>{alerts.error.message}{alerts.data ? ' Showing previously loaded reminders.' : ''}</Text>}
      {!alerts.isPending && !alerts.isError && alerts.data?.length === 0 && <View style={styles.card}><Text style={styles.heading}>{preferences.data?.inAppEnabled === false ? 'In-app reminders are off' : 'No items to review right now'}</Text><Text style={styles.body}>Only active items with dates and enabled reminders appear here. Your category and reminder-window preferences apply.</Text></View>}
      {alerts.data?.map(item => <View key={item.id} style={styles.card}>
        <Text accessibilityRole="header" style={styles.heading}>{item.name}</Text><Text style={styles.body}>{expiryLabel(item)}</Text>
        <Text style={styles.body}>{item.expiryType === 'Estimated' ? 'Estimated date' : 'Printed expiry date'}: {item.expiryDate} · {item.quantity} {item.unit}</Text>
        <Text style={styles.body}>{item.expiryType === 'Estimated' ? 'Estimated dates are guides, not verified safety deadlines. ' : ''}Review the product and its packaging instructions.</Text>
      </View>)}
    </>}
  </FoundationScreen>;
}
function Toggle({ label, value, onChange, disabled }: { label: string; value: boolean; onChange: (value: boolean) => void; disabled: boolean }) {
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, justifyContent: 'space-between', minHeight: 48 }}><Text style={[styles.body, { flex: 1 }]}>{label}</Text><Switch accessibilityLabel={label} value={value} onValueChange={onChange} disabled={disabled} /></View>;
}
