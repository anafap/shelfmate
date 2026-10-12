import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Tabs } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const queryClient = new QueryClient();
export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <Tabs screenOptions={{ tabBarActiveTintColor: '#22634b', headerTitle: 'ShelfMate' }}>
          <Tabs.Screen name="index" options={{ title: 'Home' }} />
          <Tabs.Screen name="inventory" options={{ title: 'Inventory' }} />
          <Tabs.Screen name="shopping" options={{ title: 'Shopping' }} />
          <Tabs.Screen name="alerts" options={{ title: 'Alerts' }} />
        </Tabs>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
