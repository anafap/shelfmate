import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import InventoryScreen from '@/features/inventory/InventoryScreen';
import AddInventoryScreen from '@/features/inventory/AddInventoryScreen';
import { InventoryForm } from '@/features/inventory/InventoryForm';
import { Category, InventoryItem, inventoryPath } from '@/features/inventory/types';
import { api, ApiError } from '@/lib/session';

let mockRouteParams: { itemId?: string } = {};
const mockPush = jest.fn(); const mockReplace = jest.fn();
jest.mock('expo-router', () => ({ ...jest.requireActual('expo-router'), useLocalSearchParams: () => mockRouteParams, router: { push: (...args: unknown[]) => mockPush(...args), replace: (...args: unknown[]) => mockReplace(...args) }, useNavigation: () => ({ setOptions: jest.fn() }) }));

async function chooseDate(label: string, date: string) {
  await fireEvent.press(screen.getByRole('button', { name: label }));
  await fireEvent(screen.getByTestId(`picker-${label}`), 'onValueChange', {}, new Date(`${date}T12:00:00`));
}

jest.mock('@/lib/session', () => ({ api: jest.fn(), ApiError: class extends Error { status: number; constructor(status: number, message: string) { super(message); this.status = status; } } }));
jest.mock('@/features/auth/SessionProvider', () => ({ useSession: () => ({ session: { user: { id: 'owner' } } }) }));
jest.mock('@/features/auth/HouseholdScreen', () => ({ useHousehold: () => ({ data: { id: 'home' }, isPending: false, isError: false }) }));
const categories: Category[] = [{ id: 'other', name: 'Other', key: 'other', isSystemDefined: true }, { id: 'dairy', name: 'Dairy', key: 'dairy', isSystemDefined: true }];
const milk: InventoryItem = {
  id: 'milk', householdId: 'home', name: 'Milk', categoryId: 'dairy', quantity: 1, unit: 'bottle',
  purchaseDate: null, expiryDate: '2026-10-12', expiryType: 'Printed', storageLocation: 'Fridge', notes: null,
  status: 'Active', reminderEnabled: true, version: 'v1', expiryStatus: 'ExpiringSoon', daysRemaining: 0,
  householdLocalDate: '2026-10-12', createdBy: 'owner', updatedBy: 'owner', createdAt: '', updatedAt: '',
};
let items: InventoryItem[] = [];
function defaultApi(path: string): Promise<never> {
  if (path === '/households/current/categories') return Promise.resolve(categories as never);
  if (path.startsWith(`${inventoryPath}?`)) return Promise.resolve({ items, total: items.length, page: 1, pageSize: 20 } as never);
  return Promise.resolve(milk as never);
}
async function setup(form = false) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } } });
  await render(<QueryClientProvider client={client}>{form ? <InventoryForm item={null} categories={categories} onSaved={async () => {}} onCancel={() => {}} onReload={() => {}} /> : <InventoryScreen />}</QueryClientProvider>);
  return client;
}
beforeEach(() => { jest.clearAllMocks(); items = []; mockRouteParams = {}; jest.mocked(api).mockImplementation(defaultApi); });
test('Inventory keeps the add form closed and opens the shared dedicated form from its floating button', async () => {
  const client = await setup();
  expect(await screen.findByText('No matching products yet')).toBeTruthy();
  expect(screen.queryByLabelText('Product name')).toBeNull();
  const scroll = screen.getByTestId('inventory-scroll');
  const fabOverlay = screen.getByTestId('inventory-fab-overlay');
  expect(fabOverlay.parent).toBe(scroll.parent);
  expect(fabOverlay.props.style).toEqual(expect.objectContaining({ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }));
  expect(scroll.props.contentContainerStyle[1]).toEqual(expect.objectContaining({ paddingTop: 8, paddingBottom: 72 }));
  await fireEvent.press(screen.getByRole('button', { name: 'Add product' }));
  expect(mockPush).toHaveBeenCalledWith('/add-inventory');
  client.clear();
});
test('dedicated Add to Inventory saves the existing form and returns to Inventory', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } } });
  await render(<QueryClientProvider client={client}><AddInventoryScreen /></QueryClientProvider>);
  await fireEvent.changeText(await screen.findByLabelText('Product name'), 'Rice');
  jest.mocked(api).mockImplementation(async (path, body, method) => method === 'POST' ? ({ id: 'rice', ...(body as object) } as never) : defaultApi(path));
  await fireEvent.press(screen.getByRole('button', { name: 'Save product' }));
  await waitFor(() => expect(api).toHaveBeenCalledWith(inventoryPath, expect.objectContaining({ name: 'Rice', expiryDate: null, expiryType: 'Unknown' }), 'POST'));
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/inventory'));
  client.clear();
});
test('a linked product opens by exact ID even when absent from the current page', async () => {
  mockRouteParams = { itemId: 'milk' };
  const client = await setup();
  expect(await screen.findByText('Milk')).toBeTruthy();
  expect(api).toHaveBeenCalledWith(`${inventoryPath}/milk`);
  expect(screen.queryByLabelText('Search products')).toBeNull();
  expect(screen.getByText('← All products')).toBeTruthy(); client.clear();
});
test('empty inventory offers add through the floating button without showing the form inline', async () => {
  const client = await setup();
  expect(await screen.findByText('No matching products yet')).toBeTruthy();
  expect(screen.queryByLabelText('Product name')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Add product' }));
  expect(mockPush).toHaveBeenCalledWith('/add-inventory'); client.clear();
});
test('optional purchase details preserve unknown expiry and chosen quantity/category', async () => {
  const client = await setup(true);
  await fireEvent.changeText(screen.getByLabelText('Product name'), 'Loose produce');
  await fireEvent.changeText(screen.getByLabelText('Quantity'), '0.5');
  await fireEvent.press(screen.getByRole('button', { name: 'Unit & more details' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Unit: kg' }));
  await chooseDate('Purchase date (optional)', '2026-10-12');
  await fireEvent.press(screen.getByRole('button', { name: 'Save product' }));
  await waitFor(() => expect(api).toHaveBeenCalledWith(inventoryPath, expect.objectContaining({ quantity: 0.5, unit: 'kg', purchaseDate: '2026-10-12', expiryDate: null, expiryType: 'Unknown' }), 'POST')); client.clear();
});
test('category can be changed directly without opening optional details', async () => {
  const client = await setup(true);
  await fireEvent.changeText(screen.getByLabelText('Product name'), 'Milk');
  await fireEvent.press(screen.getByRole('button', { name: 'Category: Other' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Choose Dairy' }));
  expect(screen.getByRole('button', { name: 'Category: Dairy' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Choose Dairy' })).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Save product' }));
  await waitFor(() => expect(api).toHaveBeenCalledWith(inventoryPath, expect.objectContaining({ categoryId: 'dairy' }), 'POST'));
  client.clear();
});
test('estimated expiry is explicitly selected and labeled', async () => {
  const client = await setup(true);
  await fireEvent.changeText(screen.getByLabelText('Product name'), 'Fruit');
  await chooseDate('Expiry date (optional)', '2026-10-15');
  await fireEvent.press(screen.getByRole('button', { name: 'Date type: Estimated' }));
  expect(screen.getByText('An estimated date is an editable guide, not a verified safety deadline.')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Save product' }));
  await waitFor(() => expect(api).toHaveBeenCalledWith(inventoryPath, expect.objectContaining({ expiryDate: '2026-10-15', expiryType: 'Estimated' }), 'POST')); client.clear();
});
test('optional expiry can be selected and cleared without entering a date', async () => {
  const client = await setup(true);
  await fireEvent.changeText(screen.getByLabelText('Product name'), 'Rice');
  expect(screen.getByRole('button', { name: 'Expiry date (optional)' }).props.accessibilityValue.text).toBe('No date selected');
  await chooseDate('Expiry date (optional)', '2026-10-15');
  expect(screen.getByRole('button', { name: 'Expiry date (optional)' }).props.accessibilityValue.text).toContain('2026');
  await fireEvent.press(screen.getByRole('button', { name: 'Clear Expiry date (optional)' }));
  expect(screen.getByRole('button', { name: 'Expiry date (optional)' }).props.accessibilityValue.text).toBe('No date selected');
  await fireEvent.press(screen.getByRole('button', { name: 'Save product' }));
  await waitFor(() => expect(api).toHaveBeenCalledWith(inventoryPath, expect.objectContaining({ expiryDate: null, expiryType: 'Unknown' }), 'POST'));
  client.clear();
});
test('editing a stale version requires reloading and reviewing before another save', async () => {
  items = [milk]; let latest = milk;
  jest.mocked(api).mockImplementation(async (path, body, method) => {
    if (method === 'PATCH') {
      if ((body as { version: string }).version === 'v1') { latest = { ...milk, name: 'Partner edit', version: 'v2' }; items = [latest]; throw new ApiError(409, 'This item changed. Reload it and review the latest details before saving.'); }
      return latest as never;
    }
    if (path === `${inventoryPath}/milk`) return latest as never;
    return defaultApi(path);
  });
  const client = await setup();
  await screen.findByRole('button', { name: 'Open Milk' });
  expect(screen.queryByRole('button', { name: 'Edit Milk' })).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Open Milk' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Edit Milk' }));
  await fireEvent.changeText(screen.getByLabelText('Product name'), 'My draft');
  await fireEvent.press(screen.getByRole('button', { name: 'Save changes' }));
  expect(await screen.findByText('This item changed. Reload it and review the latest details before saving.')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Reload latest details (replaces draft)' }));
  await waitFor(() => expect(screen.getByLabelText('Product name').props.value).toBe('Partner edit'));
  expect(jest.mocked(api).mock.calls.filter(([, , method]) => method === 'PATCH')).toHaveLength(1);
  await fireEvent.press(screen.getByRole('button', { name: 'Save changes' }));
  await waitFor(() => expect(api).toHaveBeenCalledWith(`${inventoryPath}/milk`, expect.objectContaining({ version: 'v2', name: 'Partner edit' }), 'PATCH')); client.clear();
});
test.each(['consume', 'discard'] as const)('%s requires confirmation before moving the item to history', async action => {
  items = [milk];
  jest.mocked(api).mockImplementation(async (path, body, method) => {
    if (method === 'POST') { items = []; return { ...milk, status: action === 'consume' ? 'Consumed' : 'Discarded' } as never; }
    return defaultApi(path);
  });
  const client = await setup();
  await screen.findByRole('button', { name: 'Open Milk' });
  await fireEvent.press(screen.getByRole('button', { name: 'Open Milk' }));
  await screen.findByRole('button', { name: `Mark Milk ${action === 'consume' ? 'consumed' : 'discarded'}` });
  await fireEvent.press(screen.getByRole('button', { name: `Mark Milk ${action === 'consume' ? 'consumed' : 'discarded'}` }));
  expect(api).not.toHaveBeenCalledWith(`${inventoryPath}/milk/${action}`, expect.anything(), 'POST');
  await fireEvent.press(screen.getByRole('button', { name: 'Confirm move to history' }));
  await waitFor(() => expect(api).toHaveBeenCalledWith(`${inventoryPath}/milk/${action}`, { version: 'v1' }, 'POST'));
  expect(await screen.findByText('Item moved to history.')).toBeTruthy(); client.clear();
});
test('inventory expiry copy uses natural date language', async () => {
  items = [{ ...milk, expiryDate: '2026-10-13', daysRemaining: 1 }];
  const client = await setup();
  expect(await screen.findByText('Expires tomorrow')).toBeTruthy();
  expect(screen.queryByText(/day\(s\) remaining/)).toBeNull();
  client.clear();
});
test.each([
  [-1, 'Expired yesterday'],
  [-2, 'Expired 2 days ago'],
  [0, 'Expires today'],
  [1, 'Expires tomorrow'],
  [4, 'Expires in 4 days'],
] as const)('expiry at %i days uses natural language', async (daysRemaining, label) => {
  items = [{ ...milk, daysRemaining, expiryStatus: daysRemaining < 0 ? 'Expired' : daysRemaining === 0 ? 'ExpiringSoon' : 'ExpiringSoon' }];
  const client = await setup();
  expect(await screen.findByText(label)).toBeTruthy();
  client.clear();
});
test.each([
  [1, 'piece', '1 piece'],
  [2, 'piece', '2 pieces'],
  [1, 'bottle', '1 bottle'],
  [2, 'box', '2 boxes'],
  [1, 'kg', '1 kg'],
] as const)('Inventory formats quantity %s %s as %s in the card and details', async (quantity, unit, label) => {
  items = [{ ...milk, quantity, unit }];
  const client = await setup();
  await screen.findByRole('button', { name: 'Open Milk' });
  expect(screen.getByText(label)).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Open Milk' }));
  expect(screen.getByText(`Quantity · ${label}`)).toBeTruthy();
  client.clear();
});
test('history keeps purchase date and notes accessible without active actions', async () => {
  items = [{ ...milk, status: 'Consumed', expiryStatus: null, purchaseDate: '2026-10-01', notes: 'Used for dinner' }];
  const client = await setup();
  await fireEvent.press(screen.getByRole('button', { name: 'Status: Active' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Status option: Consumed' }));
  await screen.findByRole('button', { name: 'Open Milk' });
  await fireEvent.press(screen.getByRole('button', { name: 'Open Milk' }));
  expect(screen.getByText('Purchased: 2026-10-01')).toBeTruthy();
  expect(screen.getByText('Used for dinner')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Edit Milk' })).toBeNull(); client.clear();
});
test('search and category filters request household-scoped server results', async () => {
  const client = await setup();
  await screen.findByText('No matching products yet');
  await fireEvent.changeText(screen.getByLabelText('Search products'), 'Milk');
  await fireEvent.press(screen.getByRole('button', { name: 'Category filter: Dairy' }));
  await waitFor(() => expect(jest.mocked(api).mock.calls.some(([path]) => path.includes('search=Milk') && path.includes('category=dairy'))).toBe(true)); client.clear();
});
test('network error offers a refresh and does not present fabricated inventory', async () => {
  let offline = true;
  jest.mocked(api).mockImplementation(async path => {
    if (path.startsWith(`${inventoryPath}?`) && offline) throw new Error('Unable to connect. Check your connection and try again.');
    return defaultApi(path);
  });
  const client = await setup();
  expect(await screen.findByText('Unable to connect. Check your connection and try again.')).toBeTruthy();
  expect(screen.queryByText('No matching products yet')).toBeNull();
  offline = false;
  await fireEvent.press(screen.getByRole('button', { name: 'Refresh inventory' }));
  expect(await screen.findByText('No matching products yet')).toBeTruthy(); client.clear();
});

test('history and sorting are available through more filters, and clear restores active inventory', async () => {
  const client = await setup();
  await screen.findByText('No matching products yet');
  expect(screen.queryByRole('button', { name: 'Status option: Consumed' })).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Status: Active' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Status option: Consumed' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Sort: Nearest expiry' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Sort option: Name (A–Z)' }));
  await waitFor(() => expect(jest.mocked(api).mock.calls.some(([path]) => path.includes('status=Consumed') && path.includes('sort=name'))).toBe(true));
  expect(screen.getByRole('button', { name: 'Clear filters' }).props.style).toEqual(expect.objectContaining({ minHeight: 24 }));
  await fireEvent.press(screen.getByRole('button', { name: 'Clear filters' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Status: Active' })).toBeTruthy());
  expect(screen.getByRole('button', { name: 'Sort: Nearest expiry' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Clear filters' })).toBeNull();
  client.clear();
});
