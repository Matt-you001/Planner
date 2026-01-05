import { registerWebModule, NativeModule } from 'expo';

import { ChangeEventPayload } from './MattOnah.types';

type MattOnahModuleEvents = {
  onChange: (params: ChangeEventPayload) => void;
}

class MattOnahModule extends NativeModule<MattOnahModuleEvents> {
  PI = Math.PI;
  async setValueAsync(value: string): Promise<void> {
    this.emit('onChange', { value });
  }
  hello() {
    return 'Hello world! 👋';
  }
};

export default registerWebModule(MattOnahModule, 'MattOnahModule');
