import { act, render, screen } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { Text } from 'react-native';
import { SessionProvider, useSession } from '@/features/auth/SessionProvider';
import { Session } from '@/lib/session';

let mockSession: Session | null = null;
const mockListeners = new Set<() => void>();
jest.mock('@/lib/session', () => ({
  getSession: () => mockSession,
  restoreSession: jest.fn(async () => {}),
  subscribeSession: (listener: () => void) => {
    mockListeners.add(listener);
    return () => mockListeners.delete(listener);
  },
}));
function Household() {
  const result = useQuery({ queryKey: ['household'], queryFn: async () => 'Our home' });
  return <Text>{result.data ?? 'Loading household'}</Text>;
}
function Navigation() {
  const { loading, session } = useSession();
  if (loading) return <Text>Restoring</Text>;
  return session ? <Household /> : <Text>Sign in</Text>;
}
test('sign-in loads household data and sign-out clears private queries before the next screen mounts', async () => {
  mockSession = null;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  await render(<QueryClientProvider client={client}><SessionProvider><Navigation /></SessionProvider></QueryClientProvider>);
  await screen.findByText('Sign in');
  await act(async () => {
    mockSession = { accessToken: 'access', refreshToken: 'refresh', expiresAt: '2099-01-01', user: { id: 'ana', email: 'ana@example.com', displayName: 'Ana' } };
    mockListeners.forEach(listener => listener());
  });
  expect(await screen.findByText('Our home')).toBeTruthy();
  await act(async () => {
    mockSession = null;
    mockListeners.forEach(listener => listener());
  });
  expect(await screen.findByText('Sign in')).toBeTruthy();
  expect(client.getQueryCache().getAll()).toHaveLength(0);
});
