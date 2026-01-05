import { requireNativeView } from 'expo';
import * as React from 'react';

import { MattOnahViewProps } from './MattOnah.types';

const NativeView: React.ComponentType<MattOnahViewProps> =
  requireNativeView('MattOnah');

export default function MattOnahView(props: MattOnahViewProps) {
  return <NativeView {...props} />;
}
