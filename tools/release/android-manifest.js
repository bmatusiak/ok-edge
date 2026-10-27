#!/usr/bin/env node
'use strict';
/*
 * THE ANDROID APP'S MANIFEST FOR THE DOWNLOADS PAGE (src/screens/AndroidDownload.tsx reads it at /android/manifest.json).
 *
 * The APK itself is a GitHub release asset (a Worker serves files of 25 MiB at most), so the manifest says where it is
 * and what to check it against: its sha256, and the SHA-256 of the certificate it is signed with - Android updates the
 * app on a phone only from an APK of the same id signed by the same certificate, so that is the number that matters.
 * The certificate digest is apksigner's (the APK as built), never the keystore's (what it was meant to be signed with).
 *
 *   node tools/release/android-manifest.js --apk <file> --apksigner <apksigner> --repo <owner/name> --tag <tag>
 *     --version <x.y.z> --version-code <n> --commit <sha> --out <manifest.json>
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const need = ['--apk', '--apksigner', '--repo', '--tag', '--version', '--version-code', '--commit', '--out'];
const missing = need.filter((k) => !opt(k));
if (missing.length) { console.error(`android-manifest: missing ${missing.join(' ')}`); process.exit(1); }

const apk = opt('--apk');
const bytes = fs.readFileSync(apk);
const certs = execFileSync(opt('--apksigner'), ['verify', '--print-certs', apk], { encoding: 'utf8' });
/* "Signer #1 certificate SHA-256 digest: <hex>"; one signer, or the update rule is not what the page says */
const digests = [...certs.matchAll(/certificate SHA-256 digest: ([0-9a-f]{64})/g)].map((m) => m[1]);
if (digests.length !== 1) { console.error(`android-manifest: expected one signer, apksigner printed ${digests.length}`); process.exit(1); }

const file = path.basename(apk);
const manifest = {
  appId: 'com.okrn',
  version: opt('--version'),
  versionCode: Number(opt('--version-code')),
  file,
  url: `https://github.com/${opt('--repo')}/releases/download/${opt('--tag')}/${file}`,
  sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
  size: bytes.length,
  certSha256: digests[0],
  /* until the OnlyKey signs releases through Edge (Brad, 2026-10-27) */
  signedWith: 'the repo debug keystore (signing/debug.keystore)',
  commit: opt('--commit').slice(0, 7),
  builtAt: new Date().toISOString(),
};
fs.mkdirSync(path.dirname(opt('--out')), { recursive: true });
fs.writeFileSync(opt('--out'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`android-manifest: ${file} ${manifest.size} bytes, sha256 ${manifest.sha256.slice(0, 12)}, cert ${manifest.certSha256.slice(0, 12)}`);
