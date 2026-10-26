import type {Net} from '../net';
import {useCallback, useState} from 'react';
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
  const connect = useCallback(async () => {
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
  }, [log]);

  /* every press, hold, raw message and setup: refused by name (the shapes are useHardKey's) */
  const no = (what: string) => async (..._args: any[]): Promise<never> => { throw new Error(refused(what)); };
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

