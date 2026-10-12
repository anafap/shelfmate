import { Link } from 'expo-router';
import { Text, View } from 'react-native';
import { HouseholdScreen } from '@/features/auth/HouseholdScreen';

export default function SettingsScreen() {
  return <View style={{ flex: 1 }}><Link href="/" style={{ padding: 16, minHeight: 48 }}><Text style={{ fontSize: 16, color: '#22634b' }}>Back to Home</Text></Link><HouseholdScreen settings /></View>;
}
