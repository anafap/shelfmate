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
/** Presentation only: urgency and day counts remain authoritative server values. */
export function expiryLabel(item: InventoryItem) {
  if (item.status !== 'Active') return item.status;
  if (!item.expiryDate || item.expiryStatus === 'Unknown') return 'Expiry unknown';
  const estimated = item.expiryType === 'Estimated';
  if (item.expiryStatus === 'Expired') {
    const days = item.daysRemaining === null ? null : -item.daysRemaining;
    const ago = days === 1 ? 'yesterday' : days !== null && days > 0 ? `${days} days ago` : '· review item';
    return `${estimated ? 'Estimated date passed' : 'Expired'} ${ago}`;
  }
  if (item.daysRemaining === 0) return estimated ? 'Estimated date is today' : 'Expires today';
  if (item.expiryStatus === 'ExpiringSoon' && item.daysRemaining !== null) {
    const when = item.daysRemaining === 1 ? 'tomorrow' : `in ${item.daysRemaining} days`;
    return `${estimated ? 'Estimated date' : 'Expires'} ${when}`;
  }
  return estimated ? 'Estimated date beyond alert window' : 'In stock';
}

export function formatProductDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(Date.UTC(year, month - 1, day)));
}
