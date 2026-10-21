/**
 * THE PHONE'S ROOT: ok-rn's app (PhoneApp.tsx, a copy of ok-rn's App.tsx) and the two other roots
 * ok-rn's index.js registers, with its notes. The other shells take entry.ts. Metro picks this
 * file by its .android extension, so the web and Electron bundles never contain the phone app.
 */
import React from 'react';
import { AppRegistry } from 'react-native';
import { startupFailure, StartupBoundary } from './StartupFailure';

/*
 * App is required inside a guard, not imported: an error while its modules load
 * (a native module this APK lacks) would otherwise leave the launch splash up
 * forever with nothing to read. See src/StartupFailure.tsx.
 */
let Root: React.ComponentType;
try {
  const App = require('../PhoneApp').default;
  Root = function GuardedApp() {
    return React.createElement(StartupBoundary, null, React.createElement(App));
  };
} catch (e) {
  Root = startupFailure(e, 'loading the app');
}
export const root = Root;

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
