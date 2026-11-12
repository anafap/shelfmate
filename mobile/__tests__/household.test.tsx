import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { HouseholdScreen } from '@/features/auth/HouseholdScreen';
import { api, signOut } from '@/lib/session';

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
  await fireEvent.press(await screen.findByRole('button', { name: 'Create a household' }));
  await screen.findByLabelText('Household name');
  await fireEvent.changeText(screen.getByLabelText('Household name'), 'Our home');
  await fireEvent.press(screen.getByRole('button', { name: /^Household time zone:/ }));
  await fireEvent.changeText(screen.getByLabelText('Search city, country or time zone'), 'bahrain');
  await fireEvent.press(screen.getByRole('button', { name: 'Select Bahrain' }));
  expect(screen.queryByLabelText('Search city, country or time zone')).toBeNull();
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
  await fireEvent.press(await screen.findByRole('button', { name: 'Join a household' }));
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
  await screen.findByRole('button', { name: 'Revoke invitation for a household member' });
  expect(screen.getByText('Active invitations')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Revoke invitation for a household member' }));
  expect(api).not.toHaveBeenCalledWith('/households/current/invites/invite', undefined, 'DELETE');
  await fireEvent.press(screen.getByRole('button', { name: 'Keep invitation' }));
  expect(screen.getByRole('button', { name: 'Revoke invitation for a household member' })).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Revoke invitation for a household member' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Confirm revocation' }));
  await waitFor(() => expect(api).toHaveBeenCalledWith('/households/current/invites/invite', undefined, 'DELETE'));
  client.clear();
});
test('web invitation gives a copy path when browser sharing is unavailable', async () => {
  const originalPlatform = Platform.OS;
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
  jest.mocked(api).mockImplementation(async (path, _body, method) => {
    if (path === '/households/current') return household as never;
    if (path === '/households/current/members') return [{ userId: 'owner', displayName: 'Ana', role: 'Owner' }] as never;
    if (path === '/households/current/invites' && method !== 'POST') return [] as never;
    return { id: 'invite', token: 'private-code', expiresAt: '2099-01-01' } as never;
  });
  try {
    const client = await setup();
    await screen.findByRole('button', { name: 'Create invitation' });
    await fireEvent.press(screen.getByRole('button', { name: 'Create invitation' }));
    expect(await screen.findByText('private-code')).toBeTruthy();
    expect(screen.getByText('Select and copy the code above to share it privately.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Share invitation code' })).toBeNull();
    client.clear();
  } finally {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatform });
  }
});

test.each([2, 4])('owner can invite another member when household already has %i members', async (count) => {
  jest.mocked(api).mockImplementation(async (path, _body, method) => {
    if (path === '/households/current') return household as never;
    if (path === '/households/current/members') return Array.from({ length: count }, (_, i) => ({ userId: i === 0 ? 'owner' : `member-${i}`, displayName: `Person ${i}`, role: i === 0 ? 'Owner' : 'Member' })) as never;
    if (path === '/households/current/invites' && method !== 'POST') return [] as never;
    return { id: 'invite', token: 'new-member-code', expiresAt: '2099-01-01' } as never;
  });
  const client = await setup();
  expect(await screen.findByText(`Person ${count - 1}`)).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText('Member email (optional)'), 'housemate@example.com');
  await fireEvent.press(screen.getByRole('button', { name: 'Create invitation' }));
  expect(await screen.findByText('new-member-code')).toBeTruthy();
  expect(api).toHaveBeenCalledWith('/households/current/invites', { invitedEmail: 'housemate@example.com' }, 'POST');
  client.clear();
});
test('member settings show the household without invitation management', async () => {
  jest.mocked(api).mockImplementation(async path => {
    if (path === '/households/current') return { ...household, ownerUserId: 'another-owner' } as never;
    if (path === '/households/current/members') return [{ userId: 'owner', displayName: 'Ana', role: 'Member' }] as never;
    return [] as never;
  });
  const client = await setup();
  expect(await screen.findByText('Our home')).toBeTruthy();
  expect(screen.getByText('Member')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Create invitation' })).toBeNull();
  expect(api).not.toHaveBeenCalledWith('/households/current/invites');
  expect(screen.getByRole('button', { name: 'Sign out' })).toBeTruthy();
  client.clear();
});
test('setup reveals one form at a time and preserves a draft when returning to choices', async () => {
  jest.mocked(api).mockResolvedValue(null);
  const client = await setup();
  await screen.findByRole('button', { name: 'Create a household' });
  expect(screen.queryByLabelText('Household name')).toBeNull();
  expect(screen.queryByLabelText('Invitation code')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Create a household' }));
  await fireEvent.changeText(screen.getByLabelText('Household name'), 'Our home');
  expect(screen.queryByLabelText('Invitation code')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Back to household choices' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Join a household' }));
  expect(screen.queryByLabelText('Household name')).toBeNull();
  expect(screen.getByLabelText('Invitation code')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Back to household choices' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Create a household' }));
  expect(screen.getByLabelText('Household name').props.value).toBe('Our home');
  expect(jest.mocked(api).mock.calls.some(([, , method]) => method === 'POST')).toBe(false);
  client.clear();
});

test('create validates whitespace, locks repeated submissions and retains details after failure', async () => {
  let rejectRequest!: (error: Error) => void;
  jest.mocked(api).mockImplementation(async path => {
    if (path === '/households') return new Promise((_resolve, reject) => { rejectRequest = reject; });
    return null as never;
  });
  const client = await setup();
  await fireEvent.press(await screen.findByRole('button', { name: 'Create a household' }));
  await fireEvent.changeText(screen.getByLabelText('Household name'), '   ');
  await fireEvent.press(screen.getByRole('button', { name: 'Create household' }));
  expect(screen.getByText('Enter a household name.')).toBeTruthy();
  expect(jest.mocked(api).mock.calls.some(([, , method]) => method === 'POST')).toBe(false);
  await fireEvent.changeText(screen.getByLabelText('Household name'), '  Our home  ');
  await fireEvent.press(screen.getByRole('button', { name: 'Create household' }));
  expect(screen.getByRole('button', { name: 'Creating household…', disabled: true })).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Creating household…' }));
  await fireEvent(screen.getByLabelText('Household name'), 'submitEditing');
  expect(jest.mocked(api).mock.calls.filter(([path]) => path === '/households')).toHaveLength(1);
  expect(api).toHaveBeenCalledWith('/households', expect.objectContaining({ name: 'Our home' }), 'POST');
  rejectRequest(new Error('Unable to connect.'));
  expect(await screen.findByText('Unable to connect.')).toBeTruthy();
  expect(screen.getByLabelText('Household name').props.value).toBe('  Our home  ');
  await fireEvent.press(screen.getByRole('button', { name: 'Create household' }));
  await waitFor(() => expect(jest.mocked(api).mock.calls.filter(([path]) => path === '/households')).toHaveLength(2));
  rejectRequest(new Error('Still offline.'));
  await screen.findByText('Still offline.');
  client.clear();
});


test('an account without a household can sign out from setup choices', async () => {
  jest.mocked(api).mockResolvedValue(null);
  const client = await setup();
  await fireEvent.press(await screen.findByRole('button', { name: 'Sign out' }));
  await waitFor(() => expect(signOut).toHaveBeenCalledTimes(1));
  expect(jest.mocked(api).mock.calls.some(([, , method]) => method === 'POST')).toBe(false);
  client.clear();
});
