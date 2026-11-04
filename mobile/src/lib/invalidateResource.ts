import type { QueryClient } from '@tanstack/react-query';

const inventory = ['inventory', 'inventory-item', 'dashboard', 'alerts', 'transferMatches'];
const shopping = ['shopping', ...inventory];
const all = ['household', 'members', 'invites', 'categories', 'preferences', ...shopping];

export async function invalidateResource(client: QueryClient, resource?: string, householdId?: string) {
  const keys = resource === 'inventory' ? inventory : resource === 'shopping' ? shopping : all;
  await Promise.all(keys.map(key => client.invalidateQueries({
    queryKey: householdId && key !== 'household' ? [key, householdId] : [key],
  })));
}
