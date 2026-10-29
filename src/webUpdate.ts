/*
 * THE WEB APP'S CACHE AND ITS UPDATES (Brad, 2026-10-29):
 *   "i want to make loading the webapp cheap using service worker, using the cache version, and updating"
 *   "splash screen can handle trigger checking the cache (if the server is offline) then no update"
 *   "the splash trigger will auto reload the page, clearing old cache for it to reload again"
 *   "if a push happens, and a browser tab is using the old version, it will tell the user to refresh its page"
 *   "this gives the user to use the webapp offline, in airplane mode"
 *
 * The page registers docs/sw.js (tools/web-build.js), which serves this build from its own cache. This build's version
 * is EXPO_PUBLIC_WEB_BUILD; the server's newest is /version.json, asked with no cache:
 *   at the splash   newer -> the old caches cleared, the worker unregistered, the page reloaded (once per version, so a
 *                   server that still answers the old page cannot loop it); no answer (offline) -> on, from the cache
 *   a tab already open, brought back to the front -> newer: the banner (UpdateBanner) - the reload is the person's
 * Only the web app's exported build: the desktop's own web export and the phone have no worker, and the dev server
 * (Metro) has no version.
 */
import {shell} from './platform';

declare const navigator: any;
declare const caches: any;
declare const location: any;
declare const sessionStorage: any;
declare const document: any;

export const WEB_BUILD: string = String(process.env.EXPO_PUBLIC_WEB_BUILD ?? '');
const on = shell === 'webapp' && !!WEB_BUILD && typeof navigator !== 'undefined' && 'serviceWorker' in navigator;

/** The worker registered (once, at start). */
export function registerWebCache(): void {
  if (!on) return;
  navigator.serviceWorker.register('/sw.js').catch((e: unknown) => console.log(`[web] the app's cache: not registered - ${String((e as Error)?.message ?? e)}`));
}

/** The server's newest build, or null when it does not answer (offline, airplane mode) within 3 s. */
async function newest(): Promise<string | null> {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 3000);
    const r = await fetch('/version.json', {cache: 'no-store', signal: ctl.signal});
    clearTimeout(t);
    return r.ok ? String((await r.json()).version ?? '') || null : null;
  } catch {
    return null;
  }
}

/** Clear this app's caches and its worker, and load the page again - from the server, which now serves the newer build. */
export async function reloadFresh(): Promise<void> {
  try {
    for (const k of await caches.keys()) if (String(k).startsWith('okedge-web-')) await caches.delete(k);
    for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister();
  } catch { /* nothing cached */ }
  location.reload();
}

/**
 * At the splash: a newer build on the server -> reloaded fresh (never returns then). Offline, or this build is the
 * newest -> resolves, and the app goes on from what it has.
 */
export async function updateAtSplash(): Promise<void> {
  if (!on) return;
  const v = await newest();
  if (v === null) { console.log(`[web] build ${WEB_BUILD}: the server did not answer - on from the cache`); return; }
  if (v === WEB_BUILD) return;
  const tried = (() => { try { return sessionStorage.getItem('okedge-web-reloaded-for'); } catch { return null; } })();
  if (tried === v) { console.log(`[web] build ${WEB_BUILD}: ${v} is out, and a reload did not bring it - the banner says so`); notify(v); return; }
  try { sessionStorage.setItem('okedge-web-reloaded-for', v); } catch { /* private mode: reloaded once anyway */ }
  console.log(`[web] build ${WEB_BUILD}: ${v} is out - the old cache cleared, reloading`);
  await reloadFresh();
  await new Promise(() => {});
}

/* a tab brought back to the front: asked again; a newer build -> the banner's listeners */
type Listener = (newer: string) => void;
const listeners = new Set<Listener>();
let outdated: string | null = null;
function notify(v: string) { outdated = v; for (const l of listeners) l(v); }
export function onOutdated(l: Listener): () => void {
  listeners.add(l);
  if (outdated) l(outdated);
  return () => { listeners.delete(l); };
}
/*
 * LOGGED IN, NO RELOAD BY ITSELF (Brad, 2026-10-29: "after a user login has happened, no auto reload, because that logs
 * them out - so a sheet popup with dismiss and reload"): before the PIN (the splash, the login screen) a newer build
 * reloads the page as at the splash; past it, the sheet asks (UpdateSheet). MainApp says which.
 */
let loggedIn = false;
export function setLoggedIn(v: boolean): void { loggedIn = v; }
if (on && typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    void newest().then((v) => {
      if (!v || v === WEB_BUILD) return;
      if (loggedIn) notify(v);
      else void updateAtSplash();
    });
  });
}
