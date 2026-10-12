import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { api } from './session';

Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }) });
export async function registerPushDevice(): Promise<boolean> {
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId ?? process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
  if (!projectId) throw new Error('Push setup is unavailable on this build. In-app reminders still work.');
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
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId ?? process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
  if (!projectId || !(await Notifications.getPermissionsAsync()).granted) return;
  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  await api('/me/push-devices', { token, platform: Platform.OS }, 'POST');
}
