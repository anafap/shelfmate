export type Category = { id: string; name: string; key: string; isSystemDefined: boolean };
export type InventoryItem = {
  id: string; householdId: string; name: string; categoryId: string; quantity: number; unit: string;
  purchaseDate: string | null; expiryDate: string | null; expiryType: 'Printed' | 'Estimated' | 'Unknown';
  storageLocation: string; notes: string | null; status: 'Active' | 'Consumed' | 'Discarded'; reminderEnabled: boolean;
  version: string; expiryStatus: 'Expired' | 'ExpiringSoon' | 'OK' | 'Unknown' | null;
  daysRemaining: number | null; householdLocalDate: string;
  createdBy: string; updatedBy: string; createdAt: string; updatedAt: string;
};
export type InventoryPage = { items: InventoryItem[]; total: number; page: number; pageSize: number };
export const inventoryPath = '/households/current/inventory';
export type ExpiryTone = 'red' | 'orange' | 'amber' | 'green' | 'neutral';
export function expiryTone(item: InventoryItem): ExpiryTone {
  if (item.status !== 'Active') return 'neutral';
  if (item.expiryStatus === 'Expired') return 'red';
  if (item.daysRemaining === 0) return 'orange';
  if (item.expiryStatus === 'ExpiringSoon') return 'amber';
  if (item.expiryStatus === 'OK') return 'green';
  return 'neutral';
}
export function expiryLabel(item: InventoryItem) {
  if (item.status !== 'Active') return item.status;
  if (item.expiryStatus === 'Unknown') return 'Expiry unknown';
  const estimated = item.expiryType === 'Estimated';
  if (item.expiryStatus === 'Expired') return estimated ? 'Estimated date passed · review item' : 'Expired · review item';
  if (item.daysRemaining === 0) return estimated ? 'Estimated date today · review item' : 'Expiry date today · review item';
  if (item.expiryStatus === 'ExpiringSoon') return `${estimated ? 'Estimated date approaching' : 'Expiring soon'} · ${item.daysRemaining} day(s) remaining`;
  return 'OK · beyond your alert window';
}
