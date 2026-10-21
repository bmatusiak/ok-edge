/**
 * THE NATIVE MODULES, CHECKED AT START (stage 2, first group): each one is called once against a
 * known answer, so the screen shows that the copy from ok-rn links and works on this phone - not
 * just that the app started. One line per module; a failure shows its message instead of
 * stopping the others.
 */
import NativeRandom from 'okedge-native/specs/NativeRandom';
import NativeKdf from 'okedge-native/specs/NativeKdf';
import NativeOkSsl from 'okedge-native/specs/NativeOkSsl';
import NativeRsaGen from 'okedge-native/specs/NativeRsaGen';
import NativeSecrets from 'okedge-native/specs/NativeSecrets';
import NativeUsbHid from 'okedge-native/specs/NativeUsbHid';
import { VENDOR_ID, PRODUCT_ID } from '../transport/UsbPipe';
import OkEmu from '../transport/OkEmu';
import { buildInfo } from '../buildInfo';

const hex = (b: ArrayBuffer) => Array.from(new Uint8Array(b), (x) => x.toString(16).padStart(2, '0')).join('');
const same = (got: string, want: string) => { if (got !== want) throw new Error(`got ${got.slice(0, 16)}…`); };

const CHECKS: [string, () => Promise<string>][] = [
  ['random', async () => { same(String(NativeRandom.getRandomHex(16).length), '32'); return '16 bytes'; }],
  /* RFC 7914 section 11's PBKDF2-HMAC-SHA256 vector: "passwd", "salt", 1 round, 64 bytes (first 32 compared) */
  ['kdf', async () => {
    same((await NativeKdf.pbkdf2Sha256('706173737764', '73616c74', 1, 64)).slice(0, 64),
      '55ac046e56e3089fec1691c22544b605f94185216dde0465e68b9d57c20dacbc');
    return 'PBKDF2-SHA256';
  }],
  ['openssl', async () => `${await NativeOkSsl.version()}, rand ${(await NativeOkSsl.randStatus()) ? 'seeded' : 'NOT seeded'}`],
  ['webcrypto', async () => {
    same(hex(await globalThis.crypto.subtle.digest('SHA-256', new Uint8Array([0x61, 0x62, 0x63]))),
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    return 'SHA-256';
  }],
  ['rsa keygen', async () => {
    const t = Date.now();
    if (!(await NativeRsaGen.generatePrimes(2048, 65537))) throw new Error('no primes');
    return `2048-bit primes in ${Date.now() - t} ms`;
  }],
  /* no permission asked, nothing opened: the transport and what is on the bus */
  ['usb', async () => {
    const list = await NativeUsbHid.listDevices();
    const ok = list.filter((d) => d.vendorId === VENDOR_ID && d.productId === PRODUCT_ID).length;
    return `${NativeUsbHid.getTransport()}, ${list.length} device(s), ${ok ? `${ok} OnlyKey` : 'no OnlyKey'}`;
  }],
  /* the soft key in its TEST slot (testnet), never the live one: libokemu loads, the firmware boots,
     and its loop is running */
  ['soft key', async () => {
    if (!OkEmu.isAvailable()) throw new Error('libokemu.so did not load');
    const r = await OkEmu.start('test');
    if (!r.started) throw new Error(r.message);
    const before = await OkEmu.rounds();
    await new Promise((done) => setTimeout(done, 1500));
    const rounds = (await OkEmu.rounds()) - before;
    if (rounds <= 0) throw new Error('booted, but the firmware loop is not running');
    return `${buildInfo.firmware}, ${rounds} rounds in 1.5 s`;
  }],
  ['keystore box', async () => {
    const alias = 'okedge-selftest';
    const sealed = await NativeSecrets.boxSeal(alias, 'c0ffee');
    try { same(await NativeSecrets.boxOpen(alias, sealed), 'c0ffee'); } finally { await NativeSecrets.boxForget(alias); }
    return 'seal + open';
  }],
];

export async function selfTest(): Promise<{ status: string; checks: Record<string, string> }> {
  const checks: Record<string, string> = {};
  for (const [name, run] of CHECKS) {
    try { checks[name] = `ok: ${await run()}`; } catch (e) { checks[name] = `FAILED: ${(e as Error).message}`; }
  }
  const failed = Object.values(checks).filter((v) => v.startsWith('FAILED')).length;
  return { status: failed ? `${failed} of ${CHECKS.length} FAILED` : `all ${CHECKS.length} ok`, checks };
}
