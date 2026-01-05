import { NativeModule, requireNativeModule } from 'expo';

import { MattOnahModuleEvents } from './MattOnah.types';

declare class MattOnahModule extends NativeModule<MattOnahModuleEvents> {
  getInstalledApps(): { label: string; packageName: string }[];
  launchApp(packageName: string): boolean;
}

// This call loads the native module object from the JSI.
export default requireNativeModule<MattOnahModule>('MattOnah');
