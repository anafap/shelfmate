import { useMemo, useState } from 'react';
import { FlatList, Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Field } from '@/features/auth/AccountScreen';
import { searchTimeZones, timeZoneLabel, timeZones } from '@/lib/timeZones';
import { controlUi } from '@/theme/controlStyles';
import { colors, spacing } from '@/theme/tokens';
import { PageHeader, pageUi } from './PageHeader';

export function TimeZonePicker({ value, onChange, disabled }: { value: string; onChange: (zone: string) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  // Keep a valid device alias even if it isn't in the primary IANA list.
  const zones = useMemo(() => [...new Set([value, ...timeZones])].filter(Boolean), [value]);
  const matches = useMemo(() => searchTimeZones(zones, search), [zones, search]);
  function close() { Keyboard.dismiss(); setOpen(false); }
  return <View style={controlUi.field}>
    <Text style={controlUi.label}>Household time zone</Text>
    <Pressable accessibilityRole="button" accessibilityLabel={`Household time zone: ${timeZoneLabel(value)}`} accessibilityState={{ expanded: open, disabled }} disabled={disabled}
      style={[controlUi.frame, ui.trigger]} onPress={() => { Keyboard.dismiss(); setSearch(''); setOpen(true); }}>
      <Text style={[controlUi.value, ui.copy]}>{timeZoneLabel(value)}</Text>
      <Text accessibilityElementsHidden importantForAccessibility="no" style={ui.chevron}>⌄</Text>
    </Pressable>
    <Modal testID="time-zone-selection" visible={open} animationType="slide" presentationStyle="fullScreen" onRequestClose={close} onShow={() => StatusBar.setBarStyle('dark-content')}>
      <SafeAreaView style={ui.screen}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
        <KeyboardAvoidingView style={ui.screen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={ui.content} accessibilityViewIsModal onAccessibilityEscape={close}>
            <View style={ui.header}>
              <PageHeader title="Time zone" onBack={close} backLabel="Close time-zone picker" />
              <Field label="Search city, country or time zone" placeholder="e.g. London, India, Asia/Bahrain" value={search}
                autoCapitalize="none" autoCorrect={false} returnKeyType="search" onChangeText={setSearch} />
            </View>
            <FlatList key={search} style={ui.list} data={matches} keyExtractor={zone => zone} extraData={{ value, disabled }}
              keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" initialNumToRender={16} maxToRenderPerBatch={16} windowSize={7}
              ListEmptyComponent={<Text accessibilityLiveRegion="polite" style={[pageUi.body, ui.empty]}>No matching time zones. Try a nearby major city or region.</Text>}
              renderItem={({ item: zone }) => <Pressable accessibilityRole="button" accessibilityLabel={`Select ${timeZoneLabel(zone)}`}
                accessibilityState={{ selected: value === zone, disabled }} disabled={disabled}
                style={({ pressed }) => [ui.row, value === zone && ui.selected, pressed && ui.pressed]}
                onPress={() => { onChange(zone); close(); }}>
                <Text style={[controlUi.value, ui.copy, value === zone && ui.selectedText]}>{timeZoneLabel(zone)}</Text>
                {value === zone && <Text style={ui.selectedText}>✓ Selected</Text>}
              </Pressable>} />
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  </View>;
}
const ui = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1, width: '100%', maxWidth: 560, alignSelf: 'center' },
  header: { padding: spacing.lg, gap: spacing.md },
  trigger: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  copy: { flex: 1, minWidth: 0 },
  chevron: { color: colors.green, fontSize: 20 },
  list: { flex: 1, backgroundColor: colors.surface },
  row: { minHeight: 56, paddingVertical: spacing.md, paddingHorizontal: spacing.lg, gap: spacing.sm, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.border },
  selected: { backgroundColor: colors.soft },
  selectedText: { color: colors.green, fontWeight: '600' },
  pressed: { opacity: 0.7 },
  empty: { padding: spacing.lg },
});
