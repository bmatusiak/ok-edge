/*
 * THE ANDROID APP'S SCREEN TEXT (screen.ts): its views' visible text, read natively (okedge-native NativeDrive) - text
 * fields never - and a call on each change of the window's layout, the native event the module emits.
 */
import {DeviceEventEmitter} from 'react-native';
import NativeDrive from 'okedge-native/specs/NativeDrive';

export async function screenText(): Promise<string> {
  if (!NativeDrive) return '';
  try { return await NativeDrive.screenText(); } catch { return ''; }
}

export function watchScreen(changed: () => void): void {
  if (!NativeDrive) return;
  /* one event waits at a time natively; the read that follows (screenText) clears it */
  DeviceEventEmitter.addListener('okedgeDriveScreen', changed);
  NativeDrive.watchScreen(true);
}
