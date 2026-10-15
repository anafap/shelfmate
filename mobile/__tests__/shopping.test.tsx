import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import ShoppingScreen, { ShoppingItem } from '@/features/shopping/ShoppingScreen';
import { inventoryPath } from '@/features/inventory/types';
import { api } from '@/lib/session';
jest.mock('@/lib/session', () => ({ api: jest.fn() }));
jest.mock('@/features/auth/SessionProvider', () => ({ useSession: () => ({ session: { user: { id: 'owner' } } }) }));
jest.mock('@/features/auth/HouseholdScreen', () => ({ useHousehold: () => ({ data: { id: 'home' }, isPending: false, isError: false }) }));
const base = { id: 'milk', name: 'Milk', householdId: 'home', quantity: 1, unit: 'bottle', categoryId: 'dairy', notes: null, status: 'ToBuy', version: 'v1', purchasedByName: null, purchasedAt: null, linkedInventoryItemId: null } as ShoppingItem;
let items: ShoppingItem[] = [];
const path = '/households/current/shopping-items';
beforeEach(() => { jest.clearAllMocks(); items = []; jest.mocked(api).mockImplementation(async (url, body) => {
  if (url === '/households/current/categories') return [{ id: 'dairy', key: 'dairy', name: 'Dairy' }] as never;
  if (url.startsWith(`${inventoryPath}?`)) return { items: [], total: 0, page: 1, pageSize: 100 } as never;
  if (url === path && body === undefined) return items as never;
  return undefined as never;
}); });
async function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } } });
  await render(<QueryClientProvider client={client}><ShoppingScreen /></QueryClientProvider>); return client;
}
test('compact quick add trims input, submits from keyboard, and confirms success', async () => {
  const client = await setup(); expect(await screen.findByText('Your list is clear')).toBeTruthy();
  const input = screen.getByLabelText('Quick add shopping item');
  await fireEvent.changeText(input, '  Milk  ');
  await fireEvent(input, 'submitEditing');
  await waitFor(() => expect(api).toHaveBeenCalledWith(path, { name: 'Milk' }, 'POST'));
  expect(await screen.findByText('Milk added to shopping.')).toBeTruthy(); client.clear();
});
test('purchase is separate from inventory transfer, which asks for quantity and expiry', async () => {
  items = [base];
  jest.mocked(api).mockImplementation(async (url, body, method) => {
    if (url.endsWith('/purchase')) { items = [{ ...base, status: 'Purchased', version: 'v2', purchasedByName: 'Ana', purchasedAt: '2026-10-12T12:00:00Z' }]; return items[0] as never; }
    if (url.endsWith('/transfer-to-inventory')) return {} as never;
    if (url === '/households/current/categories') return [{ id: 'dairy', key: 'dairy', name: 'Dairy' }] as never;
    if (url.startsWith(`${inventoryPath}?`)) return { items: [], total: 0, page: 1, pageSize: 100 } as never;
    if (url === path && method === undefined) return items as never;
    return items as never;
  });
  const client = await setup(); await screen.findByRole('checkbox', { name: 'Mark Milk purchased' });
  await fireEvent.press(screen.getByRole('checkbox', { name: 'Mark Milk purchased' }));
  await screen.findByText('Milk marked purchased. Add it to inventory when you’re ready.');
  expect(jest.mocked(api).mock.calls.some(([url]) => url.endsWith('/transfer-to-inventory'))).toBe(false);
  if (screen.queryByRole('button', { name: 'Show purchased items' })) await fireEvent.press(screen.getByRole('button', { name: 'Show purchased items' }));
  await fireEvent.press(screen.getByRole('button', { name: 'View Milk details' }));
  expect((await screen.findAllByText('Purchased by')).length).toBeGreaterThan(0); expect(screen.getAllByText(/Oct 12, 2026/).length).toBeGreaterThan(0);
  await fireEvent.press(screen.getByRole('button', { name: 'Add to inventory' }));
  await fireEvent.changeText(screen.getByLabelText('Quantity'), '2');
  await fireEvent.press(screen.getByRole('button', { name: 'Expiry date (optional)' }));
  await fireEvent(screen.getByTestId('picker-Expiry date (optional)'), 'onValueChange', {}, new Date('2026-10-20T12:00:00'));
  await fireEvent.press(screen.getByRole('button', { name: 'Transfer to inventory' }));
  await waitFor(() => expect(api).toHaveBeenCalledWith(`${path}/milk/transfer-to-inventory`, expect.objectContaining({ version: 'v2', confirmSeparateItem: false, item: expect.objectContaining({ quantity: 2, expiryDate: '2026-10-20', expiryType: 'Printed' }) }), 'POST'));
  expect(await screen.findByText('Purchase transferred to inventory.')).toBeTruthy(); client.clear();
});
test('checkbox can unpurchase an item while detail tap opens an intentional details sheet', async () => {
  items = [{ ...base, status: 'Purchased', version: 'v2', purchasedByName: 'Ana', purchasedAt: '2026-10-12T12:00:00Z' }];
  const client = await setup(); await screen.findByRole('button', { name: 'Show purchased items' });
  expect(screen.queryByRole('checkbox', { name: 'Uncheck Milk' })).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Show purchased items' }));
  await fireEvent.press(screen.getByRole('button', { name: 'View Milk details' }));
  expect((await screen.findAllByText('Purchased by')).length).toBeGreaterThan(0);
  expect(screen.getAllByText(/Oct 12, 2026/).length).toBeGreaterThan(0);
  await fireEvent.press(screen.getByRole('button', { name: 'Close item details' }));
  await fireEvent.press(screen.getByRole('checkbox', { name: 'Uncheck Milk' }));
  await waitFor(() => expect(api).toHaveBeenCalledWith(`${path}/milk/purchase`, { version: 'v2', operationId: 'v2', purchased: false }, 'POST')); client.clear();
});
test('purchased history stays collapsed and expands into a coherent purchase summary', async () => {
  items = [base, { ...base, id: 'bread', name: 'Bread', status: 'Purchased', version: 'v2', purchasedByName: 'Ana', purchasedAt: '2026-10-12T12:00:00Z' }];
  const client = await setup(); await screen.findByText('Milk');
  expect(screen.queryByText('Bread')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Show purchased items' }));
  expect(screen.getByText('Bread')).toBeTruthy();
  expect(screen.getByText('Purchased by')).toBeTruthy(); expect(screen.getByText('Ana')).toBeTruthy();
  expect(screen.getByText('Not in inventory')).toBeTruthy(); client.clear();
});
test('overflow menu holds edit and confirmed history removal', async () => {
  items = [base];
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const client = await setup(); await screen.findByText('Milk');
  expect(screen.queryByRole('button', { name: 'Remove from shopping history' })).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Options for Milk' }));
  expect(screen.getByRole('button', { name: 'Edit item' })).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Remove from shopping history' }));
  expect(alert).toHaveBeenCalledWith('Remove from shopping history?', expect.stringContaining('inventory item linked to it will stay'), expect.any(Array));
  alert.mockRestore(); client.clear();
});
test('matching inventory is shown before allowing a separate transfer', async () => {
  items = [{ ...base, status: 'Purchased', version: 'v2' }];
  jest.mocked(api).mockImplementation(async url => {
    if (url === '/households/current/categories') return [{ id: 'dairy', key: 'dairy', name: 'Dairy' }] as never;
    if (url.startsWith(`${inventoryPath}?`)) return { items: [{ id: 'existing', name: 'Milk', quantity: 2, unit: 'bottle', storageLocation: 'Fridge', expiryDate: '2026-10-20', expiryType: 'Printed' }], total: 1, page: 1, pageSize: 100 } as never;
    return items as never;
  });
  const client = await setup(); await screen.findByRole('button', { name: 'Show purchased items' });
  await fireEvent.press(screen.getByRole('button', { name: 'Show purchased items' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Options for Milk' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Add to inventory' }));
  expect(await screen.findByText('Already in inventory')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Transfer to inventory' }));
  expect(await screen.findByText('Review the matching product or confirm a separate item.')).toBeTruthy();
  expect(jest.mocked(api).mock.calls.some(([url]) => url.endsWith('/transfer-to-inventory'))).toBe(false);
  await fireEvent(screen.getByLabelText('Confirm separate inventory item'), 'valueChange', true);
  await fireEvent.changeText(screen.getByLabelText('Product name'), 'Oat milk');
  await fireEvent.changeText(screen.getByLabelText('Product name'), 'Milk');
  await screen.findByLabelText('Confirm separate inventory item');
  expect(screen.getByLabelText('Confirm separate inventory item').props.value).toBe(false); client.clear();
});
