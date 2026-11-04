import { invalidateResource } from '@/lib/invalidateResource';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useNavigation } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { FoundationScreen } from '@/components/FoundationScreen';
import { PageHeader } from '@/components/PageHeader';
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
  if (household.data && categories.data?.length) return <InventoryForm layout="editor" item={null} categories={categories.data} onCancel={() => router.replace('/inventory')} onReload={() => {}} onSaved={async () => {
    await invalidateResource(client, 'inventory', household.data?.id);
    router.replace('/inventory');
  }} />;
  return <FoundationScreen title="Add to Inventory" description="" compact hideHeading fill topPadding={8}>
    <PageHeader title="Add to Inventory" onBack={() => router.replace('/inventory')} backLabel="Back to Inventory" />
    {!household.data && (household.isPending ? <ActivityIndicator accessibilityLabel="Loading household" /> : household.isError ? <View style={styles.card}>
      <Text accessibilityRole="alert" style={styles.error}>{household.error.message}</Text>
      <Action title="Retry household" disabled={household.isFetching} onPress={() => { household.refetch(); }} />
    </View> : <Text style={styles.body}>Create or join a household before adding inventory.</Text>)}
    {!!household.data && categories.isPending && <ActivityIndicator accessibilityLabel="Loading categories" />}
    {categories.isError && <View style={styles.card}><Text accessibilityRole="alert" style={styles.error}>{categories.error.message}</Text><Action title="Retry categories" disabled={categories.isFetching} onPress={() => { categories.refetch(); }} /></View>}

  </FoundationScreen>;
}
