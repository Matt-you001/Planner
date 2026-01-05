import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Configure how notifications appear when the app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export const NotificationService = {
  async requestPermissions() {
    if (Platform.OS === 'web') return false;
    
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      console.log('Failed to get push token for push notification!');
      return false;
    }
    return true;
  },

  async scheduleNotification(title: string, body: string, triggerDate: Date, data?: Record<string, any>) {
    if (Platform.OS === 'web') return;
    
    // Ensure permission
    const hasPermission = await this.requestPermissions();
    if (!hasPermission) return;

    const now = Date.now();
    // If triggerDate is in the past, don't schedule
    if (triggerDate.getTime() <= now) {
         console.log("Notification time is in the past, skipping.");
         return;
    }

    try {
      // Android: Ensure channel is set up for sound
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
          sound: 'default', 
          lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
          bypassDnd: true,
        });

        // Set category to ALARM for full screen intent behavior (if supported)
        await Notifications.setNotificationCategoryAsync('ALARM_ACTION', [
          {
            identifier: 'OPEN_APP',
            buttonTitle: 'Open App',
            options: {
              opensAppToForeground: true,
            },
          },
          {
            identifier: 'DISMISS',
            buttonTitle: 'Dismiss',
            options: {
              isDestructive: true,
            },
          }
        ]);
      }

      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: data, // Attach custom data (e.g. linkedApp)
          sound: true, // For iOS
          priority: Notifications.AndroidNotificationPriority.MAX, // For Android
          categoryIdentifier: data?.linkedApp ? 'ALARM_ACTION' : undefined, // Only show buttons if app linked
          autoDismiss: false, // Keep it visible until interaction
          sticky: true,
          vibrate: [0, 250, 250, 250], // Force vibration pattern here too
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: triggerDate,
          channelId: 'default', 
        },
      });
      return id;
    } catch (e) {
      console.error("Failed to schedule notification", e);
      return null;
    }
  },

  async cancelAll() {
    await Notifications.cancelAllScheduledNotificationsAsync();
  }
};
