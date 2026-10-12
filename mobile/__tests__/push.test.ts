import Constants from 'expo-constants';
import { isRunningInExpoGo } from 'expo';
import * as Notifications from 'expo-notifications';
import { api } from '@/lib/session';
import { registerPushDevice, syncExistingPushDevice } from '@/lib/push.native';
jest.mock('@/lib/session', () => ({ api: jest.fn() }));
jest.mock('expo', () => ({ isRunningInExpoGo: jest.fn(() => false) }));
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { extra: { eas: { projectId: 'test-project' } } } } }));
jest.mock('expo-notifications', () => ({ setNotificationHandler: jest.fn(), setNotificationChannelAsync: jest.fn(), AndroidImportance: { DEFAULT: 3 }, getPermissionsAsync: jest.fn(), requestPermissionsAsync: jest.fn(), getExpoPushTokenAsync: jest.fn() }));
beforeEach(() => { jest.clearAllMocks(); jest.mocked(isRunningInExpoGo).mockReturnValue(false); });
test('Expo Go skips push setup without breaking in-app alerts', async () => {
  jest.mocked(isRunningInExpoGo).mockReturnValue(true);
  await expect(syncExistingPushDevice()).resolves.toBeUndefined();
  await expect(registerPushDevice()).rejects.toThrow('Push reminders require a development build.');
  expect(Notifications.getPermissionsAsync).not.toHaveBeenCalled();
  expect(api).not.toHaveBeenCalled();
});
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

test('missing push setup does not prompt for permission or break local reminders', async () => {
  const eas = Constants.expoConfig!.extra!.eas;
  const original = eas.projectId;
  eas.projectId = undefined;
  try {
    await expect(registerPushDevice()).rejects.toThrow('In-app reminders still work.');
    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(api).not.toHaveBeenCalled();
  } finally { eas.projectId = original; }
});
test('existing permission rebinds the device to the signed-in account without asking again', async () => {
  jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue({ granted: true } as Notifications.NotificationPermissionsStatus);
  jest.mocked(Notifications.getExpoPushTokenAsync).mockResolvedValue({ data: 'ExpoPushToken[device]', type: 'expo' });
  await syncExistingPushDevice();
  expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
  expect(api).toHaveBeenCalledWith('/me/push-devices', expect.objectContaining({ token: 'ExpoPushToken[device]' }), 'POST');
});
