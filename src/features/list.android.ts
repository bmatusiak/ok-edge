/* THE PHONE'S TABS (list.ts: the contract): every tab, and the phone's own - Bluetooth: it is the keyboard and authenticator */
import {bluetooth, common, edge, passkeys, settings, settingsPages, thisKey} from './core';

export const coreFeatures = [thisKey({slots: true}), edge({always: false}), passkeys, bluetooth, settings, ...settingsPages, ...common];
