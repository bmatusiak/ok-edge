import type {TurboModule} from 'react-native';
import {TurboModuleRegistry} from 'react-native';

/**
 * THE ANDROID APP'S EYES FOR A DRIVE (PROPOSAL-drive.md; Brad, 2026-10-31: "asking the app for the screenshot, not host
 * dependent - have the app do it"). Only src/drive (client.ts, shot.android.ts, screen.android.ts) calls it, and only
 * inside the drive's debugging gate - a production build never dials a drive, so never asks.
 *
 * Text fields are never read: a PIN, a passphrase or a pasted backup stays on the phone (the web shells' innerText
 * leaves input values out the same way).
 */
export interface Spec extends TurboModule {
  /** The app's window as a PNG, base64 (PixelCopy of what is drawn). Rejects with the reason (a secure screen, no activity). */
  capture(): Promise<string>;
  /** The visible text of the app's views, top to bottom, one line each - text fields left out. */
  screenText(): Promise<string>;
  /**
   * Watch the window's layout: each change emits the device event "okedgeDriveScreen" (at most one waiting at a time -
   * the next comes after screenText() is read). false stops it. The native side of the web's MutationObserver.
   */
  watchScreen(on: boolean): void;
  /**
   * Follow this app's own logcat (its process only, from now on): each line emits the device event "okedgeDriveLog"
   * with the line, the JS console's own (ReactNativeJS) left out. false stops it. src/drive decides what leaves the phone.
   */
  watchLog(on: boolean): void;
}

/* get, not getEnforcing: the drive is a debugging tool - an app without the module drives without pictures or text */
export default TurboModuleRegistry.get<Spec>('NativeDrive');
