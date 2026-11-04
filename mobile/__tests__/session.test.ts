import * as SecureStore from 'expo-secure-store';

jest.mock('expo-secure-store', () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));
const session = { accessToken: 'access', refreshToken: 'refresh', expiresAt: '2099-01-01', user: { id: 'ana', displayName: 'Ana', email: 'ana@example.com' } };
function response(status: number, data?: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => data } as Response;
}
const fetchMock = jest.fn();
beforeEach(() => {
  jest.resetModules(); jest.clearAllMocks();
  process.env.EXPO_PUBLIC_API_URL = 'http://localhost:5050';
  global.fetch = fetchMock;
  jest.mocked(SecureStore.setItemAsync).mockResolvedValue(undefined);
  jest.mocked(SecureStore.deleteItemAsync).mockResolvedValue(undefined);
});
test('native sign-in persists only the refresh token and logout clears it', async () => {
  const client = jest.requireActual<typeof import('@/lib/session')>('@/lib/session');
  fetchMock.mockResolvedValueOnce(response(200, session)).mockResolvedValueOnce(response(204));
  await client.signIn('ana@example.com', 'password');
  const storage = jest.requireMock<typeof import('expo-secure-store')>('expo-secure-store');
  expect(storage.setItemAsync).toHaveBeenCalledWith('shelfmate.refresh', 'refresh');
  await client.signOut();
  expect(storage.deleteItemAsync).toHaveBeenCalledWith('shelfmate.refresh');
  expect(client.getSession()).toBeNull();
});
test('parallel authenticated requests rotate an expired session only once', async () => {
  const client = jest.requireActual<typeof import('@/lib/session')>('@/lib/session');
  fetchMock.mockResolvedValueOnce(response(200, { ...session, expiresAt: '2000-01-01' }))
    .mockResolvedValueOnce(response(200, { ...session, accessToken: 'rotated', refreshToken: 'new-refresh' }))
    .mockResolvedValue(response(200, { id: 'home' }));
  await client.signIn('ana@example.com', 'password');
  await Promise.all([client.api('/me'), client.api('/households/current')]);
  expect(fetchMock.mock.calls.filter(([url]) => url.endsWith('/auth/refresh'))).toHaveLength(1);
  expect(client.getSession()?.refreshToken).toBe('new-refresh');
});
test('network failure preserves stored credentials for retry', async () => {
  const client = jest.requireActual<typeof import('@/lib/session')>('@/lib/session');
  const storage = jest.requireMock<typeof import('expo-secure-store')>('expo-secure-store');
  jest.mocked(storage.getItemAsync).mockResolvedValue('saved-refresh');
  fetchMock.mockRejectedValue(new Error('offline'));
  await expect(client.restoreSession()).rejects.toThrow('Unable to connect');
  expect(storage.deleteItemAsync).not.toHaveBeenCalled();
});
test('invalid refresh token clears private session state', async () => {
  const client = jest.requireActual<typeof import('@/lib/session')>('@/lib/session');
  const storage = jest.requireMock<typeof import('expo-secure-store')>('expo-secure-store');
  jest.mocked(storage.getItemAsync).mockResolvedValue('expired-refresh');
  fetchMock.mockResolvedValue(response(401, { title: 'Session expired.' }));
  await expect(client.restoreSession()).rejects.toThrow('Session expired.');
  expect(storage.deleteItemAsync).toHaveBeenCalled();
  expect(client.getSession()).toBeNull();
});

test('simultaneous startup restores read and rotate the stored token once', async () => {
  const client = jest.requireActual<typeof import('@/lib/session')>('@/lib/session');
  const storage = jest.requireMock<typeof import('expo-secure-store')>('expo-secure-store');
  jest.mocked(storage.getItemAsync).mockResolvedValue('saved-refresh');
  fetchMock.mockResolvedValue(response(200, session));
  await Promise.all([client.restoreSession(), client.restoreSession()]);
  expect(storage.getItemAsync).toHaveBeenCalledTimes(1);
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test('a delayed unauthorized response uses the token another request already rotated', async () => {
  const client = jest.requireActual<typeof import('@/lib/session')>('@/lib/session');
  let rejectSecond!: (value: Response) => void;
  fetchMock.mockResolvedValueOnce(response(200, session))
    .mockResolvedValueOnce(response(401, { title: 'Expired' }))
    .mockImplementationOnce(() => new Promise<Response>(resolve => { rejectSecond = resolve; }))
    .mockResolvedValueOnce(response(200, { ...session, accessToken: 'rotated', refreshToken: 'new-refresh' }))
    .mockResolvedValue(response(200, { id: 'home' }));
  await client.signIn('ana@example.com', 'password');
  const first = client.api('/me');
  const second = client.api('/households/current');
  await first;
  rejectSecond(response(401, { title: 'Expired' }));
  await second;
  expect(fetchMock.mock.calls.filter(([url]) => url.endsWith('/auth/refresh'))).toHaveLength(1);
});

test('sign-out clears local credentials even when the server is unavailable', async () => {
  const client = jest.requireActual<typeof import('@/lib/session')>('@/lib/session');
  fetchMock.mockResolvedValueOnce(response(200, session)).mockRejectedValueOnce(new Error('offline'));
  await client.signIn('ana@example.com', 'password');
  await expect(client.signOut()).rejects.toThrow('Unable to connect');
  expect(client.getSession()).toBeNull();
  const storage = jest.requireMock<typeof import('expo-secure-store')>('expo-secure-store');
  expect(storage.deleteItemAsync).toHaveBeenCalled();
});

function deferredResponse() {
  let resolve!: (value: Response) => void;
  const promise = new Promise<Response>(done => { resolve = done; });
  return { promise, resolve };
}
const otherSession = { ...session, accessToken: 'other-access', refreshToken: 'other-refresh', user: { ...session.user, id: 'other' } };

test('an old-account write is never retried under a new account', async () => {
  const client = jest.requireActual<typeof import('@/lib/session')>('@/lib/session');
  const pending = deferredResponse();
  fetchMock.mockResolvedValueOnce(response(200, session)).mockReturnValueOnce(pending.promise)
    .mockResolvedValueOnce(response(204)).mockResolvedValueOnce(response(200, otherSession));
  await client.signIn('ana@example.com', 'password');
  const write = client.api('/households/current/inventory', { name: 'Private draft' }, 'POST');
  const rejected = expect(write).rejects.toThrow('Session changed');
  await client.signOut();
  await client.signIn('other@example.com', 'password');
  pending.resolve(response(401));
  await rejected;
  expect(fetchMock.mock.calls.filter(([url]) => url.endsWith('/inventory'))).toHaveLength(1);
  expect(client.getSession()?.user.id).toBe('other');
});

test('an old-account successful response is discarded after switching accounts', async () => {
  const client = jest.requireActual<typeof import('@/lib/session')>('@/lib/session');
  const pending = deferredResponse();
  fetchMock.mockResolvedValueOnce(response(200, session)).mockReturnValueOnce(pending.promise)
    .mockResolvedValueOnce(response(200, otherSession));
  await client.signIn('ana@example.com', 'password');
  const read = client.api('/households/current');
  const rejected = expect(read).rejects.toThrow('Session changed');
  await client.signIn('other@example.com', 'password');
  pending.resolve(response(200, { name: 'Private old household' }));
  await rejected;
});

test.each([200, 401])('a delayed refresh response (%s) cannot replace or clear a new account', async status => {
  const client = jest.requireActual<typeof import('@/lib/session')>('@/lib/session');
  const pending = deferredResponse();
  fetchMock.mockResolvedValueOnce(response(200, { ...session, expiresAt: '2000-01-01' }))
    .mockReturnValueOnce(pending.promise).mockResolvedValueOnce(response(200, otherSession));
  await client.signIn('ana@example.com', 'password');
  const read = client.api('/me');
  const rejected = expect(read).rejects.toThrow();
  await client.signIn('other@example.com', 'password');
  pending.resolve(response(status, session));
  await rejected;
  expect(client.getSession()?.user.id).toBe('other');
  const storage = jest.requireMock<typeof import('expo-secure-store')>('expo-secure-store');
  expect(storage.setItemAsync).toHaveBeenLastCalledWith('shelfmate.refresh', 'other-refresh');
  expect(storage.deleteItemAsync).not.toHaveBeenCalled();
});

test('failed SecureStore deletion still clears local identity and writes a tombstone', async () => {
  const client = jest.requireActual<typeof import('@/lib/session')>('@/lib/session');
  const storage = jest.requireMock<typeof import('expo-secure-store')>('expo-secure-store');
  fetchMock.mockResolvedValueOnce(response(200, session)).mockResolvedValueOnce(response(204));
  await client.signIn('ana@example.com', 'password');
  jest.mocked(storage.deleteItemAsync).mockRejectedValueOnce(new Error('Storage unavailable'));
  await expect(client.signOut()).rejects.toThrow('Storage unavailable');
  expect(client.getSession()).toBeNull();
  expect(storage.setItemAsync).toHaveBeenLastCalledWith('shelfmate.refresh', '');
});
