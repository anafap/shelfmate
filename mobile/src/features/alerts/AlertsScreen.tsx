import { useQuery } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { FoundationScreen } from '@/components/FoundationScreen';
import { PageHeader, pageUi } from '@/components/PageHeader';
import { Action, styles } from '@/features/auth/AccountScreen';
import { HouseholdScreen, useHousehold } from '@/features/auth/HouseholdScreen';
import { InventoryItem, expiryLabel, expiryTone, formatProductDate } from '@/features/inventory/types';
import { api } from '@/lib/session';
import { colors } from '@/theme/tokens';
import type { Preferences } from './ReminderPreferencesScreen';
export type { Preferences } from './ReminderPreferencesScreen';

export default function AlertsScreen() {
  const household = useHousehold();
  const preferences = useQuery({ queryKey: ['preferences', household.data?.id], queryFn: () => api<Preferences>('/me/notification-preferences'), enabled: !!household.data, retry: false });
  const alerts = useQuery({ queryKey: ['alerts', household.data?.id], queryFn: () => api<InventoryItem[]>('/households/current/alerts'), enabled: !!household.data, retry: false });
  if (!household.isPending && !household.isError && !household.data) return <HouseholdScreen />;
  return <FoundationScreen title="Alerts" description="" hideHeading fill topPadding={8}>
    <PageHeader title="Alerts" count={alerts.data ? `${alerts.data.length} to review` : undefined} />
    {household.isPending ? <ActivityIndicator accessibilityLabel="Loading household" /> : household.isError ? <View style={pageUi.panel}><Text style={styles.error}>{household.error.message}</Text><Action title="Retry household" onPress={() => { household.refetch(); }} /></View> : <>
      <Link href={{ pathname: '/reminder-preferences', params: { from: 'alerts' } }} asChild><Pressable accessibilityRole="button" accessibilityLabel="Edit reminder preferences" style={pageUi.panel}>
        <View style={pageUi.row}><View style={pageUi.copy}><Text style={pageUi.sectionTitle}>Reminders</Text>
          {preferences.data && <Text style={pageUi.caption}>In-app: {preferences.data.inAppEnabled ? 'On' : 'Off'} · Push: {preferences.data.pushEnabled ? 'On' : 'Off'}</Text>}
          {preferences.isPending && <ActivityIndicator accessibilityLabel="Loading reminder preferences" />}
          {preferences.isError && <Text style={pageUi.caption}>Settings unavailable. Tap to retry.</Text>}
        </View><Text style={ui.chevron}>›</Text></View>
      </Pressable></Link>
      {alerts.isPending && <ActivityIndicator accessibilityLabel="Loading alerts" />}
      {alerts.isError && <View style={pageUi.panel}><Text accessibilityRole="alert" style={styles.error}>{alerts.error.message}{alerts.data ? ' Showing previously loaded reminders.' : ''}</Text><Action variant="secondary" title="Retry alerts" disabled={alerts.isFetching} onPress={() => { alerts.refetch(); }} /></View>}
      {!alerts.isPending && !alerts.isError && alerts.data?.length === 0 && <View style={pageUi.panel}>
        <Text style={pageUi.sectionTitle}>{preferences.data?.inAppEnabled === false ? 'In-app reminders are off' : 'Nothing to review right now'}</Text>
        <Text style={pageUi.body}>{preferences.data?.inAppEnabled === false ? 'Turn them on in reminder preferences to see eligible items here.' : 'Active items appear here when their dates match your reminder preferences.'}</Text>
      </View>}
      {!!alerts.data?.length && <>
        <Text accessibilityRole="header" style={pageUi.sectionTitle}>Items to review</Text>
        <Text style={pageUi.body}>Review products and packaging instructions. Estimated dates are guides, not verified safety deadlines.</Text>
        {alerts.data.map(item => <Link key={item.id} href={{ pathname: '/inventory', params: { itemId: item.id } }} asChild>
          <Pressable accessibilityRole="button" accessibilityLabel={`Review ${item.name}`} style={StyleSheet.flatten([ui.item, ui[expiryTone(item)]])}>
            <View style={pageUi.copy}><Text style={ui.name}>{item.name}</Text><Text style={ui.urgency}>{expiryLabel(item)}</Text>
              <Text style={pageUi.caption}>{item.expiryType === 'Estimated' ? 'Estimated' : 'Printed'} · {item.expiryDate ? formatProductDate(item.expiryDate) : 'No date'} · {item.quantity} {item.unit}</Text>
            </View><Text style={ui.chevron}>›</Text>
          </Pressable>
        </Link>)}
      </>}
      <Action variant="secondary" title="Refresh alerts" disabled={alerts.isFetching} onPress={() => { alerts.refetch(); preferences.refetch(); }} />
    </>}
  </FoundationScreen>;
}
const ui = StyleSheet.create({
  item: { minHeight: 88, padding: 12, gap: 12, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 15, borderColor: colors.border, backgroundColor: colors.surface },
  name: { color: colors.ink, fontSize: 16, lineHeight: 23, fontWeight: '700' },
  urgency: { color: colors.text, fontSize: 14, lineHeight: 21, fontWeight: '600' },
  chevron: { color: colors.muted, fontSize: 24 },
  red: { backgroundColor: '#fff4f2', borderColor: '#f0d7d4' },
  orange: { backgroundColor: '#fff9f3', borderColor: '#f1ddca' },
  amber: { backgroundColor: '#fffbf2', borderColor: '#efe2c8' },
  green: { backgroundColor: '#fbfdfb' }, neutral: {},
});
