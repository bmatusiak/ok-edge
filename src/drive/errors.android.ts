/*
 * ERRORS ARE EVENTS (drive debugging #2), Android: every error React Native shows - an exception (its red box when
 * fatal) and, in 0.88, an unhandled rejection ("Uncaught (in promise, id: N)", promiseRejectionTrackingOptions.js) -
 * goes through ExceptionsManager.handleException. Wrapped here, so one place hears both; the original runs as before.
 * (The global error handler would hear only the first: RN's rejection tracker calls the manager directly.)
 */
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ExceptionsManager = require('react-native/Libraries/Core/ExceptionsManager');

export function watchErrors(report: (kind: string, e: unknown) => void): void {
  const manager = ExceptionsManager?.default ?? ExceptionsManager;
  const original = manager?.handleException;
  if (typeof original !== 'function') return;
  manager.handleException = (e: unknown, isFatal: boolean) => {
    const text = e instanceof Error ? e.message : String(e);
    report(/^Uncaught \(in promise/.test(text) ? 'unhandled rejection' : isFatal ? 'exception (fatal)' : 'exception', e);
    return original.call(manager, e, isFatal);
  };
}
