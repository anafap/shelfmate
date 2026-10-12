import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export type User = { id: string; displayName: string; email: string };
export type Session = { accessToken: string; refreshToken: string; expiresAt: string; user: User };
export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
let session: Session | null = null;
let refreshToken: string | null = null;
let refreshPromise: Promise<Session> | null = null;
const listeners = new Set<() => void>();
const key = 'shelfmate.refresh';
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
async function save(next: Session | null) {
  if (Platform.OS !== 'web') {
    if (next) await SecureStore.setItemAsync(key, next.refreshToken);
    else await SecureStore.deleteItemAsync(key);
  }
  session = next;
  refreshToken = next?.refreshToken ?? null;
  listeners.forEach(listener => listener());
}
async function refresh(): Promise<Session> {
  if (!refreshToken) throw new ApiError(401, 'Please sign in again.');
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const next = await raw<Session>('/auth/refresh', { refreshToken });
        await save(next);
        return next;
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) await save(null);
        throw error;
      } finally { refreshPromise = null; }
    })();
  }
  return refreshPromise;
}
export async function restoreSession() {
  if (Platform.OS !== 'web') refreshToken = await SecureStore.getItemAsync(key);
  if (refreshToken) await refresh();
}
export async function signIn(email: string, password: string, displayName?: string) {
  const next = await raw<Session>(displayName === undefined ? '/auth/login' : '/auth/register', { email, password, displayName });
  await save(next);
}
export async function api<T>(path: string, body?: unknown, method = 'GET'): Promise<T> {
  if (!session) throw new ApiError(401, 'Please sign in again.');
  let current = session;
  if (Date.parse(current.expiresAt) <= Date.now() + 30000) current = await refresh();
  try { return await raw<T>(path, body, current.accessToken, method); }
  catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401) throw error;
    current = await refresh();
    return raw<T>(path, body, current.accessToken, method);
  }
}
export async function signOut() {
  await api('/auth/logout', undefined, 'POST');
  await save(null);
}
