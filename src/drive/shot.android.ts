/* THE ANDROID APP'S PICTURE OF ITSELF (shot.ts): its own window, PixelCopy'd natively (okedge-native NativeDrive) */
import NativeDrive from 'okedge-native/specs/NativeDrive';

export async function shot(): Promise<{png: string} | {why: string}> {
  if (!NativeDrive) return {why: 'this build has no NativeDrive module'};
  try {
    return {png: await NativeDrive.capture()};
  } catch (e) {
    return {why: String((e as Error)?.message ?? e)};
  }
}
