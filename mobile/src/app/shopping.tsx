import { Link } from 'expo-router';
import { Text, View } from 'react-native';
import { FoundationScreen } from '@/components/FoundationScreen';
import { styles } from '@/features/auth/AccountScreen';

export default function ShoppingScreen() {
  return <FoundationScreen title="Shopping" description="A shared place for your next grocery run.">
    <View style={styles.card}>
      <Text style={styles.heading}>Your shopping list is coming soon</Text>
      <Text style={styles.body}>The shared checklist and purchase-to-inventory flow are still being built. You can already keep track of products in Inventory.</Text>
      <Link href="/inventory" style={{ color: '#22634b', fontSize: 16, fontWeight: '600', paddingVertical: 14, minHeight: 48 }}>Go to inventory →</Link>
    </View>
  </FoundationScreen>;
}
