import { ScrollView, StyleSheet, Text } from 'react-native';

export function FoundationScreen({ title, description, children }: {
  title: string; description: string; children?: React.ReactNode;
}) {
  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Text style={styles.eyebrow}>YOUR HOUSEHOLD, TOGETHER</Text>
      <Text style={styles.title} accessibilityRole="header">{title}</Text>
      <Text style={styles.body}>{description}</Text>
      <Text style={styles.notice}>Development foundation · Household features are not available yet.</Text>
      {children}
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  page: { flexGrow: 1, padding: 24, gap: 20, backgroundColor: '#f7f8f2' },
  eyebrow: { color: '#22634b', fontWeight: '700', letterSpacing: 1 },
  title: { fontSize: 32, fontWeight: '700', color: '#193b2e' },
  body: { fontSize: 18, lineHeight: 28, color: '#33473d' },
  notice: { fontSize: 16, lineHeight: 24, color: '#4c5c53' },
});
