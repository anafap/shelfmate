import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { PageHeader, pageUi } from '@/components/PageHeader';
import { ActivityIndicator, Platform, Switch, Text, View } from 'react-native';
import { FoundationScreen } from '@/components/FoundationScreen';
import { TimeField } from '@/components/TimeField';
import { Action, Field, styles } from '@/features/auth/AccountScreen';
import { HouseholdScreen, useHousehold } from '@/features/auth/HouseholdScreen';
import { Category } from '@/features/inventory/types';
import { api } from '@/lib/session';
import { registerPushDevice } from '@/lib/push';

export type Preferences = { pushEnabled: boolean; inAppEnabled: boolean; dayOffsets: number[]; mutedCategoryIds: string[]; localDeliveryTime: string };
export default function ReminderPreferencesScreen() {
  const { from } = useLocalSearchParams<{ from?: string }>();
  const household = useHousehold(); const client = useQueryClient();
  const [editing, setEditing] = useState(false); const [pushEnabled, setPush] = useState(false); const [inAppEnabled, setInApp] = useState(true);
  const [offsets, setOffsets] = useState<number[]>([7, 3, 1, 0]); const [customDay, setCustomDay] = useState(''); const [customError, setCustomError] = useState('');
  const [muted, setMuted] = useState<string[]>([]); const [time, setTime] = useState('09:00'); const [notice, setNotice] = useState('');
  const [showMutedCategories, setShowMutedCategories] = useState(false);
  const preferences = useQuery({ queryKey: ['preferences', household.data?.id], queryFn: () => api<Preferences>('/me/notification-preferences'), enabled: !!household.data, retry: false });
  const categories = useQuery({ queryKey: ['categories', household.data?.id], queryFn: () => api<Category[]>('/households/current/categories'), enabled: !!household.data, retry: false });
  function edit() {
    const p = preferences.data; if (!p) return;
    setPush(p.pushEnabled); setInApp(p.inAppEnabled); setOffsets(p.dayOffsets); setCustomDay(''); setCustomError(''); setMuted(p.mutedCategoryIds); setTime(p.localDeliveryTime); setShowMutedCategories(false); setEditing(true); setNotice('');
  }
  const initialized = useRef(false);
  useEffect(() => {
    if (preferences.data && !initialized.current) { initialized.current = true; edit(); }
  });
  function goBack() { router.replace(from === 'settings' ? '/settings' : '/alerts'); }
  function toggleOffset(day: number, enabled: boolean) { setOffsets(current => enabled ? [...current, day].sort((a, b) => b - a) : current.filter(value => value !== day)); }
  function addCustomDay() {
    const day = Number(customDay.trim());
    if (!/^\d+$/.test(customDay.trim()) || day > 365) { setCustomError('Enter a whole number from 0 to 365.'); return; }
    if (offsets.includes(day)) { setCustomError('That day is already selected.'); return; }
    toggleOffset(day, true); setCustomDay(''); setCustomError('');
  }
  const save = useMutation({ mutationFn: async () => {
    const pending = customDay.trim(); const extraDay = Number(pending);
    if (pending && (!/^\d+$/.test(pending) || extraDay > 365 || offsets.includes(extraDay))) throw new Error('Choose a distinct whole-number reminder day from 0 to 365.');
    const days = pending ? [...offsets, extraDay].sort((a, b) => b - a) : offsets;
    let push = pushEnabled;
    if (push && Platform.OS !== 'web') {
      push = await registerPushDevice();
      if (!push) setNotice('Push permission was denied. In-app reminders remain available.');
    }
    const result = await api<Preferences>('/me/notification-preferences', { pushEnabled: push, inAppEnabled, dayOffsets: days, mutedCategoryIds: muted, localDeliveryTime: time }, 'PUT');
    setPush(result.pushEnabled); setEditing(false);
    if (push || !pushEnabled) setNotice('Reminder preferences saved.');
  }, onSuccess: async () => { await Promise.all(['preferences', 'alerts', 'inventory', 'dashboard'].map(key => client.invalidateQueries({ queryKey: [key, household.data?.id] }))); } });
  if (!household.isPending && !household.isError && !household.data) return <HouseholdScreen />;
  return <FoundationScreen title="Reminder preferences" description="" compact hideHeading fill topPadding={8}>
    <PageHeader title="Reminders" onBack={save.isPending ? undefined : goBack} backLabel="Back from reminder preferences" />
    {household.isPending ? <ActivityIndicator accessibilityLabel="Loading household" /> : household.isError ? <><Text style={styles.error}>{household.error.message}</Text><Action title="Retry household" onPress={() => { household.refetch(); }} /></> : <>
      <View style={pageUi.panel}>
        <Text accessibilityRole="header" style={pageUi.sectionTitle}>Delivery & schedule</Text>
        {preferences.isPending && <ActivityIndicator accessibilityLabel="Loading reminder preferences" />}
        {preferences.isError && <><Text style={styles.error}>{preferences.error.message}</Text><Action title="Retry preferences" onPress={() => { preferences.refetch(); }} /></>}
        {preferences.data && !editing && <>
          <Text style={styles.body}>In-app: {preferences.data.inAppEnabled ? 'On' : 'Off'} · Push: {preferences.data.pushEnabled ? 'On' : 'Off'}</Text>
          <Text style={styles.body}>Remind me: {preferences.data.dayOffsets.length ? preferences.data.dayOffsets.map(day => day === 0 ? 'on the date' : `${day} day${day === 1 ? '' : 's'} before`).join(', ') : 'No scheduled days'} · {preferences.data.localDeliveryTime}</Text>
          <Action variant="secondary" title="Edit reminder preferences" onPress={edit} />
        </>}
        {editing && <>
          <Toggle label="In-app reminders" value={inAppEnabled} onChange={setInApp} disabled={save.isPending} />
          <Toggle label="Push reminders" value={pushEnabled} onChange={setPush} disabled={save.isPending} />
          <Text accessibilityRole="header" style={pageUi.sectionTitle}>When to remind me</Text>
          {[7, 3, 1, 0].map(day => <Toggle key={day} label={day === 0 ? 'On the date' : `${day} day${day === 1 ? '' : 's'} before`} value={offsets.includes(day)} onChange={value => toggleOffset(day, value)} disabled={save.isPending} />)}
          {offsets.filter(day => ![7, 3, 1, 0].includes(day)).map(day => <Toggle key={day} label={`${day} days before`} value onChange={() => toggleOffset(day, false)} disabled={save.isPending} />)}
          <Field label="Add another day before (0–365)" value={customDay} onChangeText={value => { setCustomDay(value); setCustomError(''); }} keyboardType="number-pad" maxLength={3} editable={!save.isPending} />
          {!!customError && <Text accessibilityRole="alert" style={styles.error}>{customError}</Text>}
          <Action variant="secondary" title="Add reminder day" disabled={save.isPending || !customDay.trim()} onPress={addCustomDay} />
          <Text accessibilityRole="header" style={pageUi.sectionTitle}>Delivery time</Text>
          <TimeField label="Household reminder time" value={time} onChange={setTime} disabled={save.isPending} />
          <Text style={pageUi.body}>Time zone: {household.data?.timeZone}. Delivery uses your household time zone. Device/platform settings may delay or prevent push messages.</Text>
          <Text accessibilityRole="header" style={pageUi.sectionTitle}>Categories</Text>
          <Action variant="secondary" disabled={save.isPending} title={showMutedCategories ? 'Hide muted categories' : `Mute categories${muted.length ? ` · ${muted.length} selected` : ''}`} onPress={() => setShowMutedCategories(!showMutedCategories)} />
          {showMutedCategories && <>
            {categories.isPending && <ActivityIndicator accessibilityLabel="Loading categories" />}{categories.isError && <><Text style={styles.error}>{categories.error.message}</Text><Action variant="secondary" title="Retry categories" onPress={() => { categories.refetch(); }} /></>}
            {categories.data?.map(c => <Toggle key={c.id} label={`Mute ${c.name}`} value={muted.includes(c.id)} onChange={value => setMuted(list => value ? [...list, c.id] : list.filter(id => id !== c.id))} disabled={save.isPending} />)}
          </>}
          {save.isError && <Text accessibilityRole="alert" style={styles.error}>{save.error.message}</Text>}
          <Action title={save.isPending ? 'Saving…' : 'Save reminder preferences'} disabled={save.isPending} onPress={() => save.mutate()} />
          <Action variant="secondary" title="Cancel preferences" disabled={save.isPending} onPress={goBack} />
        </>}
        {!!notice && <Text accessibilityLiveRegion="polite" style={styles.body}>{notice}</Text>}
      </View>
    </>}
  </FoundationScreen>;
}
function Toggle({ label, value, onChange, disabled }: { label: string; value: boolean; onChange: (value: boolean) => void; disabled: boolean }) {
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, justifyContent: 'space-between', minHeight: 48 }}><Text style={[styles.body, { flex: 1 }]}>{label}</Text><Switch accessibilityLabel={label} value={value} onValueChange={onChange} disabled={disabled} /></View>;
}
