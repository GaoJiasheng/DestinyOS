import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
/** Request OS permission once during onboarding; Android's channel precedes its permission dialog. */
export async function requestNotificationPermission(channelName: string): Promise<boolean> {
  if (Platform.OS === 'android')
    await Notifications.setNotificationChannelAsync('daily', {
      name: channelName,
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted) return true;
  if (!existing.canAskAgain) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
}
