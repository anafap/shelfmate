import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useContext } from 'react';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

export function FoundationScreen({ title, description, children, compact = false, hideHeading = false, safeAreaTop = false, fill = false, testID, topPadding, bottomPadding }: {
  title: string; description: string; children?: React.ReactNode; compact?: boolean; hideHeading?: boolean; safeAreaTop?: boolean; fill?: boolean; testID?: string; topPadding?: number; bottomPadding?: number;
}) {
  const { width } = useWindowDimensions();
  const insets = useContext(SafeAreaInsetsContext);
  return (
    <ScrollView testID={testID} style={[styles.background, fill && styles.fill]} keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.page, { paddingHorizontal: width < 600 ? 16 : 32, paddingTop: topPadding ?? (safeAreaTop || hideHeading ? (insets?.top ?? 0) + (hideHeading ? 8 : 20) : 20), paddingBottom: bottomPadding ?? 20 }]}>
      <View style={[styles.content, hideHeading && styles.dense, compact && styles.compact]}>
        {!hideHeading && <View style={styles.heading}>
          <Text style={styles.eyebrow}>SHELFMATE / YOUR HOUSEHOLD</Text>
          <Text style={styles.title} accessibilityRole="header">{title}</Text>
          <Text style={styles.body}>{description}</Text>
        </View>}
        {children}
      </View>
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  background: { backgroundColor: '#f5f7f5' },
  fill: { flex: 1 },
  page: { flexGrow: 1, alignItems: 'center' },
  content: { width: '100%', maxWidth: 1120, gap: 24, paddingBottom: 24 },
  dense: { gap: 10 },
  compact: { maxWidth: 560 },
  heading: { gap: 10, paddingVertical: 8 },
  eyebrow: { color: '#48725e', fontSize: 11, fontWeight: '700', letterSpacing: 2 },
  title: { fontSize: 34, fontWeight: '700', color: '#193b2e', letterSpacing: -1 },
  body: { fontSize: 16, lineHeight: 25, color: '#596b62', maxWidth: 650 },
});
