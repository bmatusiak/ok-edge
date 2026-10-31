/*
 * ERRORS ARE EVENTS (drive debugging #2), the web shells (desktop, web app): the page's own error and
 * unhandledrejection events. errors.android.ts: React Native's exception manager. The app's own handling is unchanged.
 */
export function watchErrors(report: (kind: string, e: unknown) => void): void {
  if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return;
  window.addEventListener('error', (ev: ErrorEvent) => report('exception', ev.error ?? ev.message));
  window.addEventListener('unhandledrejection', (ev: PromiseRejectionEvent) => report('unhandled rejection', ev.reason));
}
