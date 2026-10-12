import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { HouseholdScreen } from '@/features/auth/HouseholdScreen';
import { api } from '@/lib/session';

jest.mock('@/lib/session', () => ({ api: jest.fn(), signOut: jest.fn(), ApiError: class extends Error {} }));
jest.mock('@/features/auth/SessionProvider', () => ({ useSession: () => ({ session: { user: { id: 'owner', displayName: 'Ana' } } }) }));
const household = { id: 'home', name: 'Our home', timeZone: 'Asia/Bahrain', ownerUserId: 'owner' };
async function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } } });
  await render(<QueryClientProvider client={client}><HouseholdScreen settings /></QueryClientProvider>);
  return client;
}
beforeEach(() => jest.clearAllMocks());
test('new account can create a household with an explicit timezone', async () => {
  jest.mocked(api).mockResolvedValue(null);
  const client = await setup();
  await screen.findByLabelText('Household name');
  await fireEvent.changeText(screen.getByLabelText('Household name'), 'Our home');
  await fireEvent.changeText(screen.getByLabelText('Household time zone'), 'Asia/Bahrain');
  await fireEvent.press(screen.getByRole('button', { name: 'Create household' }));
  await waitFor(() => expect(api).toHaveBeenCalledWith('/households', { name: 'Our home', timeZone: 'Asia/Bahrain' }, 'POST'));
  client.clear();
});
test('invitation redemption is explicit and displays failures', async () => {
  jest.mocked(api).mockImplementation(async (path) => {
    if (path === '/household-invites/redeem') throw new Error('Invitation is invalid or no longer available.');
    return null as never;
  });
  const client = await setup();
  await screen.findByLabelText('Invitation code');
  await fireEvent.changeText(screen.getByLabelText('Invitation code'), 'private-code');
  await fireEvent.press(screen.getByRole('button', { name: 'Join household' }));
  expect(await screen.findByText('Invitation is invalid or no longer available.')).toBeTruthy();
  expect(api).toHaveBeenCalledWith('/household-invites/redeem', { token: 'private-code' }, 'POST');
  client.clear();
});
test('owner must confirm before revoking an invitation', async () => {
  jest.mocked(api).mockImplementation(async (path) => {
    if (path === '/households/current') return household as never;
    if (path === '/households/current/members') return [{ userId: 'owner', displayName: 'Ana', role: 'Owner' }] as never;
    if (path === '/households/current/invites') return [{ id: 'invite', expiresAt: '2099-01-01', invitedEmail: null }] as never;
    return undefined as never;
  });
  const client = await setup();
  await screen.findByRole('button', { name: 'Revoke invitation' });
  await fireEvent.press(screen.getByRole('button', { name: 'Revoke invitation' }));
  expect(api).not.toHaveBeenCalledWith('/households/current/invites/invite', undefined, 'DELETE');
  await fireEvent.press(screen.getByRole('button', { name: 'Confirm revocation' }));
  await waitFor(() => expect(api).toHaveBeenCalledWith('/households/current/invites/invite', undefined, 'DELETE'));
  client.clear();
});
