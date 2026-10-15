import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Action, styles } from '@/features/auth/AccountScreen';
import { useHousehold } from '@/features/auth/HouseholdScreen';
import { api } from '@/lib/session';
import { InventoryForm } from './InventoryForm';
import { Category, InventoryItem, inventoryPath } from './types';

export default function EditInventoryScreen() {
  const household = useHousehold();
  const client = useQueryClient();
  const navigation = useNavigation();
  const { itemId } = useLocalSearchParams<{ itemId?: string }>();
  const [latestItem, setLatestItem] = useState<InventoryItem | null>(null);
  useEffect(() => {
    navigation.setOptions({ tabBarStyle: { display: 'none' } });
    return () => navigation.setOptions({ tabBarStyle: undefined });
  }, [navigation]);
  const categories = useQuery({ queryKey: ['categories', household.data?.id], queryFn: () => api<Category[]>('/households/current/categories'), enabled: !!household.data, retry: false });
  const product = useQuery({
    queryKey: ['inventory-item', household.data?.id, itemId],
    queryFn: () => api<InventoryItem>(`${inventoryPath}/${itemId}`),
    enabled: !!household.data && !!itemId,
    retry: false,
  });

  function returnToInventory() {
    if (router.canGoBack()) router.back();
    else router.replace('/inventory');
  }

  const item = latestItem ?? product.data;
  if (!household.data && household.isPending) return <View style={ui.loading}><ActivityIndicator accessibilityLabel="Loading household" /></View>;
  if (household.isError) return <View style={styles.card}><Text accessibilityRole="alert" style={styles.error}>{household.error.message}</Text><Action title="Back to Inventory" onPress={returnToInventory} /></View>;
  if (!household.data) return <View style={styles.card}><Text style={styles.body}>Create or join a household before editing inventory.</Text><Action title="Back to Inventory" onPress={returnToInventory} /></View>;
  if (!itemId) return <View style={styles.card}><Text style={styles.error}>No product was selected.</Text><Action title="Back to Inventory" onPress={returnToInventory} /></View>;
  if (product.isPending || categories.isPending) return <View style={ui.loading}><ActivityIndicator accessibilityLabel="Loading product details" /></View>;
  if (product.isError) return <View style={styles.card}><Text accessibilityRole="alert" style={styles.error}>{product.error.message}</Text><Action title="Retry product" disabled={product.isFetching} onPress={() => { product.refetch(); }} /><Action variant="secondary" title="Back to Inventory" onPress={returnToInventory} /></View>;
  if (categories.isError) return <View style={styles.card}><Text accessibilityRole="alert" style={styles.error}>{categories.error.message}</Text><Action title="Retry categories" disabled={categories.isFetching} onPress={() => { categories.refetch(); }} /><Action variant="secondary" title="Back to Inventory" onPress={returnToInventory} /></View>;
  if (!item || !categories.data) return null;

  const householdId = household.data.id;
  return <InventoryForm
    key={item.version}
    item={item}
    categories={categories.data}
    layout="editor"
    saveLabel="Save Changes"
    onCancel={returnToInventory}
    onReload={setLatestItem}
    onSaved={async () => {
      await client.invalidateQueries({ queryKey: ['inventory', householdId] });
      await client.invalidateQueries({ queryKey: ['dashboard', householdId] });
      returnToInventory();
    }}
  />;
}

const ui = StyleSheet.create({ loading: { flex: 1, alignItems: 'center', justifyContent: 'center' } });
