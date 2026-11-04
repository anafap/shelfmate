import { controlUi, webControlStyle } from '@/theme/controlStyles';
import { StyleSheet, Text, View } from 'react-native';

type Props = { label: string; value: string; onChange: (value: string) => void; disabled?: boolean };

export function TimeField({ label, value, onChange, disabled }: Props) {
  return <View style={styles.field}>
    <Text style={styles.label}>{label}</Text>
    <input aria-label={label} type="time" value={value} disabled={disabled} onChange={event => onChange(event.currentTarget.value)} style={inputStyle} />
  </View>;
}

const styles = StyleSheet.create({ field: controlUi.field, label: controlUi.label });
const inputStyle = { ...webControlStyle, width: '100%' } as const;
