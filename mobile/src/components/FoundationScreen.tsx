import { colors } from '@/theme/tokens';
import { PageHeader, pageUi } from './PageHeader';
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
          <PageHeader title={title} />
          {!!description && <Text style={pageUi.body}>{description}</Text>}
        </View>}
        {children}
      </View>
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  background: { backgroundColor: colors.background },
  fill: { flex: 1 },
  page: { flexGrow: 1, alignItems: 'center' },
  content: { width: '100%', maxWidth: 1120, gap: 24, paddingBottom: 24 },
  dense: { gap: 10 },
  compact: { maxWidth: 560 },
  heading: { gap: 10, paddingVertical: 8 },
});
