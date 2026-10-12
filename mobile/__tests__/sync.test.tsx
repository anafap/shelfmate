import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react-native';
import { Text, View } from 'react-native';
import { useLiveUpdates } from '@/features/sync/useLiveUpdates';

const mockHandlers: Record<string, (event?: { resource: string }) => void> = {};
const mockConnection = { start: jest.fn(async () => {}), stop: jest.fn(async () => {}), on: jest.fn((event: string, fn: () => void) => { mockHandlers[event] = fn; }), off: jest.fn(), onclose: jest.fn(), onreconnecting: jest.fn((fn: () => void) => { mockHandlers.reconnecting = fn; }), onreconnected: jest.fn((fn: () => void) => { mockHandlers.reconnected = fn; }) };
jest.mock('@microsoft/signalr', () => ({ LogLevel: { None: 6 }, HubConnectionBuilder: class { withUrl() { return this; } configureLogging() { return this; } withAutomaticReconnect() { return this; } build() { return mockConnection; } } }));
jest.mock('@/features/auth/HouseholdScreen', () => ({ useHousehold: () => ({ data: { id: 'home' } }) }));
jest.mock('@/lib/session', () => ({ api: jest.fn(), getSession: () => ({ user: { id: 'owner' }, accessToken: 'secret' }) }));
let serverName = 'Old product';
function Client({ userId }: { userId?: string }) {
  const status = useLiveUpdates(userId);
  const item = useQuery({ queryKey: ['inventory', 'home'], queryFn: async () => serverName });
  return <View><Text>{status}</Text><Text>{item.data}</Text></View>;
}
test('resource events and reconnect refetch visible records; logout stops the connection', async () => {
  process.env.EXPO_PUBLIC_API_URL = 'http://localhost:5050';
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity, retry: false } } });
  const result = await render(<QueryClientProvider client={client}><Client userId="owner" /></QueryClientProvider>);
  await screen.findByText('Shared updates connected'); await screen.findByText('Old product');
  serverName = 'Partner updated product';
  await act(async () => { mockHandlers.ResourceChanged({ resource: 'inventory' }); });
  expect(await screen.findByText('Partner updated product')).toBeTruthy();
  await act(async () => { mockHandlers.reconnecting(); });
  expect(screen.getByText('Shared updates disconnected · refresh is available')).toBeTruthy();
  serverName = 'Updated while disconnected';
  await act(async () => { mockHandlers.reconnected(); });
  expect(await screen.findByText('Updated while disconnected')).toBeTruthy();
  await result.rerender(<QueryClientProvider client={client}><Client /></QueryClientProvider>);
  expect(mockConnection.stop).toHaveBeenCalled();
  client.clear();
});
