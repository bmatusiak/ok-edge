/**
 * THE PHONE'S NATIVE MODULES, ON THE DESKTOP (ok-edge stage 4). The app is ok-rn's, and it calls
 * its native modules through the specs in okedge-native/specs. On the web bundle (Electron's page)
 * metro.config.js maps each spec to the file of the same name in this folder, so the app code is
 * the phone's, unchanged.
 *
 * A desktop module is made here from what it really has on this shell:
 *   - methods it implements: in the page (WebCrypto) or in Electron's main process, through the
 *     preload's allowlisted channels (electron/preload.js, electron/main.js);
 *   - the spec's synchronous methods: an explicit answer each, never a Promise where the app
 *     expects a value;
 *   - any other method: rejects "<module>.<method>: not on the desktop" - a screen shows an
 *     error instead of hanging;
 *   - events (the spec's on<Name> emitters): with `pushed`, a subscription to the main process's
 *     push channel "<module>:<event>" (the preload's allowlist names it); without, one that never
 *     fires - the desktop has no source for them.
 */
import { desktop } from '../../platform';

type Listener = (payload: any) => void;
type Subscription = { remove: () => void };

/* the preload's push side: window.okedge.on(channel, listener) -> unsubscribe */
const bridgeOn = (globalThis as any).okedge?.on as ((channel: string, l: Listener) => () => void) | undefined;

export function invoke<T = unknown>(channel: string, ...args: unknown[]): Promise<T> {
  if (!desktop) return Promise.reject(new Error(`${channel}: no desktop bridge on this shell`));
  return desktop.invoke(channel, ...args) as Promise<T>;
}

export function desktopModule<T extends object>(name: string, impl: Partial<Record<string, unknown>>, events: string[] = [], { pushed = false } = {}): T {
  const emitters: Record<string, (l: Listener) => Subscription> = {};
  for (const e of events) {
    const channel = `${name}:${e}`;
    emitters[e] = (l: Listener) => {
      if (!pushed || !bridgeOn) return { remove() {} };
      const off = bridgeOn(channel, l);
      return { remove: off };
    };
  }
  return new Proxy({ ...impl, ...emitters }, {
    get(target: any, prop: string | symbol) {
      if (typeof prop !== 'string') return undefined;
      if (prop in target) return target[prop];
      /* not a thenable: an awaited module must not look like a Promise */
      if (prop === 'then') return undefined;
      return () => Promise.reject(new Error(`${name}.${prop}: not on the desktop`));
    },
  }) as T;
}
