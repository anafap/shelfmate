import { controlUi, webControlStyle } from '@/theme/controlStyles';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type Props = { label: string; value: string; onChange: (value: string) => void; disabled?: boolean };

export function DateField({ label, value, onChange, disabled }: Props) {
  return <View style={styles.field}>
    <Text style={styles.label}>{label}</Text>
    <View style={styles.row}>
      <input aria-label={label} type="date" value={value} min="1900-01-01" max="2100-12-31" disabled={disabled} onChange={event => onChange(event.currentTarget.value)} style={inputStyle} />
      {!!value && <Pressable accessibilityRole="button" accessibilityLabel={`Clear ${label}`} disabled={disabled} onPress={() => onChange('')} style={styles.clear}><Text style={styles.clearText}>Clear</Text></Pressable>}
    </View>
  </View>;
}

const styles = StyleSheet.create({ field: controlUi.field, label: controlUi.label, row: { flexDirection: 'row', alignItems: 'center', gap: 8 }, clear: controlUi.clear, clearText: controlUi.clearText });
const inputStyle = { ...webControlStyle, flex: 1, minWidth: 0 } as const;
