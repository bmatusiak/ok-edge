/*
 * THE ANDROID APP'S OWN LOGCAT (nativeLog.ts): its process's lines - the native modules', the soft key's - read by the
 * app itself (okedge-native NativeDrive.watchLog), the way test-moniker follows `adb logcat --pid` from the host.
 */
import {DeviceEventEmitter} from 'react-native';
import NativeDrive from 'okedge-native/specs/NativeDrive';

export function watchNativeLog(line: (l: string) => void): void {
  if (!NativeDrive) return;
  DeviceEventEmitter.addListener('okedgeDriveLog', (l: unknown) => line(String(l)));
  NativeDrive.watchLog(true);
}
