import { StyleSheet } from 'react-native';
import { colors, spacing } from './tokens';

// Text fields, select triggers, and date/time controls share one frame.
export const controlUi = StyleSheet.create({
  field: { gap: spacing.sm },
  label: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  frame: { minHeight: 50, borderWidth: 1, borderColor: '#b5c5ba', backgroundColor: '#fbfcfb', borderRadius: 12, padding: spacing.md },
  value: { color: colors.text, fontSize: 16, lineHeight: 23 },
  clear: { minHeight: 48, justifyContent: 'center', paddingHorizontal: spacing.md },
  clearText: { color: colors.green, fontSize: 15, fontWeight: '600' },
});

export const webControlStyle = {
  minHeight: 50, boxSizing: 'border-box', border: '1px solid #b5c5ba',
  borderRadius: 12, backgroundColor: '#fbfcfb', padding: spacing.md,
  color: colors.text, fontFamily: 'inherit', fontSize: 16, lineHeight: '23px',
} as const;
