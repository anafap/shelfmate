import { useQuery } from '@tanstack/react-query';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FoundationScreen } from '@/components/FoundationScreen';
import { getReadiness } from '@/lib/api';

export default function HomeScreen() {
  const readiness = useQuery({ queryKey: ['readiness'], queryFn: getReadiness, retry: false });
  return (
    <FoundationScreen title="Welcome to ShelfMate" description="Keep track of what is at home, what to review first, and what to buy together.">
      <View style={styles.card}>
        <Text style={styles.heading}>Connection check</Text>
        <Text accessibilityLiveRegion="polite" style={styles.body}>
          {readiness.isFetching ? 'Checking the server and database…' : readiness.isError
            ? readiness.error.message : 'Server and database are reachable.'}
        </Text>
        <Pressable accessibilityRole="button" disabled={readiness.isFetching} onPress={() => readiness.refetch()} style={styles.button}>
          <Text style={styles.buttonText}>Check again</Text>
        </Pressable>
      </View>
    </FoundationScreen>
  );
}
const styles = StyleSheet.create({
  card: { padding: 20, borderRadius: 20, backgroundColor: '#ffffff', gap: 16 },
  heading: { fontSize: 20, fontWeight: '600', color: '#193b2e' },
  body: { fontSize: 16, lineHeight: 24, color: '#33473d' },
  button: { minHeight: 48, borderRadius: 12, backgroundColor: '#22634b', justifyContent: 'center', alignItems: 'center' },
  buttonText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
});
