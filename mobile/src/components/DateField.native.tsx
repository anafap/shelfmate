import { controlUi } from '@/theme/controlStyles';
import NativeDatePicker from '@expo/ui/community/datetime-picker';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

type Props = { label: string; value: string; onChange: (value: string) => void; disabled?: boolean };

function pickerDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date();
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}

function displayDate(value: string) {
  return value ? new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric' }).format(pickerDate(value)) : 'Select a date';
}

export function DateField({ label, value, onChange, disabled }: Props) {
  const [open, setOpen] = useState(false);
  return <View style={styles.field}>
    <Text style={styles.label}>{label}</Text>
    <View style={styles.row}>
      <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityValue={{ text: value ? displayDate(value) : 'No date selected' }} disabled={disabled} onPress={() => setOpen(true)} style={styles.trigger}><Text style={styles.value}>{displayDate(value)}</Text></Pressable>
      {!!value && <Pressable accessibilityRole="button" accessibilityLabel={`Clear ${label}`} disabled={disabled} onPress={() => onChange('')} style={styles.clear}><Text style={styles.clearText}>Clear</Text></Pressable>}
    </View>
    {open && <View style={styles.picker}>
      <NativeDatePicker testID={`picker-${label}`} value={pickerDate(value)} mode="date" minimumDate={new Date(1900, 0, 1)} maximumDate={new Date(2100, 11, 31)} presentation="dialog" onDismiss={() => setOpen(false)} onValueChange={(_event, date) => {
        const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, '0'); const day = String(date.getDate()).padStart(2, '0');
        onChange(`${year}-${month}-${day}`);
        if (Platform.OS === 'android') setOpen(false);
      }} />
      {Platform.OS === 'ios' && <Pressable accessibilityRole="button" accessibilityLabel="Done choosing date" style={styles.done} onPress={() => setOpen(false)}><Text style={styles.clearText}>Done</Text></Pressable>}
    </View>}
  </View>;
}

const styles = StyleSheet.create({
  field: controlUi.field, label: controlUi.label, row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  trigger: { ...controlUi.frame, flex: 1, minWidth: 0, justifyContent: 'center' },
  value: controlUi.value, clear: controlUi.clear, clearText: controlUi.clearText,
  picker: { gap: 8 }, done: { alignSelf: 'flex-end', minHeight: 48, justifyContent: 'center', paddingHorizontal: 12 },
});
