import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export type User = { id: string; displayName: string; email: string };
export type Session = { accessToken: string; refreshToken: string; expiresAt: string; user: User };
export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
let session: Session | null = null;
let refreshToken: string | null = null;
let generation = 0;
let storageQueue = Promise.resolve();
let refreshPromise: { generation: number; promise: Promise<Session> } | null = null;
let restorePromise: Promise<void> | null = null;
const listeners = new Set<() => void>();
const key = 'shelfmate.refresh';
const revocationKey = 'shelfmate.revocations';
let flushPromise: Promise<void> | null = null;
export const getSession = () => session;
export function subscribeSession(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
async function raw<T>(path: string, body?: unknown, accessToken?: string, method = 'POST'): Promise<T> {
  const base = process.env.EXPO_PUBLIC_API_URL;
  if (!base) throw new Error('Set EXPO_PUBLIC_API_URL in mobile/.env to connect.');
  let response: Response;
  try {
    response = await fetch(`${base.replace(/\/$/, '')}/api/v1${path}`, {
      method, headers: { 'Content-Type': 'application/json', ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(15000),
    });
  } catch { throw new Error('Unable to connect. Check your connection and try again.'); }
  if (!response.ok) {
    const problem = await response.json().catch(() => ({}));
    throw new ApiError(response.status, problem.title ?? (response.status === 429 ? 'Too many attempts. Try again in a minute.' : 'Request failed. Please try again.'));
  }
  return response.status === 204 ? undefined as T : response.json();
}
function checkGeneration(expected: number) {
  if (expected !== generation) throw new ApiError(401, 'Session changed. Please try again.');
}
function publish(next: Session | null) {
  session = next;
  refreshToken = next?.refreshToken ?? null;
  listeners.forEach(listener => listener());
}
async function save(next: Session | null, expected: number) {
  checkGeneration(expected);
  // Clearing private in-memory state must not depend on OS storage being available.
  if (!next) publish(null);
  const write = storageQueue.catch(() => {}).then(async () => {
    if (Platform.OS === 'web' || expected !== generation) return;
    if (next) await SecureStore.setItemAsync(key, next.refreshToken);
    else {
      try { await SecureStore.deleteItemAsync(key); }
      catch (error) {
        // A tombstone prevents restoring the old token if deletion alone failed.
        await SecureStore.setItemAsync(key, '');
        throw error;
      }
    }
  });
  storageQueue = write.catch(() => {});
  await write;
  checkGeneration(expected);
  if (next) publish(next);
}
async function refresh(expected = generation): Promise<Session> {
  checkGeneration(expected);
  if (!refreshToken) throw new ApiError(401, 'Please sign in again.');
  if (!refreshPromise || refreshPromise.generation !== expected) {
    const token = refreshToken;
    const promise = (async () => {
      try {
        const next = await raw<Session>('/auth/refresh', { refreshToken: token });
        checkGeneration(expected);
        await save(next, expected);
        return next;
      } catch (error) {
        if (expected === generation && error instanceof ApiError && error.status === 401) await save(null, expected);
        throw error;
      } finally { if (refreshPromise?.generation === expected) refreshPromise = null; }
    })();
    refreshPromise = { generation: expected, promise };
  }
  return refreshPromise.promise;
}
async function pendingRevocations(): Promise<string[]> {
  if (Platform.OS === 'web') return webRevocations;
  const stored = await SecureStore.getItemAsync(revocationKey);
  if (!stored) return [];
  const tokens: unknown = JSON.parse(stored);
  if (!Array.isArray(tokens) || tokens.some(token => typeof token !== 'string')) throw new Error('Unable to read pending sign-outs.');
  return tokens;
}
let webRevocations: string[] = [];
function updateRevocations(update: (tokens: string[]) => string[]) {
  const write = storageQueue.then(async () => {
    const tokens = update(await pendingRevocations());
    if (Platform.OS === 'web') webRevocations = tokens;
    else if (tokens.length) await SecureStore.setItemAsync(revocationKey, JSON.stringify(tokens));
    else await SecureStore.deleteItemAsync(revocationKey);
  });
  storageQueue = write.catch(() => {});
  return write;
}
export async function flushPendingRevocations(): Promise<void> {
  if (!flushPromise) {
    flushPromise = (async () => {
      await storageQueue;
      for (const token of await pendingRevocations()) {
        await raw('/auth/revoke', { refreshToken: token });
        await updateRevocations(tokens => tokens.filter(value => value !== token));
      }
    })().finally(() => { flushPromise = null; });
  }
  return flushPromise;
}
export async function restoreSession() {
  await flushPendingRevocations().catch(() => {});
  if (session) return;
  if (!restorePromise) {
    const expected = generation;
    restorePromise = (async () => {
      await storageQueue;
      const stored = Platform.OS !== 'web' ? await SecureStore.getItemAsync(key) : refreshToken;
      checkGeneration(expected);
      refreshToken = stored;
      if (refreshToken) await refresh(expected);
    })().finally(() => { restorePromise = null; });
  }
  await restorePromise;
}
export async function signIn(email: string, password: string, displayName?: string) {
  const expected = ++generation;
  await flushPendingRevocations().catch(() => {});
  checkGeneration(expected);
  const next = await raw<Session>(displayName === undefined ? '/auth/login' : '/auth/register', { email, password, displayName });
  await save(next, expected);
}
export async function api<T>(path: string, body?: unknown, method = 'GET'): Promise<T> {
  if (!session) throw new ApiError(401, 'Please sign in again.');
  const expected = generation;
  let current = session;
  if (Date.parse(current.expiresAt) <= Date.now() + 30000) current = await refresh(expected);
  checkGeneration(expected);
  try {
    const result = await raw<T>(path, body, current.accessToken, method);
    checkGeneration(expected);
    return result;
  }
  catch (error) {
    checkGeneration(expected);
    if (!(error instanceof ApiError) || error.status !== 401) throw error;
    if (!session) throw new ApiError(401, 'Please sign in again.');
    current = session.accessToken !== current.accessToken ? session : await refresh(expected);
    checkGeneration(expected);
    const result = await raw<T>(path, body, current.accessToken, method);
    checkGeneration(expected);
    return result;
  }
}
export async function signOut() {
  const token = refreshToken;
  const expected = ++generation;
  // Hide private screens and clear their caches before waiting for storage or network.
  publish(null);
  try {
    if (token) {
      // Retain only the capability to revoke; never restore or refresh queued tokens.
      await updateRevocations(tokens => [...new Set([...tokens, token])]).catch(() => {});
      await raw('/auth/revoke', { refreshToken: token });
      await updateRevocations(tokens => tokens.filter(value => value !== token));
    } else await api('/auth/logout', undefined, 'POST');
  }
  finally { if (generation === expected) await save(null, expected); }
}
