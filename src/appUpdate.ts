/*
 * A NEWER RELEASE FOR THE PHONE AND THE DESKTOP (Brad, 2026-11-04: "update notices have a unified place to check its
 * pinned version based on the build that was published"): the key's site's /release.json (tools/release/release-manifest.js)
 * against this build's version. The web app has its own (src/webUpdate.ts: it reloads; these download). Asked when the
 * key's site becomes known (after the login's identity read) and each time the app comes to the front - never a key
 * request. A version Dismissed is not offered again; the next one is.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {AppState, Platform} from 'react-native';
import {BROWSER_PAGE} from './platform';
import {buildInfo} from './buildInfo';
import {onRoomState, serverUrl} from './serverRoom';
import type {Release, ReleaseApp} from './release';

export type AppUpdate = {version: string; tag: string; app: ReleaseApp; mine: string};
const DISMISSED = 'okedge.update.dismissed';

/* 0.0.15 > 0.0.14: each published release has its own version (the workflow refuses a repeat) */
const newer = (a: string, b: string) => {
  const x = a.split('.').map(Number);
  const y = b.split('.').map(Number);
  for (let i = 0; i < Math.max(x.length, y.length); i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) > (y[i] ?? 0);
  return false;
};

/* this device's package in the release: the APK, or the desktop for this system */
function thisApp(r: Release): ReleaseApp | null {
  if (Platform.OS === 'android') return r.apps.android ?? null;
  if (Platform.OS === 'web' && !BROWSER_PAGE) return (/Windows/i.test(String(globalThis.navigator?.userAgent)) ? r.apps.desktop?.windows : r.apps.desktop?.linux) ?? null;
  return null;
}

async function check(): Promise<AppUpdate | null> {
  if (BROWSER_PAGE) return null;
  const base = await serverUrl().catch(() => null);
  if (!base) return null;
  try {
    const r = await fetch(`${base.replace(/\/$/, '')}/release.json`, {cache: 'no-store'});
    const j = r.ok ? ((await r.json()) as Release) : null;
    if (!j || j.published !== true || !newer(String(j.version), buildInfo.app)) return null;
    if ((await AsyncStorage.getItem(DISMISSED)) === j.version) return null;
    const app = thisApp(j);
    return app && /^https:\/\//.test(app.url) ? {version: j.version, tag: j.tag, app, mine: buildInfo.app} : null;
  } catch {
    return null; /* offline, or a server that publishes none */
  }
}

/** a newer release for this device, said now and whenever it changes; the returned function stops it */
export function onAppUpdate(fn: (u: AppUpdate | null) => void): () => void {
  if (BROWSER_PAGE) return () => {};
  let site: string | null | undefined;
  const ask = () => { void check().then(fn); };
  const room = onRoomState(s => { if (s.site !== site) { site = s.site; ask(); } });
  const front = AppState.addEventListener('change', st => { if (st === 'active') ask(); });
  return () => { room(); front.remove(); };
}

export function dismissAppUpdate(version: string): void {
  void AsyncStorage.setItem(DISMISSED, version).catch(() => {});
}
