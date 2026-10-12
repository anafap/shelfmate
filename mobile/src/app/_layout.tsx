import { SessionProvider, useSession } from '@/features/auth/SessionProvider';
import { AccountScreen } from '@/features/auth/AccountScreen';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Tabs } from 'expo-router';
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
  if (loading || error || !session) return <AccountScreen />;
  return <Tabs screenOptions={{ tabBarActiveTintColor: '#22634b', headerTitle: 'ShelfMate' }}>
          <Tabs.Screen name="index" options={{ title: 'Home' }} />
          <Tabs.Screen name="inventory" options={{ title: 'Inventory' }} />
          <Tabs.Screen name="shopping" options={{ title: 'Shopping' }} />
          <Tabs.Screen name="alerts" options={{ title: 'Alerts' }} />
          <Tabs.Screen name="settings" options={{ href: null, title: 'Settings' }} />
        </Tabs>;
}
