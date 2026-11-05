#!/usr/bin/env node
'use strict';
/*
 * AN APK SIGNED BY AN ONLYKEY SLOT, ASKED OVER MCP (Brad, 2026-11-04: "i want to sign over mcp remote server, from my
 * desktop app"; "all ready, hashed, fingerprinted before sending; on budget approval, then the data passes to the desktop
 * app ... at the end of the budget, the results are sent back"; "i want to be able to run the process locally, sign the
 * apk not in the cloud, like we can do with the debug keystore, using the redkey").
 *
 *   node tools/release/apk-sign/sign.js card --cert <cert.pem> --server <url|local> --identity <hex> [--card "release signer"]
 *   node tools/release/apk-sign/sign.js <in.apk> --out <out.apk> --cert <cert.pem> --server <url|local> --identity <hex>
 *       [--card "release signer"] [--name <agent name>] [--minutes 30]
 * The key is named by its certificate only (Brad, 2026-11-04: "protect the actual slot ids from the random ai agent - it's only
 * asking for the cert it's presenting"): the card asks for it by the PEM, each item by its SHA-256; the owner's device knows
 * which slot that is, and this script never does.
 *   node tools/release/apk-sign/sign.js record <in.apk> --cert <cert.pem>     the digests apksigner asks for (no key)
 *   node tools/release/apk-sign/sign.js verify <apk> [--cert <cert.pem>]      its signer; with --cert, it must be that one
 *
 * ONE SIGNER, TWO PLACES: --server local is this computer's desktop app's own MCP (its local room - red-key on Brad's
 * PC); --server <url> the remote one (the Worker - the release workflow, with the GitHub secret). The flow is the same:
 *   1. RECORD: apksigner runs with the provider (java/okedge/apksign) in record mode - every digest it would have the
 *      key sign (v2 and v3: two; minSdk 24, so no v1; no v4) is written down, the output thrown away;
 *   2. ASK: as an MCP agent (its agent_key: OKEDGE_SIGNER, or a key file kept here) - plan_new under its card with each
 *      digest's SHA-256 fingerprint, plan_submit; the owner approves on their desktop and presses once; when it runs,
 *      plan_data with the digests; every signature comes back when the budget ends (plan_wait);
 *   3. REPLAY: apksigner again, answered from those signatures - apksig checks each against the certificate itself;
 *   4. VERIFY: apksigner verify must name the certificate given.
 * The agent's card, once: `sign.js card` (card_new - the owner approves the card sheet, one press to certify).
 *
 * Nothing waits forever: --minutes (30) for the owner's approval and the run, then it fails with nothing signed.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFileSync, spawnSync } = require('child_process');

const HERE = __dirname;
const ROOT = path.join(HERE, '..', '..', '..');
const CLASSES = path.join(HERE, '.local', 'classes');
const say = (l) => console.error(`[apk-sign] ${l}`);
const die = (l) => { say(`STOPPED: ${l}`); process.exit(1); };
/*
 * ITS TEMP FOLDERS GO WHEN IT DOES, HOWEVER IT ENDS (box, 2026-11-05: die() exits at once, so a finally never ran - a
 * stopped sign left its 147 MB folder in /tmp, and the next sign failed "Disk quota exceeded")
 */
const temps = new Set();
process.on('exit', () => { for (const d of temps) fs.rmSync(d, { recursive: true, force: true }); });
const tempDir = () => { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'apk-sign-')); temps.add(d); return d; };

const argv = process.argv.slice(2);
const flag = (k, d = null) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const positional = argv.filter((a, i) => !a.startsWith('--') && !(i && argv[i - 1].startsWith('--')));

/* ------------------------------------------------------------------ apksigner and the provider */

/* the Android SDK's newest build-tools with apksigner.jar: ANDROID_HOME, ANDROID_SDK_ROOT, android/local.properties, the usual places */
function buildTools() {
  const local = (() => { try { return (/^sdk\.dir=(.*)$/m.exec(fs.readFileSync(path.join(ROOT, 'android', 'local.properties'), 'utf8')) || [])[1]; } catch { return null; } })();
  const sdks = [process.env.ANDROID_HOME, process.env.ANDROID_SDK_ROOT, local && local.replace(/\\:/g, ':').replace(/\\\\/g, '\\'),
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Android', 'Sdk'), path.join(os.homedir(), 'Android', 'Sdk')].filter(Boolean);
  for (const sdk of sdks) {
    const dir = path.join(sdk, 'build-tools');
    if (!fs.existsSync(dir)) continue;
    const versions = fs.readdirSync(dir).filter((v) => fs.existsSync(path.join(dir, v, 'lib', 'apksigner.jar')))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    if (versions.length) return path.join(dir, versions[versions.length - 1]);
  }
  return die('no Android build-tools with apksigner (set ANDROID_HOME)');
}
const java = (tool) => (process.env.JAVA_HOME ? path.join(process.env.JAVA_HOME, 'bin', tool) : tool);

/* the provider, compiled when its sources are newer than its classes */
function build() {
  const src = path.join(HERE, 'java', 'okedge', 'apksign');
  const files = fs.readdirSync(src).filter((f) => f.endsWith('.java')).map((f) => path.join(src, f));
  const built = path.join(CLASSES, 'okedge', 'apksign', 'DeviceKeyProvider.class');
  if (fs.existsSync(built) && files.every((f) => fs.statSync(f).mtimeMs <= fs.statSync(built).mtimeMs)) return;
  fs.mkdirSync(CLASSES, { recursive: true });
  execFileSync(java('javac'), ['--release', '17', '-Xlint:all', '-d', CLASSES, ...files], { stdio: ['ignore', 'inherit', 'inherit'] });
  say('the provider is built');
}

function apksigner(args, env = {}) {
  const r = spawnSync(java('java'), ['-cp', [path.join(buildTools(), 'lib', 'apksigner.jar'), CLASSES].join(path.delimiter), 'com.android.apksigner.ApkSignerTool', ...args],
    { encoding: 'utf8', env: { ...process.env, ...env }, maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) {
    /*
     * THE EXCEPTION, NOT THE STACK'S END (box, 2026-11-05: "apksigner sign: at ...ApkSigner.sign(ApkSigner.java:241) | at
     * ...main" - the three last lines were all frames, the reason gone): its exception lines and causes first
     */
    const lines = (r.stderr || r.stdout || '').trim().split('\n');
    const why = lines.filter((l) => !/^\s+at /.test(l) && /\S/.test(l));
    die(`apksigner ${args[0]}: ${(why.length ? why : lines).slice(0, 4).map((l) => l.trim()).join(' | ')}`);
  }
  return r.stdout;
}

/* v2 + v3 only: minSdk 24 needs no v1 (JAR) signature, and v4 is a separate file for adb's incremental installs */
const SIGN_ARGS = (cert) => ['sign', '--ks', 'NONE', '--ks-type', 'OKEDGE', '--ks-provider-class', 'okedge.apksign.DeviceKeyProvider',
  '--ks-provider-arg', path.resolve(cert), '--ks-pass', 'pass:none', '--v1-signing-enabled', 'false', '--v2-signing-enabled', 'true',
  '--v3-signing-enabled', 'true', '--v4-signing-enabled', 'false'];

function certOf(file) {
  if (!file || !fs.existsSync(file)) die(`no certificate at ${file} (--cert)`);
  const c = new crypto.X509Certificate(fs.readFileSync(file));
  const d = c.publicKey.asymmetricKeyDetails;
  if (c.publicKey.asymmetricKeyType !== 'rsa') die('the certificate is not an RSA key\'s');
  return { bits: d.modulusLength, sha256: c.fingerprint256.replace(/:/g, '').toLowerCase(), subject: c.subject.replace(/\n/g, ', ') };
}

/* 1. what apksigner asks the key to sign, in order */
function record(apk, cert, tmp) {
  build();
  const file = path.join(tmp, 'digests.txt');
  fs.rmSync(file, { force: true });
  apksigner([...SIGN_ARGS(cert), '--in', path.resolve(apk), '--out', path.join(tmp, 'record.apk')], { OKSIGN_RECORD: file });
  const digests = fs.readFileSync(file, 'utf8').split('\n').map((l) => l.trim()).filter(Boolean);
  fs.rmSync(path.join(tmp, 'record.apk'), { force: true });
  if (!digests.length) die('apksigner asked for no signature');
  return digests;
}

/* 4. the APK's signer, as apksigner reads it */
function signerOf(apk) {
  const out = apksigner(['verify', '--print-certs', '-v', path.resolve(apk)]);
  return {
    /* "Signer #1 certificate ..." (older build-tools) or "V3.0 Signer: certificate ..." (build-tools 36 on) */
    sha256: ((/Signer(?: #1|:) certificate SHA-256 digest: ([0-9a-f]+)/.exec(out)) || [])[1] || null,
    schemes: ['v2', 'v3'].filter((v) => new RegExp(`Verified using ${v} scheme \\(APK Signature Scheme ${v}\\): true`).test(out)),
  };
}

/* ------------------------------------------------------------------ the MCP agent */

function serverUrl() {
  const s = flag('--server');
  if (!s) die('--server <url | local>');
  if (s !== 'local') return s.replace(/\/$/, '');
  const r = require('node-onlykey-lib/desktop/trust').readLocalMcp(undefined, 'computer');
  if (!r) die('no local MCP on this computer - is the ok-edge desktop app running?');
  return r.url;
}

/* one MCP session over Streamable HTTP (JSON answers); this computer's own loopback MCP may use the dev certificate */
async function mcp(url) {
  const { request } = require(url.startsWith('https:') ? 'https' : 'http');
  const loopback = /^https?:\/\/127\.0\.0\.1:/.test(url);
  const post = (body, sid) => new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = request(`${url}/mcp`, {
      method: 'POST', ...(loopback ? { rejectUnauthorized: false } : {}),
      headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', 'Content-Length': Buffer.byteLength(data), ...(sid ? { 'Mcp-Session-Id': sid } : {}) },
    }, (res) => {
      let text = '';
      res.on('data', (c) => { text += c; });
      res.on('end', () => resolve({ status: res.statusCode, sid: res.headers['mcp-session-id'], body: text ? JSON.parse(text) : null }));
    });
    req.on('error', reject);
    req.end(data);
  });
  const init = await post({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'ok-edge apk-sign', version: '1' } } });
  if (init.status !== 200 || !init.sid) die(`${url}/mcp: no session (HTTP ${init.status})`);
  await post({ jsonrpc: '2.0', method: 'notifications/initialized' }, init.sid);
  let n = 1;
  return async (name, args = {}) => {
    const r = await post({ jsonrpc: '2.0', id: ++n, method: 'tools/call', params: { name, arguments: args } }, init.sid);
    const m = r.body;
    if (!m || m.error) die(`${name}: ${m && m.error ? m.error.message : `HTTP ${r.status}`}`);
    return m.result.isError ? { refused: m.result.content[0].text } : m.result.structuredContent;
  };
}

/*
 * THE AGENT, BY ITS KEY: OKEDGE_SIGNER (the release workflow's GitHub secret), or a key file this computer keeps
 * (~/.okedge/apk-sign-agent.json, written at the first hello - its agent_key is what goes into the secret).
 */
async function agent(tool) {
  const name = flag('--name', process.env.GITHUB_ACTIONS ? 'ok-edge release workflow' : `ok-edge release signer (${os.hostname()})`);
  const file = flag('--key-file', path.join(os.homedir(), '.okedge', 'apk-sign-agent.json'));
  let key = process.env.OKEDGE_SIGNER || null;
  if (!key) { try { key = JSON.parse(fs.readFileSync(file, 'utf8')).agent_key; } catch { /* the first time */ } }
  const r = await tool('hello', key ? { name, agent_key: key } : { name });
  if (r.refused) die(`hello: ${r.refused}`);
  if (!key) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify({ agent_key: r.agent_key, agent_id: r.agent_id, name }, null, 2), { mode: 0o600 });
    say(`a new agent ${r.agent_id.slice(0, 16)} - its agent_key kept in ${file} (for the workflow: that agent_key is the OKEDGE_SIGNER secret)`);
  }
  return r.agent_id;
}

function identityArg() {
  const id = String(flag('--identity', process.env.OKEDGE_IDENTITY || '')).toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(id)) die('--identity <the identity public key, 64 hex> (the Edge tab gives it: "Give an AI agent these two")');
  return id;
}
const CARD = () => flag('--card', 'release signer');
const deadline = () => Date.now() + Number(flag('--minutes', '30')) * 60000;

/* plan_wait until the plan ends (or runs, when asked), at most until the deadline */
async function until(tool, id, end, { running = null } = {}) {
  for (;;) {
    if (Date.now() > end) {
      await tool('plan_finish', { plan_id: id });
      die(`no end by the deadline - ${id} finished, nothing signed`);
    }
    const w = await tool('plan_wait', { plan_id: id, seconds: 60 });
    if (w.refused) die(`plan_wait: ${w.refused}`);
    if (running && w.state === 'running' && w.waiting.length) { await running(w); continue; }
    if (['done', 'ended', 'failed', 'declined'].includes(w.state)) return w;
  }
}

/* ------------------------------------------------------------------ the commands */

/*
 * SUBMITTED ONCE THE OWNER HAS ACCEPTED THIS AGENT: a new agent is shown to the owner (pending) by its first plan or
 * card; until they accept it a submit is refused - asked again each time the plan changes, or every 5 s, to the deadline
 */
async function submitted(tool, id, end) {
  for (let n = 0; ; n++) {
    const r = await tool('plan_submit', { plan_id: id });
    if (!r.refused) return;
    if (!/not accepted you yet/.test(r.refused) || Date.now() > end) die(`plan_submit: ${r.refused}`);
    if (n === 0) say('waiting for the owner to accept this agent (the Edge tab\'s Agents rows)');
    await tool('plan_wait', { plan_id: id, seconds: 5 });
  }
}

async function card() {
  const tool = await mcp(serverUrl());
  await agent(tool);
  const end = deadline();
  certOf(flag('--cert')); /* an RSA certificate, or it stops here */
  const pem = fs.readFileSync(flag('--cert'), 'utf8');
  const r = await tool('card_new', { identity: identityArg(), label: CARD(), certs: [pem], reason: 'sign ok-edge release APKs' });
  if (r.refused) die(`card_new: ${r.refused}`);
  if (r.state === 'draft') await submitted(tool, r.plan_id, end);
  say(`the card "${CARD()}" (the key of certificate ${certOf(flag('--cert')).sha256.slice(0, 16)}…) asked - approve it on your desktop, then press the key once`);
  const w = await until(tool, r.plan_id, end);
  if (w.state !== 'done') die(`the card: ${w.state}${w.why ? ` - ${w.why}` : ''}`);
  say(`the card "${CARD()}" is certified`);
}

async function sign() {
  const [apk] = positional;
  const out = flag('--out');
  if (!apk || !fs.existsSync(apk) || !out) die('sign.js <in.apk> --out <out.apk> --cert <cert.pem> --server <url|local> --identity <hex>');
  const cert = certOf(flag('--cert'));
  const tmp = tempDir();
  try {
    /* 1 */
    const digests = record(apk, flag('--cert'), tmp);
    const fp = (d) => crypto.createHash('sha256').update(Buffer.from(d, 'hex')).digest('hex');
    say(`${digests.length} signature(s) for ${path.basename(apk)} with the RSA-${cert.bits} key of certificate ${cert.sha256.slice(0, 16)}… (${cert.subject}): ${digests.map((d) => fp(d).slice(0, 16)).join(', ')}`);
    /* 2 */
    const tool = await mcp(serverUrl());
    await agent(tool);
    const end = deadline();
    const p = await tool('plan_new', {
      identity: identityArg(), title: `sign ${path.basename(apk)}`, card: CARD(),
      items: digests.map((d, i) => ({ op: 'sign', key: { kind: 'rsa', cert: cert.sha256 }, reason: `APK signature ${i + 1} of ${digests.length} (${path.basename(apk)})`, fingerprint: fp(d) })),
    });
    if (p.refused) die(`plan_new: ${p.refused}`);
    await submitted(tool, p.plan_id, end);
    say(`plan ${p.plan_id} submitted - approve it on your desktop (its fingerprints: the ones above), then press the key once`);
    const w = await until(tool, p.plan_id, end, {
      running: async () => {
        const r = await tool('plan_data', { plan_id: p.plan_id, items: digests.map((d, i) => ({ item: i + 1, data: Buffer.from(d, 'hex').toString('base64'), encoding: 'base64' })) });
        if (r.refused) die(`plan_data: ${r.refused}`);
        say('approved - the digests sent; waiting for the signatures');
      },
    });
    if (w.state !== 'done') die(`plan ${p.plan_id}: ${w.state}${w.why ? ` - ${w.why}` : ''} - nothing signed`);
    const lines = digests.map((d, i) => {
      const r = w.results[i + 1];
      if (!r || !r.signature) die(`item ${i + 1}: ${r && r.refusal ? r.refusal : 'no signature'}`);
      return `${d} ${Buffer.from(r.signature, 'base64').toString('hex')}`;
    });
    fs.writeFileSync(path.join(tmp, 'signatures.txt'), `${lines.join('\n')}\n`);
    say(`${lines.length} signature(s), receipts ${(w.receipts || []).map((x) => `#${x.seq} ${x.code}`).join(', ')}`);
    /* 3 */
    apksigner([...SIGN_ARGS(flag('--cert')), '--in', path.resolve(apk), '--out', path.resolve(out)], { OKSIGN_REPLAY: path.join(tmp, 'signatures.txt') });
    /* 4 */
    const v = signerOf(out);
    if (v.sha256 !== cert.sha256) die(`${out} is signed by ${v.sha256}, not the certificate ${cert.sha256}`);
    say(`${out}: signed (${v.schemes.join(' + ')}) by the certificate ${cert.sha256}`);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

(async () => {
  const [cmd] = positional;
  if (cmd === 'card') return card();
  if (cmd === 'record') {
    const tmp = tempDir();
    try { for (const d of record(positional[1], flag('--cert'), tmp)) console.log(d); } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
    return undefined;
  }
  /* the replay alone, from a "digest signature" file (the tests: signatures made in software) */
  if (cmd === 'replay') {
    build();
    const cert = certOf(flag('--cert'));
    apksigner([...SIGN_ARGS(flag('--cert')), '--in', path.resolve(positional[1]), '--out', path.resolve(flag('--out'))], { OKSIGN_REPLAY: path.resolve(flag('--signatures')) });
    const v = signerOf(flag('--out'));
    if (v.sha256 !== cert.sha256) die(`signed by ${v.sha256}, not the certificate ${cert.sha256}`);
    say(`${flag('--out')}: signed (${v.schemes.join(' + ')}) by the certificate ${cert.sha256}`);
    return undefined;
  }
  if (cmd === 'verify') {
    const v = signerOf(positional[1]);
    console.log(`${v.sha256} ${v.schemes.join('+')}`);
    if (flag('--cert') && v.sha256 !== certOf(flag('--cert')).sha256) die('not signed by that certificate');
    return undefined;
  }
  return sign();
})().catch((e) => die(e.stack || e.message));
