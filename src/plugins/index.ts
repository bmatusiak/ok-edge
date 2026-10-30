import Rectify from '@bmatusiak/rectify';

import tabs, {type TabsService} from './tabs';
import recipients, {type RecipientsService} from './recipients';
import {setStarted} from './registry';
import passwords from './passwords/plugin';
import guestbook from './guestbook/plugin';
import cryptobox from './cryptobox/plugin';
/* the core tabs (src/features/core.tsx), this platform's list (list.android.ts / list.webapp.ts / list.desktop.ts) */
import {coreFeatures} from '../features/list';

/*
 * THE APP PLUGINS, composed with Rectify as src/onlykey.ts composes the library's (Brad: Rectify
 * is the plugin system). A feature that is its own plugin lives in one folder under src/plugins/
 * and is named only here (PLUGINS, and E2E for its in-app suite). Removing it = deleting its
 * folder and its lines here; MainApp.tsx never
 * names it - it draws whatever tabs the plugins added (Brad, 2026-10-11, the Password Manager:
 * "i want the password manager to act as its own plugin, keeping it easy to remove and work on
 * seperatly").
 */
const PLUGINS: any[] = [tabs, recipients, ...coreFeatures, passwords, guestbook, cryptobox];

const app = Rectify.build(PLUGINS, (err: Error | null, ready: any) => {
  if (err) {
    console.warn('[plugins] did not start:', err.message);
    return;
  }
  setStarted(ready.services.tabs as TabsService, ready.services.recipients as RecipientsService);
});
app.start();

/* read from registry.ts by anyone; re-exported here for MainApp, which also starts the app by importing this file */
export {shownTabs, pluginTabs, pluginRecipientSources, pluginWatches, pluginChannels, pluginBanners, usePluginsStarted} from './registry';

/*
 * Each plugin's in-app e2e suite, by plugin name (__e2e_tests__/13b-passwords.e2e.js asks for it):
 * the e2e folder never names a plugin's files, so removing a plugin leaves its suite empty.
 */
const E2E: Record<string, () => any> = {
  passwords: () => require('./passwords/e2e'),
  guestbook: () => require('./guestbook/e2e'),
};
export function pluginE2E(name: string): ((harness: any) => void)[] {
  const load = E2E[name];
  return load ? [load()] : [];
}
