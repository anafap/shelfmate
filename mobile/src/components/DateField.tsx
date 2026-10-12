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

const styles = StyleSheet.create({ field: { gap: 6 }, label: { fontSize: 15, lineHeight: 23, color: '#52665a' }, row: { flexDirection: 'row', alignItems: 'center', gap: 8 }, clear: { minHeight: 48, paddingHorizontal: 10, justifyContent: 'center' }, clearText: { color: '#22634b', fontSize: 15, fontWeight: '600' } });
const inputStyle = { minHeight: 50, flex: 1, minWidth: 0, boxSizing: 'border-box', border: '1px solid #b5c5ba', borderRadius: 10, backgroundColor: '#fbfcfb', padding: 14, color: '#193b2e', fontSize: 16 } as const;
