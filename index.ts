import './src/crypto';

import { registerRootComponent } from 'expo';

import { root, registerMore } from './src/entry';

// The phone gets ok-rn's app (src/entry.android.ts); Electron and the web get the services
// screen (src/entry.ts). registerRootComponent registers it as 'main' and sets the environment
// up for a native build or the web alike.
registerMore();
registerRootComponent(root);
