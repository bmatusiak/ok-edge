/*
 * REACT NATIVE'S DEBUG OVERLAY (LogBox), for a drive (client.ts): the web shells have none - their errors and warnings
 * are the page's own (errors.ts, the console). logbox.android.ts hooks the phone's.
 */
export function watchLogBox(_report: (level: string, message: string) => void, _connected: () => boolean): {connected(): void} {
  return {connected() {}};
}
