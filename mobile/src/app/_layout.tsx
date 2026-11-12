import { usePendingRevocations } from '@/features/auth/usePendingRevocations';
import { colors } from '@/theme/tokens';
import { syncExistingPushDevice } from '@/lib/push';
import { useEffect, useRef } from 'react';
import { useLiveUpdates } from '@/features/sync/useLiveUpdates';
import { SessionProvider, useSession } from '@/features/auth/SessionProvider';
import { AccountScreen } from '@/features/auth/AccountScreen';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { router, Tabs } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { StatusBar, View, useWindowDimensions } from 'react-native';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { SyncStatusContext } from '@/features/sync/SyncStatusContext';
import { HouseholdScreen, useHousehold } from '@/features/auth/HouseholdScreen';
import { HouseholdHeader } from '@/features/auth/HouseholdHeader';
import { ScreenFocus } from '@/components/ScreenFocus';

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
  usePendingRevocations();
  const { session, loading, error } = useSession();
  const household = useHousehold();
  const wasSettingUp = useRef(false);
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const syncStatus = useLiveUpdates(session?.user.id);
  useEffect(() => {
    if (session?.user.id) void syncExistingPushDevice().catch(() => {});
  }, [session?.user.id]);
  useEffect(() => {
    if (!session) { wasSettingUp.current = false; return; }
    if (household.data === null) wasSettingUp.current = true;
    if (household.data && wasSettingUp.current) {
      wasSettingUp.current = false;
      router.replace('/');
    }
  }, [session, household.data]);
  if (loading || error || !session) return <AccountScreen />;
  if (!household.data) return <View style={{ flex: 1, backgroundColor: colors.background }}>
    <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
    <SafeAreaView edges={['top']} style={{ flex: 1 }}><ScreenFocus title="Your household"><HouseholdScreen /></ScreenFocus></SafeAreaView>
  </View>;
  return <View style={{ flex: 1, backgroundColor: colors.background }}>
    <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
    <SyncStatusContext.Provider value={syncStatus}>
    <SafeAreaView edges={['top']} style={{ backgroundColor: colors.background }}><HouseholdHeader /></SafeAreaView>
    <Tabs screenLayout={({ children, options }) => <ScreenFocus title={options.title ?? 'ShelfMate'}>{children}</ScreenFocus>} screenOptions={{
    headerShown: false,
    tabBarPosition: width >= 1000 ? 'left' : 'bottom',
    tabBarActiveTintColor: colors.green, tabBarInactiveTintColor: colors.muted,
    tabBarActiveBackgroundColor: '#eaf3ed',
    tabBarStyle: { backgroundColor: colors.surface, borderColor: colors.border, padding: 8, ...(width >= 1000 ? { width: 210 } : { height: 76 + insets.bottom, paddingBottom: 8 + insets.bottom }) },
    tabBarItemStyle: { borderRadius: 12, minHeight: 52, marginVertical: 4 },
    tabBarLabelStyle: { fontSize: 13, fontWeight: '600' },
  }}>
          <Tabs.Screen name="index" options={{ title: 'Home', headerShown: false, tabBarIcon: ({ color }) => <SymbolView name={{ ios: 'house.fill', android: 'home', web: 'home' }} tintColor={color} size={24} /> }} />
          <Tabs.Screen name="inventory" options={{ title: 'Inventory', tabBarIcon: ({ color }) => <SymbolView name={{ ios: 'shippingbox.fill', android: 'inventory_2', web: 'inventory_2' }} tintColor={color} size={24} /> }} />
          <Tabs.Screen name="add-inventory" options={{ href: null, title: 'Add to Inventory' }} />
          <Tabs.Screen name="edit-inventory" options={{ href: null, title: 'Edit Product' }} />
          <Tabs.Screen name="shopping" options={{ title: 'Shopping', tabBarIcon: ({ color }) => <SymbolView name={{ ios: 'cart.fill', android: 'shopping_cart', web: 'shopping_cart' }} tintColor={color} size={24} /> }} />
          <Tabs.Screen name="alerts" options={{ title: 'Alerts', tabBarIcon: ({ color }) => <SymbolView name={{ ios: 'bell.fill', android: 'notifications', web: 'notifications' }} tintColor={color} size={24} /> }} />
          <Tabs.Screen name="reminder-preferences" options={{ href: null, title: 'Reminders' }} />
          <Tabs.Screen name="settings" options={{ href: null, title: 'Settings' }} />
        </Tabs>
    </SyncStatusContext.Provider>
  </View>;
}
