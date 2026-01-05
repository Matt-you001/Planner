import * as React from 'react';

import { MattOnahViewProps } from './MattOnah.types';

export default function MattOnahView(props: MattOnahViewProps) {
  return (
    <div>
      <iframe
        style={{ flex: 1 }}
        src={props.url}
        onLoad={() => props.onLoad({ nativeEvent: { url: props.url } })}
      />
    </div>
  );
}
