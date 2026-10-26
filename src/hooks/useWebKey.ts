import type {Net} from '../net';
import {useCallback, useEffect, useRef, useState} from 'react';
import {device as device_} from 'node-onlykey-lib';
import {errText} from '../logSafe';
import {getOnlyKey} from '../onlykey';
import type {LogLevel} from './useLog';
import type {DeviceState, KeyState} from './keySession';
import type {HardKeySession} from './useHardKey';

/*
 * THE HARD KEY IN A BROWSER - the webapp shell's adapter, in useHardKey's place and with its shape, so the web app
 * shows the desktop's own views (Brad, 2026-10-26: "the webapp uses same elements and view as desktop app").
 *
 * A page has no USB: the browser blocks the OnlyKey from WebHID, and the only way to the key is WebAuthn - the lib's
 * tunnel (plugins/transport/tunnel + okcrypto's supplied ctap, composed in src/onlykey.ts). That changes three things
 * and nothing else:
 *   - presence: a page cannot see a key until it asks; the key is taken as there, and asking says whether it is;
 *   - lock state: the tunnel connect answers only an UNLOCKED key (and only for a site the key trusts), so a refused
 *     connect reads as locked - the PIN goes in on the key itself, then the view asks again;
 *   - presses, PIN digits, restart, the debug console: nothing a page can drive - refused by name, as on a
 *     production hard key (canPress false, so no keypad is drawn for it).
 */
/*
 * NOTHING IS ASKED BEFORE LOG IN (Brad, 2026-10-26: "can we not have the key auto connect until i press log in"). Each
 * ask is the browser's security-key prompt, so a page that asked on load put that prompt over the login page before
 * anyone had chosen to use a key. The login page's Log in arms the key (armWebKey); until then connect() asks nothing
 * and the window-focus retry stays off. Armed once, it stays armed for the page's life.
 */
let armed = false;
const armListeners = new Set<() => void>();
export function armWebKey(): void {
  armed = true;
  for (const l of [...armListeners]) l();
}

export function useWebKey({log}: {log: (level: LogLevel, text: string) => void}): HardKeySession {
  const [state, setState] = useState<KeyState>('running');
  const [device, setDevice] = useState<DeviceState>('unknown');
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState('');
  const [identity, setIdentity] = useState<ReturnType<typeof device_.version.parseStatus> | null>(null);
  const [capabilities, setCapabilities] = useState<ReturnType<typeof device_.version.capabilities> | null>(null);

  const markUnlocked = useCallback(() => setDevice('unlocked'), []);

  /* nothing to open: the browser owns the only channel there is */
  const start = useCallback(async (): Promise<void> => { setState('running'); }, []);
  const stop = useCallback(async () => { setState('stopped'); setDevice('unknown'); }, []);
  const restart = useCallback(async () => { throw new Error(refused('restart itself')); }, []);

  /* one tunnel connect: answered = unlocked (with the version); refused = locked (or a site the key does not trust) */
  /*
   * ONE ASK AT A TIME: Log in arms the key and the session's own connect (useKey) follows a moment later - two asks
   * are two security-key prompts on a real key. A connect while one is out answers with that one.
   */
  const inFlight = useRef<Promise<any> | null>(null);
  const connect = useCallback(async () => {
    if (!armed) return null;
    if (inFlight.current) return inFlight.current;
    const once = connectOnce().finally(() => { inFlight.current = null; });
    inFlight.current = once;
    return once;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- connectOnce is this render's, and reads only log
  }, [log]);
  async function connectOnce() {
    setBusy(true);
    try {
      const {okcrypto} = await getOnlyKey('usb');
      const result = await (okcrypto as any).connectTunnel();
      const status = String(result?.status ?? '').trim();
      const parsed = device_.version.parseStatus(status);
      setIdentity(parsed);
      setCapabilities(device_.version.capabilities(parsed));
      setVersion(parsed?.version ?? '');
      setDevice('unlocked');
      log('info', `tunnel connect -> "${status}"`);
      console.log(`[webkey] tunnel connect ok: ${JSON.stringify(status)}`);
      return result;
    } catch (error) {
      setDevice('locked');
      log('error', `tunnel connect: ${errText(error)}`);
      console.log(`[webkey] tunnel connect refused: ${errText(error)}`);
      return null;
    } finally {
      setBusy(false);
    }
  }

  /* every press, hold, raw message and setup: refused by name (the shapes are useHardKey's) */
  const no = (what: string) => async (..._args: any[]): Promise<never> => { throw new Error(refused(what)); };
  /*
   * WHEN TO ASK: once at Log in (armWebKey), and again each time the window comes back to the front while the key is
   * not yet unlocked (the PIN went in on the key, the person returns to the page). A desktop's hard key is asked when
   * its status broadcast arrives over USB; a page gets no broadcast, and each ask is the browser's security-key prompt,
   * so it is never asked on a timer - nor before Log in.
   */
  const deviceRef = useRef(device);
  deviceRef.current = device;
  const asking = useRef(false);
  useEffect(() => {
    const ask = () => {
      if (!armed || asking.current || deviceRef.current === 'unlocked') return;
      asking.current = true;
      void connect().finally(() => { asking.current = false; });
    };
    ask();
    armListeners.add(ask);
    const onFocus = () => ask();
    const w = globalThis as unknown as {addEventListener?: (e: string, l: () => void) => void; removeEventListener?: (e: string, l: () => void) => void};
    w.addEventListener?.('focus', onFocus);
    return () => {
      armListeners.delete(ask);
      w.removeEventListener?.('focus', onFocus);
    };
  }, [connect]);

  const send = no('take a raw vendor message');
  const press = no('be pressed from software');
  const pressRun = no('be pressed from software');
  const beginHold = (..._args: any[]): any => { throw new Error(refused('be held from software')); };
  const endHold = no('be held from software');
  const holdTicks = no('be held from software');
  const provision = no('be set up from a web page');

  return {
    state,
    device,
    markUnlocked,
    version,
    identity,
    capabilities,
    settling: null as string | null,
    busy,
    storageDir: '',
    led: [] as number[],
    restart,
    start,
    /* a page's key has no testnet of its own: its net is the key's (src/net.ts) */
    ensureStarted: async (_net: Net): Promise<Net> => 'live',
    stop,
    connect,
    send,
    press,
    pressRun,
    beginHold,
    endHold,
    holdTicks,
    provision,
    pressTicks: null as {button: number; ticks: number} | null,
    canPress: false,
    model: (identity?.model === 'duo' ? 'duo' : 'classic') as 'duo' | 'classic',
  };
}

/* one sentence for everything a page cannot do with the key */
function refused(what: string): string {
  return `the key cannot ${what} from a web page - a browser reaches it only through WebAuthn; use the key's own buttons`;
}

