/**
 * THE PHONE'S ROOT: ok-rn's app (mainRoot.ts) and the two other roots ok-rn's index.js registers,
 * with its notes. The other shells take entry.ts. Metro picks this file by its .android extension.
 */
import { AppRegistry } from 'react-native';
import { mainRoot } from './mainRoot';

export const root = mainRoot();

export function registerMore(): void {
  /*
   * Keeps React Native's JS timers running while Edge watches in the background
   * (NativeEdgeAlertModule.keepJsTimers starts it, finishes it when watching stops).
   * It does nothing itself and never ends; the watcher's own code lives in
   * src/hooks/useEdgeBackgroundSync.ts.
   */
  AppRegistry.registerHeadlessTask('OkrnEdgeWatch', () => () => new Promise(() => {}));

  /*
   * EXPERIMENT (ok-rn's REMOVAL.md). A SECOND registered root on the same bundle. The
   * Credential Manager sheet launches CredProviderActivity, which renders this root instead
   * of App, so a WebAuthn request handed over by Chrome gets its own screen rather than the
   * whole app. Both activities share one ReactHost, so this costs a component, not a second
   * runtime.
   */
  AppRegistry.registerComponent('OkRNCredProvider', () => require('./credprovider/CredProviderScreen').default);
}
