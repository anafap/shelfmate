import { syncExistingPushDevice } from '@/lib/push';
import { useEffect } from 'react';
import { useLiveUpdates } from '@/features/sync/useLiveUpdates';
import { SessionProvider, useSession } from '@/features/auth/SessionProvider';
import { AccountScreen } from '@/features/auth/AccountScreen';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Link, Tabs } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const queryClient = new QueryClient();
export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <SessionProvider><Navigation /></SessionProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
function Navigation() {
  const { session, loading, error } = useSession();
  const { width } = useWindowDimensions();
  const syncStatus = useLiveUpdates(session?.user.id);
  useEffect(() => {
    if (session?.user.id) void syncExistingPushDevice().catch(() => {});
  }, [session?.user.id]);
  if (loading || error || !session) return <AccountScreen />;
  return <View style={{ flex: 1 }}>{!!syncStatus && <Text accessibilityLiveRegion="polite" style={{ padding: 8, backgroundColor: '#f0f5f1', color: '#22634b', fontSize: 13 }}>{syncStatus}</Text>}<Tabs screenOptions={{
    tabBarPosition: width >= 1000 ? 'left' : 'bottom',
    tabBarActiveTintColor: '#22634b', tabBarInactiveTintColor: '#596b62',
    tabBarActiveBackgroundColor: '#eaf3ed',
    tabBarStyle: { backgroundColor: '#fff', borderColor: '#e0e8e2', padding: 8, ...(width >= 1000 ? { width: 210 } : { height: 76 }) },
    tabBarItemStyle: { borderRadius: 12, minHeight: 52, marginVertical: 4 },
    tabBarLabelStyle: { fontSize: 13, fontWeight: '600' },
    headerTitle: 'ShelfMate', headerTitleStyle: { color: '#193b2e', fontWeight: '700' },
    headerShadowVisible: false, headerStyle: { backgroundColor: '#fff' },
    headerRight: () => <Link href="/settings" accessibilityLabel="Account & household settings" style={{ padding: 16, color: '#22634b', fontWeight: '600' }}>Settings</Link>,
  }}>
          <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: ({ color }) => <SymbolView name={{ ios: 'house.fill', android: 'home', web: 'home' }} tintColor={color} size={24} /> }} />
          <Tabs.Screen name="inventory" options={{ title: 'Inventory', tabBarIcon: ({ color }) => <SymbolView name={{ ios: 'shippingbox.fill', android: 'inventory_2', web: 'inventory_2' }} tintColor={color} size={24} /> }} />
          <Tabs.Screen name="shopping" options={{ title: 'Shopping', tabBarIcon: ({ color }) => <SymbolView name={{ ios: 'cart.fill', android: 'shopping_cart', web: 'shopping_cart' }} tintColor={color} size={24} /> }} />
          <Tabs.Screen name="alerts" options={{ title: 'Alerts', tabBarIcon: ({ color }) => <SymbolView name={{ ios: 'bell.fill', android: 'notifications', web: 'notifications' }} tintColor={color} size={24} /> }} />
          <Tabs.Screen name="settings" options={{ href: null, title: 'Settings' }} />
        </Tabs></View>;
}
