import * as Notifications from 'expo-notifications';
import { api } from '@/lib/session';
import { registerPushDevice } from '@/lib/push.native';
jest.mock('@/lib/session', () => ({ api: jest.fn() }));
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { extra: { eas: { projectId: 'test-project' } } } } }));
jest.mock('expo-notifications', () => ({ setNotificationHandler: jest.fn(), setNotificationChannelAsync: jest.fn(), AndroidImportance: { DEFAULT: 3 }, getPermissionsAsync: jest.fn(), requestPermissionsAsync: jest.fn(), getExpoPushTokenAsync: jest.fn() }));
beforeEach(() => jest.clearAllMocks());
test('permission denial never registers a token', async () => {
  jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue({ granted: false } as Notifications.NotificationPermissionsStatus);
  jest.mocked(Notifications.requestPermissionsAsync).mockResolvedValue({ granted: false } as Notifications.NotificationPermissionsStatus);
  expect(await registerPushDevice()).toBe(false);
  expect(Notifications.getExpoPushTokenAsync).not.toHaveBeenCalled(); expect(api).not.toHaveBeenCalled();
});
test('granted permission registers through the authenticated API without displaying the token', async () => {
  jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue({ granted: true } as Notifications.NotificationPermissionsStatus);
  jest.mocked(Notifications.getExpoPushTokenAsync).mockResolvedValue({ data: 'ExpoPushToken[device]', type: 'expo' });
  jest.mocked(api).mockResolvedValue({});
  expect(await registerPushDevice()).toBe(true);
  expect(api).toHaveBeenCalledWith('/me/push-devices', expect.objectContaining({ token: 'ExpoPushToken[device]' }), 'POST');
});
