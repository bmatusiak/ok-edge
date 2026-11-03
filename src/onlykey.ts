/**
 * The OnlyKey library, composed for this app.
 *
 * Every piece of protocol knowledge the app used to carry inline now lives in
 * `node-onlykey-lib`. This file is the whole of the wiring: it hands the
 * library a byte pipe and gets back a device.
 *
 * ONE APP, NOT ONE PER MOUNT. The Rectify app is built lazily and kept, for the
 * same reason `OkEmu` is a singleton - the firmware is a process-wide thing.
 * Building one per component mount would tear down the session key on every
 * re-render, and the device would be asked to redo OKCONNECT for a React
 * lifecycle event it knows nothing about.
 */
import Rectify from '@bmatusiak/rectify';
import AsyncStorage from '@react-native-async-storage/async-storage';
import hostPlugin from 'node-onlykey-lib/plugins/host';
import embeddedTransport from 'node-onlykey-lib/plugins/transport/embedded';
import usbTransport from 'node-onlykey-lib/plugins/transport/usb';
import tunnelTransport from 'node-onlykey-lib/plugins/transport/tunnel';
import sessionPlugin from 'node-onlykey-lib/plugins/session';
import devicePlugin from 'node-onlykey-lib/plugins/device';
import okcryptoPlugin from 'node-onlykey-lib/plugins/okcrypto';
import edgePlugin from 'node-onlykey-lib/plugins/edge';
import identityPlugin from 'node-onlykey-lib/plugins/identity';
import {createWebAuthnCtap} from 'node-onlykey-lib/transport/webauthn';
import {createVendorBridgeCtap} from 'node-onlykey-lib/transport/vendor-bridge';

import OkEmu, {type Iface} from './transport/OkEmu';
import UsbPipe from './transport/UsbPipe';
import {KEY_OVER_WEBAUTHN, shell} from './platform';
import {keyGone, noteEdgeRequest, noteSettle, noteTunnel} from './keyBusy';
import {sayPress, type PressSaid} from './requestLog';

/**
 * The pipe contract, as `plugins/transport/embedded` defines it.
 *
 * OkEmu already has every method; this only names the subset the library
 * relies on, so a change to either side is a type error here rather than a
 * runtime surprise on the phone.
 */
type BytePipe = {
  start(): Promise<unknown>;
  stop(): Promise<void>;
  isRunning(): boolean;
  write(iface: Iface, bytes: Uint8Array): Promise<number>;
  on(event: 'stream', listener: (e: {iface: number; dir: number; bytes: Uint8Array}) => void): () => void;
};

/**
 * Which key this app is talking to.
 *
 * TWO DEVICES, NEVER MERGED. The soft key and a real key answer the same
 * protocol, so everything above the pipe is the same code - but they are
 * different devices holding different secrets, and no screen should ever
 * blend readings from both.
 */
export type Backend = 'embedded' | 'usb';

export type OnlyKeyApp = {
  device: any;
  okcrypto: any;
  /*
   * OnlyKey Edge's device calls. Composed always, used only when the soft key
   * was built with the edge firmware plugin (buildInfo.hasSoftKeyPlugin) -
   * it sends nothing until called.
   */
  edge: any;
  /*
   * WHO THIS KEY IS, read once and held, and PROVEN (lib plugins/identity): the bucket identity, the key's site, each
   * feature's part - every screen and feature asks it instead of the key. The plugin also has requireVerified() (held,
   * or it throws until a proof has passed), but nothing in the app calls it yet: Key Chain writes and room joins do not
   * ask it today. Wiring it in front of them is plan C1 (2026-11-01 review).
   */
  identity: any;
  transport: any;
  destroy: () => Promise<void>;
};

/**
 * One app per backend, cached by backend.
 *
 * Both can exist at once - the soft key keeps running while a real one is
 * attached - and they must not share anything. What they must NOT share in
 * particular is the store; see `storeFor`.
 */
const booting = new Map<Backend, Promise<OnlyKeyApp>>();

/**
 * The key-value store, NAMESPACED PER BACKEND.
 *
 * The vault writes its records and its index under a fixed global prefix with
 * no device in it. Two backends alive at once would share one index, and the
 * result is quietly wrong rather than broken: every record stays sealed to the
 * device that made it, so nothing leaks - but a real key would ENUMERATE
 * credentials belonging to the soft key and be unable to open any of them. The
 * failure surfaces as an authentication tag mismatch, which reads as "wrong
 * service name".
 *
 * The soft key keeps TODAY'S KEYS, unprefixed, so nothing already stored on a
 * phone moves or disappears. Only the new backend gets a prefix.
 */
function storeFor(backend: Backend) {
  if (backend === 'embedded') {
    /*
     * AsyncStorage has exactly the three methods the store contract asks for,
     * so it goes in unwrapped. Only SEALED blobs are written through it: the
     * key that opens them is derived from the device and stored nowhere, so a
     * phone backup carrying this data reveals which services have credentials
     * and none of their contents.
     */
    return AsyncStorage;
  }

  const prefix = `${backend}:`;
  return {
    getItem: (key: string) => AsyncStorage.getItem(prefix + key),
    setItem: (key: string, value: string) => AsyncStorage.setItem(prefix + key, value),
    removeItem: (key: string) => AsyncStorage.removeItem(prefix + key),
  };
}
/**
 * Build the app, or return the one already built.
 *
 * The promise itself is cached rather than the result, so two callers racing
 * at startup - the screen mounting while the auto-start effect runs - share one
 * app instead of building two against the same firmware.
 */
/**
 * The key's identity forgotten (a lock, another key - src/bucketStore.ts closeBucket): on every key this process has
 * booted, so the next read asks the key again and no key is taken for the one before it (lib plugins/identity forget).
 */
export function forgetIdentities(): void {
  for (const app of booting.values()) void app.then((a) => a.identity?.forget?.()).catch(() => undefined);
}

/*
 * THE KEY'S IDENTITY WAS FORGOTTEN (lib plugins/identity 'forgotten'), with why and on which backend: the login follows
 * it (MainApp - a key unplugged goes back through Log in; Brad, 2026-10-31: "identity plugin is suppose to control this
 * state, if i unplug, it suppose to clear the identity").
 */
type Forgotten = {backend: Backend; why: string | null};
const forgottenListeners = new Set<(e: Forgotten) => void>();
export function onIdentityForgotten(listener: (e: Forgotten) => void): () => void {
  forgottenListeners.add(listener);
  return () => { forgottenListeners.delete(listener); };
}

export function getOnlyKey(backend: Backend = 'embedded'): Promise<OnlyKeyApp> {
  const existing = booting.get(backend);
  if (existing) {
    return existing;
  }

  const pending = new Promise<OnlyKeyApp>((resolve, reject) => {
    /*
     * Rectify carries settings on the plugin ARRAY, as `plugins.config`, keyed
     * by the service name each plugin provides. An array with a property is
     * unusual enough that the type has to say so explicitly.
     */
    /* the desktop's vendor-bridge ctap: its transport is the lib's own, known once the app has started (bound below) */
    const late: {ctap?: ReturnType<typeof createVendorBridgeCtap>} = {};
    const vendorCtap = {vendorBridge: true, getAssertion: (p: any, o?: any) => late.ctap!.getAssertion(p, o)};
    const plugins: any[] & {config?: Record<string, unknown>} = [
      hostPlugin,
      /* the webapp has no USB: its key is the WebAuthn tunnel (a transport with no vendor interface, lib plugins/transport/tunnel) */
      backend === 'usb' ? (KEY_OVER_WEBAUTHN ? tunnelTransport : usbTransport) : embeddedTransport,
      sessionPlugin,
      devicePlugin,
      okcryptoPlugin,
      edgePlugin,
      identityPlugin,
    ];

    /*
     * The transport is given OkEmu as its pipe, and the host is given
     * AsyncStorage. This is the only place the library learns anything
     * platform-specific: it never imports react-native, so it stays loadable
     * in Node for tests and in a browser for the web app.
     *
     * AsyncStorage already has exactly the three methods the store contract
     * asks for - getItem, setItem, removeItem - so it goes in unwrapped. Only
     * SEALED blobs are written through it: the key that opens them is derived
     * from the device and is stored nowhere, so a phone's backup carrying this
     * data reveals which services have credentials and none of their contents.
     */
    plugins.config = {
      transport: {
        pipe: (backend === 'usb' ? UsbPipe : OkEmu) as unknown as BytePipe,
      },
      host: {store: storeFor(backend)},
      /*
       * THE HARD KEY'S CTAP ON WINDOWS GOES THROUGH WINDOWS' WEBAUTHN (Brad, 2026-10-24: the Passwords
       * tab did not work in the desktop app on Windows). An app cannot open the key's FIDO interface
       * there - Windows keeps it - so okcrypto's tunnel (every derive, the vault) is carried by
       * navigator.credentials instead, as in the web app (lib transport/webauthn). The page is served
       * as https://apps.crp.to (electron/main.js), the origin the tunnel asserts. Linux opens the FIDO
       * interface itself and keeps the CTAPHID path.
       */
      /*
       * the webapp: every key operation goes through the browser's WebAuthn, for the page's own site. BOTH places
       * the lib keeps an rpId name it - the ctap's and okcrypto's tunnel (rpIds, default apps.crp.to): on any other
       * site (ok-edge.bmatusiak.workers.dev) a ctap naming the page and a tunnel naming apps.crp.to disagree, and the
       * lib refuses the mismatch (RPID_MISMATCH) before the browser is asked anything - no prompt, nothing at the key.
       */
      /* (a key with emulator patch 0016 - our v3.1.01 on - is asked without the 5.5 s waits: the lib reads it from the version) */
      ...(backend === 'usb' && KEY_OVER_WEBAUTHN
        ? {okcrypto: {ctap: createWebAuthnCtap({credentials: navigator.credentials, rpId: location.hostname}), rpIds: [location.hostname]}}
        : {}),
      /*
       * THE DESKTOP TALKS VENDOR ONLY (Brad, 2026-10-31: "i need to use vendor api instead of ctap for desktop, so i need
       * to bridge the vendor api to use ctap"): the tunnel's requests - the derives, the transit key, the derived-key
       * signs - go over the vendor interface through the firmware plugin vendor_bridge (lib transport/vendor-bridge), on
       * Windows and Linux alike: the key's own answers, no Windows WebAuthn, no CTAPHID. Its rpId is the KEY's -
       * ctap_bridge's configurable site; rpIds names the page's host, the key's site the derives were bound to.
       */
      ...(backend === 'usb' && shell === 'desktop'
        ? {okcrypto: {ctap: vendorCtap, rpIds: [location.hostname]}}
        : {}),
    };

    const app = Rectify.build(plugins, (err: Error | null, started: any) => {
      if (err) {
        // Let a later caller retry rather than caching a failure.
        booting.delete(backend);
        reject(err);
        return;
      }
      late.ctap = createVendorBridgeCtap(started.services.transport);
      /* each WebAuthn operation's progress, for the sheet that says to wait for the key (src/keyBusy.ts) */
      /* only the web app's requests are browser windows; every other host asks its key itself (the sheet's words) */
      started.services.okcrypto?.on?.('tunnel', KEY_OVER_WEBAUTHN ? noteTunnel : (e: any) => noteTunnel({...e, via: 'direct'}));
      /* and each Edge request that goes straight to the key (the phone's soft key, a USB key): the same sheet */
      if (started.services.edge) started.services.edge.onRequest = noteEdgeRequest;
      /* and every press the lib asks, in the log - beside the sheets, not through them (src/requestLog.ts) */
      started.services.okcrypto?.on?.('press', (e: PressSaid) => sayPress(e));
      if (started.services.edge) started.services.edge.onPress = (e: {phase: 'asked' | 'done'; sub: number; ok?: boolean}) => sayPress({phase: e.phase, msg: 0xf8, slot: e.sub, ok: e.ok});
      /* and the lib's waits between them, for the timeline (debug builds) */
      started.services.okcrypto?.on?.('settle', noteSettle);
      started.services.identity?.on?.('forgotten', (why: string | null) => {
        for (const l of [...forgottenListeners]) { try { l({backend, why}); } catch { /* a listener's error is not the key's */ } }
      });
      resolve({
        device: started.services.device,
        okcrypto: started.services.okcrypto,
        edge: started.services.edge,
        identity: started.services.identity,
        transport: started.services.transport,
        /* a request waiting on the vendor bridge ends now, not at its timeout: the key it waits on is gone */
        destroy: () => { late.ctap?.cancel(); return started.destroy(); },
      });
    });

    app.start();
  });

  booting.set(backend, pending);
  return pending;
}

/**
 * Tear an app down and allow a fresh one. Used by tests, not by the UI.
 *
 * With no argument it tears down BOTH, which is what a test teardown wants -
 * leaving one alive would hand the next test a device it did not ask for.
 */
export async function resetOnlyKey(backend?: Backend, why?: string): Promise<void> {
  const targets: Backend[] = backend ? [backend] : ['embedded', 'usb'];
  /* the busy sheet was about this key (a hard key stops the soft key): it closes with it */
  keyGone();

  for (const target of targets) {
    const pending = booting.get(target);
    booting.delete(target);
    if (!pending) {
      continue;
    }
    try {
      const app = await pending;
      /* the key's identity goes first, told why - what follows it (the login) hears that this key is gone */
      app.identity?.forget?.(why);
      await app.destroy();
    } catch {
      /* a build that never succeeded has nothing to tear down */
    }
  }
}
