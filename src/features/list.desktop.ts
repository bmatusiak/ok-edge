/*
 * THE DESKTOP APP'S TABS (list.ts: the contract). No Bluetooth tab - the desktop has no Bluetooth of its own (Brad,
 * 2026-10-24). Edge always: the desktop hosts the hard key's Edge, whatever its bundled soft key has.
 */
import {common, edge, passkeys, settings, settingsPages, thisKey, setupTab} from './core';
import {mcpChannel} from './channels/mcp';
import {ipcChannel} from './channels/ipc';
import {commonBanners} from './banners';

export const coreFeatures = [thisKey({slots: true}), setupTab, edge({always: true}), passkeys, settings, ...settingsPages, ...common, mcpChannel, ipcChannel, ...commonBanners];
