import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useNavigation } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { FoundationScreen } from '@/components/FoundationScreen';
import { Action, styles } from '@/features/auth/AccountScreen';
import { useHousehold } from '@/features/auth/HouseholdScreen';
import { api } from '@/lib/session';
import { InventoryForm } from './InventoryForm';
import { Category } from './types';

export default function AddInventoryScreen() {
  const household = useHousehold(); const client = useQueryClient(); const navigation = useNavigation();
  const categories = useQuery({ queryKey: ['categories', household.data?.id], queryFn: () => api<Category[]>('/households/current/categories'), enabled: !!household.data, retry: false });
  useEffect(() => {
    navigation.setOptions({ tabBarStyle: { display: 'none' } });
    return () => navigation.setOptions({ tabBarStyle: undefined });
  }, [navigation]);
  return <FoundationScreen title="Add to Inventory" description="Add a product to your shared household inventory." compact>
    <View style={ui.header}><Pressable accessibilityRole="button" accessibilityLabel="Back to Inventory" onPress={() => router.replace('/inventory')} style={ui.back}><SymbolView name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }} tintColor="#193b2e" size={21} /></Pressable><Text accessibilityRole="header" style={ui.title}>Add to Inventory</Text></View>
    {!household.data && (household.isPending ? <ActivityIndicator accessibilityLabel="Loading household" /> : <Text style={styles.body}>Create or join a household before adding inventory.</Text>)}
    {categories.isPending && <ActivityIndicator accessibilityLabel="Loading categories" />}
    {categories.isError && <View style={styles.card}><Text accessibilityRole="alert" style={styles.error}>{categories.error.message}</Text><Action title="Retry categories" disabled={categories.isFetching} onPress={() => { categories.refetch(); }} /></View>}
    {!!categories.data?.length && <InventoryForm item={null} categories={categories.data} onCancel={() => router.replace('/inventory')} onReload={() => {}} onSaved={async () => {
      await client.invalidateQueries({ queryKey: ['inventory', household.data?.id] });
      await client.invalidateQueries({ queryKey: ['dashboard', household.data?.id] });
      router.replace('/inventory');
    }} />}
  </FoundationScreen>;
}
const ui = StyleSheet.create({ header: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 10 }, back: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' }, title: { color: '#102d24', fontSize: 23, fontWeight: '800' } });
