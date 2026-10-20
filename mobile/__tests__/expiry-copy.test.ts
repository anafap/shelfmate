import { expiryLabel, formatProductDate, InventoryItem } from '@/features/inventory/types';
const item = { status: 'Active', expiryDate: '2026-10-20', expiryStatus: 'Expired', daysRemaining: -1, expiryType: 'Estimated' } as InventoryItem;
test('estimated dates stay distinct in every urgency state', () => {
  expect(expiryLabel(item)).toBe('Estimated date passed yesterday');
  expect(expiryLabel({ ...item, expiryStatus: 'ExpiringSoon', daysRemaining: 0 })).toBe('Estimated date is today');
  expect(expiryLabel({ ...item, expiryStatus: 'ExpiringSoon', daysRemaining: 1 })).toBe('Estimated date tomorrow');
  expect(expiryLabel({ ...item, expiryStatus: 'OK', daysRemaining: 30 })).toBe('Estimated date beyond alert window');
});
test('printed dates use natural language and missing dates stay unknown', () => {
  expect(expiryLabel({ ...item, expiryType: 'Printed' })).toBe('Expired yesterday');
  expect(expiryLabel({ ...item, expiryType: 'Printed', expiryStatus: 'ExpiringSoon', daysRemaining: 3 })).toBe('Expires in 3 days');
  expect(expiryLabel({ ...item, expiryDate: null, expiryStatus: 'Unknown' })).toBe('Expiry unknown');
  expect(expiryLabel({ ...item, status: 'Consumed' })).toBe('Consumed');
});
test('calendar date formatting retains the entered day', () => {
  expect(formatProductDate('2026-10-20')).toContain('20');
  expect(formatProductDate('2024-02-29')).toContain('29');
});
