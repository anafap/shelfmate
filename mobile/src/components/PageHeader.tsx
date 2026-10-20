import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '@/theme/tokens';

export function PageHeader({ title, onBack, backLabel = 'Back', count }: { title: string; onBack?: () => void; backLabel?: string; count?: string }) {
  return <View style={pageUi.header}>
    {onBack && <Pressable accessibilityRole="button" accessibilityLabel={backLabel} onPress={onBack} style={pageUi.back}><Text style={pageUi.backText}>←</Text></Pressable>}
    <Text accessibilityRole="header" style={pageUi.title}>{title}</Text>
    {count !== undefined && <Text style={pageUi.caption}>{count}</Text>}
  </View>;
}
export const pageUi = StyleSheet.create({
  header: { minHeight: 48, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  title: { flex: 1, color: colors.ink, fontSize: 28, lineHeight: 36, fontWeight: '800', letterSpacing: -0.6 },
  back: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.soft },
  backText: { color: colors.green, fontSize: 24 },
  panel: { padding: spacing.lg, gap: spacing.md, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  section: { gap: spacing.md },
  sectionTitle: { color: colors.text, fontSize: 18, lineHeight: 25, fontWeight: '700' },
  body: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  caption: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  row: { minHeight: 48, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.md },
  copy: { flex: 1, minWidth: 130, gap: spacing.xs },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  success: { color: colors.green, fontSize: 14, lineHeight: 21 },
});
