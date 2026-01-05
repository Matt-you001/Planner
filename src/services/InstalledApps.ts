import { Platform } from 'react-native';
import MattOnahModule from '../../modules/InstalledApps';

export const getInstalledApps = async () => {
  if (Platform.OS !== 'android') return [];

  try {
    const apps = MattOnahModule.getInstalledApps();
    return apps.map(app => ({
      name: app.label,
      packageName: app.packageName,
      // icon: app.icon, // Icon not supported in current native module implementation yet
    }));
  } catch (error) {
    console.error("Failed to get installed apps", error);
    return [];
  }
};

export const launchApp = (packageName: string) => {
    if (Platform.OS !== 'android') return false;
    try {
        return MattOnahModule.launchApp(packageName);
    } catch (error) {
        console.error("Failed to launch app", error);
        return false;
    }
};