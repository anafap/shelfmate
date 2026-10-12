import NativeTimePicker from '@expo/ui/community/datetime-picker';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

type Props = { label: string; value: string; onChange: (value: string) => void; disabled?: boolean };

export function TimeField({ label, value, onChange, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [hour, minute] = value.split(':').map(Number);
  const selected = new Date(); selected.setHours(Number.isInteger(hour) ? hour : 9, Number.isInteger(minute) ? minute : 0, 0, 0);
  return <View style={styles.field}>
    <Text style={styles.label}>{label}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={() => setOpen(true)} style={styles.trigger}><Text style={styles.value}>{value}</Text></Pressable>
    {open && <View>
      <NativeTimePicker testID="reminder-time-picker" value={selected} mode="time" is24Hour presentation="dialog" onDismiss={() => setOpen(false)} onValueChange={(_event, date) => {
        onChange(`${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`);
        if (Platform.OS === 'android') setOpen(false);
      }} />
      {Platform.OS === 'ios' && <Pressable accessibilityRole="button" accessibilityLabel="Done choosing time" style={styles.done} onPress={() => setOpen(false)}><Text style={styles.doneText}>Done</Text></Pressable>}
    </View>}
  </View>;
}

const styles = StyleSheet.create({
  field: { gap: 6 }, label: { fontSize: 15, lineHeight: 23, color: '#52665a' },
  trigger: { minHeight: 50, borderWidth: 1, borderColor: '#b5c5ba', backgroundColor: '#fbfcfb', borderRadius: 10, padding: 14, justifyContent: 'center' },
  value: { fontSize: 16, color: '#193b2e' }, done: { alignSelf: 'flex-end', minHeight: 44, justifyContent: 'center', paddingHorizontal: 12 },
  doneText: { color: '#22634b', fontSize: 15, fontWeight: '600' },
});
