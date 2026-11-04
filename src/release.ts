/*
 * THE RELEASE THIS SERVER PUBLISHES - /release.json, one file (Brad, 2026-11-04: "update notices have a unified place to
 * check"): written by the release workflow's publish job (tools/release/release-manifest.js) - the firmware, each app's
 * file and soft key, the web app's build. A server that publishes no release serves its web build alone
 * (published: false, tools/web-build.js). Asked once per page, with no cache; the Downloads panels read it.
 */
import {useEffect, useState} from 'react';
import {BROWSER_PAGE} from './platform';

export type ReleaseApp = {file: string; url: string; sha256: string; size: number; commit?: string; certSha256?: string; appId?: string; softKey: {version: string; plugins: string[]; fixes: string[]}};
export type Release = {
  published: true;
  name: string;
  version: string;
  code: number;
  tag: string;
  commit: string;
  releaseUrl: string;
  firmware: {
    version: string;
    sources: {'OnlyKey-Firmware': string; libraries: string};
    fixes: string[];
    plugins: string[];
    buildHash: string;
    builds: {flavor: 'prod' | 'test'; file: string; sha256: string; debug: boolean; tested: boolean; testedOn?: string; url: string}[];
  };
  apps: {android: ReleaseApp; desktop: {windows: ReleaseApp; linux: ReleaseApp}; web: {build: string; commit?: string; at?: string}};
};

let asked: Promise<Release | null> | null = null;
/** the published release, or null (no server page, nothing published, offline) - one request per page */
export function release(): Promise<Release | null> {
  if (!BROWSER_PAGE) return Promise.resolve(null);
  asked ??= fetch('/release.json', {cache: 'no-store'})
    .then(r => (r.ok ? r.json() : null))
    .then(j => (j && j.published === true && j.apps && j.firmware ? (j as Release) : null))
    .catch(() => null);
  return asked;
}

export function useRelease(): Release | null {
  const [r, setR] = useState<Release | null>(null);
  useEffect(() => {
    let alive = true;
    void release().then(x => { if (alive) setR(x); });
    return () => { alive = false; };
  }, []);
  return r;
}
