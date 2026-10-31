/*
 * REACT NATIVE'S DEBUG OVERLAY ON THE PHONE (Brad, 2026-10-31: "hook into react-native's debugging overlay ... and do
 * something about it"). In React Native 0.88 with its new debugger (Fusebox) a warning no longer opens LogBox: it goes
 * to the debugger, and LogBox shows one toast at the bottom - "Open debugger to view warnings." - over the app's own
 * controls, saying nothing about what was warned. Errors still open LogBox's red toast.
 *
 * Hooked at LogBox's own store (LogBoxData.observe): every entry it holds goes to the drive - an error as an error event
 * (the server pictures it), a warning as a "[logbox]" line - and, while a drive is connected, the drive is the
 * debugger: each entry it has taken is dismissed, so nothing covers the screen it drives. With no drive connected
 * LogBox behaves as it always does. The warnings themselves are console lines the drive already has (client.ts).
 */
// eslint-disable-next-line @typescript-eslint/no-var-requires
const LogBoxData = require('react-native/Libraries/LogBox/Data/LogBoxData');

type Entry = {level: string; message: {content: string}; category?: string; componentStack?: unknown[]};

export function watchLogBox(report: (level: string, message: string) => void, connected: () => boolean): {connected(): void} {
  if (typeof LogBoxData?.observe !== 'function') return {connected() {}};
  const told = new WeakSet<object>();
  let current: Entry[] = [];
  const take = () => {
    for (const log of current) {
      if (!told.has(log)) { told.add(log); report(log.level, String(log.message?.content ?? '')); }
      if (connected()) LogBoxData.dismiss(log);
    }
  };
  LogBoxData.observe(({logs}: {logs: Set<Entry>}) => {
    current = [...logs];
    /* after this update is done: a dismiss inside the observer would update the store while it notifies */
    if (current.length) setImmediate(take);
  });
  /* a drive that connects later takes what is already on screen */
  return {connected: () => { if (current.length) setImmediate(take); }};
}
