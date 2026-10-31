/*
 * THE APP'S NATIVE LOG, for a drive (client.ts): the lines its native side writes outside the JS console. A web shell
 * has none - everything it says is the page's console, which the drive already has. nativeLog.android.ts: logcat.
 */
export function watchNativeLog(_line: (l: string) => void): void {}
