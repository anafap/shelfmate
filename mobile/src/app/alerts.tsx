import { Link } from 'expo-router';
import { Text, View } from 'react-native';
import { FoundationScreen } from '@/components/FoundationScreen';
import { styles } from '@/features/auth/AccountScreen';

export default function AlertsScreen() {
  return <FoundationScreen title="Alerts" description="A little help remembering what to review.">
    <View style={styles.card}>
      <Text style={styles.heading}>Reminders are coming soon</Text>
      <Text style={styles.body}>In-app alerts and push preferences are still being built. For now, open Inventory to review products by their nearest expiry date.</Text>
      <Link href="/inventory" style={{ color: '#22634b', fontSize: 16, fontWeight: '600', paddingVertical: 14, minHeight: 48 }}>Go to inventory →</Link>
    </View>
  </FoundationScreen>;
}
