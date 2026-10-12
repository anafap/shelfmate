import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import ShoppingScreen, { ShoppingItem } from '@/features/shopping/ShoppingScreen';
import { api } from '@/lib/session';
jest.mock('@/lib/session', () => ({ api: jest.fn() }));
jest.mock('@/features/auth/SessionProvider', () => ({ useSession: () => ({ session: { user: { id: 'owner' } } }) }));
jest.mock('@/features/auth/HouseholdScreen', () => ({ useHousehold: () => ({ data: { id: 'home' }, isPending: false, isError: false }) }));
const base = { id: 'milk', name: 'Milk', householdId: 'home', quantity: 1, unit: 'bottle', categoryId: 'dairy', notes: null, status: 'ToBuy', version: 'v1', purchasedByName: null, purchasedAt: null, linkedInventoryItemId: null } as ShoppingItem;
let items: ShoppingItem[] = [];
const path = '/households/current/shopping-items';
beforeEach(() => { jest.clearAllMocks(); items = []; jest.mocked(api).mockImplementation(async (url, body) => {
  if (url === '/households/current/categories') return [{ id: 'dairy', key: 'dairy', name: 'Dairy' }] as never;
  if (url === path && body === undefined) return items as never;
  return undefined as never;
}); });
async function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } } });
  await render(<QueryClientProvider client={client}><ShoppingScreen /></QueryClientProvider>); return client;
}
test('empty checklist supports quick add', async () => {
  const client = await setup(); expect(await screen.findByText('Nothing on your shopping list')).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText('Quick add shopping item'), 'Milk');
  await fireEvent.press(screen.getByRole('button', { name: 'Add to shopping' }));
  await waitFor(() => expect(api).toHaveBeenCalledWith(path, { name: 'Milk' }, 'POST')); client.clear();
});
test('purchase offers a separate reviewed transfer with quantity and expiry', async () => {
  items = [base];
  jest.mocked(api).mockImplementation(async (url, body, method) => {
    if (url.endsWith('/purchase')) { items = [{ ...base, status: 'Purchased', version: 'v2', purchasedByName: 'Ana', purchasedAt: '2026-10-12T12:00:00Z' }]; return items[0] as never; }
    if (url.endsWith('/transfer-to-inventory')) { items = [{ ...items[0], linkedInventoryItemId: 'inventory-id' }]; return {} as never; }
    if (url === '/households/current/categories') return [{ id: 'dairy', key: 'dairy', name: 'Dairy' }] as never;
    return items as never;
  });
  const client = await setup(); await screen.findByRole('button', { name: 'Mark Milk purchased' });
  await fireEvent.press(screen.getByRole('button', { name: 'Mark Milk purchased' }));
  await screen.findByRole('button', { name: 'Transfer Milk to inventory' });
  expect(jest.mocked(api).mock.calls.some(([url]) => url.endsWith('/transfer-to-inventory'))).toBe(false);
  expect(api).toHaveBeenCalledWith(`${path}/milk/purchase`, { version: 'v1', operationId: 'v1', purchased: true }, 'POST');
  await fireEvent.press(screen.getByRole('button', { name: 'Transfer Milk to inventory' }));
  await fireEvent.changeText(screen.getByLabelText('Quantity'), '2');
  await fireEvent.changeText(screen.getByLabelText('Expiry date (optional, YYYY-MM-DD)'), '2026-10-20');
  await fireEvent.press(screen.getByRole('button', { name: 'Transfer to inventory' }));
  await waitFor(() => expect(api).toHaveBeenCalledWith(`${path}/milk/transfer-to-inventory`, expect.objectContaining({ version: 'v2', confirmSeparateItem: false, item: expect.objectContaining({ quantity: 2, expiryDate: '2026-10-20', expiryType: 'Printed' }) }), 'POST'));
  expect(await screen.findByText('Purchase transferred to inventory.')).toBeTruthy(); client.clear();
});
test('unchecking uses the current version and an explicit false purchase action', async () => {
  items = [{ ...base, status: 'Purchased', version: 'v2' }];
  const client = await setup(); await screen.findByRole('button', { name: 'Uncheck Milk' });
  await fireEvent.press(screen.getByRole('button', { name: 'Uncheck Milk' }));
  await waitFor(() => expect(api).toHaveBeenCalledWith(`${path}/milk/purchase`, { version: 'v2', operationId: 'v2', purchased: false }, 'POST')); client.clear();
});
