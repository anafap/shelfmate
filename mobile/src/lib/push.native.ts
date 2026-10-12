import Constants from 'expo-constants';
import { isRunningInExpoGo } from 'expo';
import { Platform } from 'react-native';
import { api } from './session';

let handlerSet = false;
function loadNotifications() {
  // Expo Go on Android throws while importing this module, so load it only in a development build.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const notifications = require('expo-notifications') as typeof import('expo-notifications');
  if (!handlerSet) {
    notifications.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }) });
    handlerSet = true;
  }
  return notifications;
}

export async function registerPushDevice(): Promise<boolean> {
  if (isRunningInExpoGo()) throw new Error('Push reminders require a development build. In-app reminders still work in Expo Go.');
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId ?? process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
  if (!projectId) throw new Error('Push setup is unavailable on this build. In-app reminders still work.');
  const Notifications = loadNotifications();
  if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('expiry-review', { name: 'Expiry reviews', importance: Notifications.AndroidImportance.DEFAULT });
  let permission = await Notifications.getPermissionsAsync();
  if (!permission.granted) permission = await Notifications.requestPermissionsAsync();
  if (!permission.granted) return false;
  let token: string;
  try { token = (await Notifications.getExpoPushTokenAsync({ projectId })).data; }
  catch { throw new Error('Could not register push on this phone. In-app reminders still work.'); }
  await api('/me/push-devices', { token, platform: Platform.OS }, 'POST');
  return true;
}

export async function syncExistingPushDevice(): Promise<void> {
  if (isRunningInExpoGo()) return;
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId ?? process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
  if (!projectId) return;
  const Notifications = loadNotifications();
  if (!(await Notifications.getPermissionsAsync()).granted) return;
  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  await api('/me/push-devices', { token, platform: Platform.OS }, 'POST');
}
