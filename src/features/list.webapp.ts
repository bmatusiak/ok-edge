/*
 * THE WEB APP'S TABS (list.ts: the contract). A page reaches a hard key over WebAuthn only (the lib's tunnel), so the
 * tabs built on vendor messages or raw CTAPHID are not here (Brad, 2026-10-29: "webapp has no softkey, and no vendor
 * interface"): no Settings (PIN, preferences, backup/restore, firmware, advanced), no Passkeys (CTAPHID's credential
 * management), no slots on This Key; no Bluetooth tab (a browser is not a Bluetooth keyboard or authenticator).
 */
import {common, edge, thisKey} from './core';
import {mcpChannel} from './channels/mcp';
import {commonBanners, otherTabsBanner} from './banners';

export const coreFeatures = [thisKey({slots: false}), edge({always: false}), ...common, mcpChannel, otherTabsBanner, ...commonBanners];
