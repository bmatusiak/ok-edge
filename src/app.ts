/**
 * THE APP AS SERVICES (Rectify 2.0, the owner's plugin system - the library and ok-rn already use
 * it). Each shell builds only the plugins it can run; a screen asks `app.services.<name>` and shows
 * what is there. A capability a shell lacks is ABSENT - the start never fails for it (guncelium's
 * web build died at start because one service threw without Electron).
 *
 * Stage 1 has no features, only the proof that the same app starts on every shell and knows what
 * it has: the shell, the library, the bucket (pure, so every shell has it), and on the desktop the
 * Electron main process behind the preload's bridge.
 */
import rectify from '@bmatusiak/rectify';
import { shell, desktop } from './platform';

type Register = (err: Error | null, provided?: Record<string, unknown>) => void;
type Setup = ((imports: Record<string, unknown>, register: Register) => void | Promise<void>) & { consumes: string[]; provides: string[] };

const plugin = (provides: string, make: () => unknown | Promise<unknown>): Setup => {
  const setup = (async (_imports: Record<string, unknown>, register: Register) => {
    register(null, { [provides]: await make() });
  }) as Setup;
  setup.consumes = [];
  setup.provides = [provides];
  return setup;
};

/* every shell */
const common: Setup[] = [
  plugin('shell', () => ({ name: shell })),
  plugin('lib', () => ({ version: require('node-onlykey-lib/package.json').version as string })),
  plugin('bucket', () => require('node-onlykey-lib/bucket')),
];

/* per shell: only what that shell can run */
const byShell: Record<typeof shell, Setup[]> = {
  android: [],
  web: [],
  electron: [plugin('desktop', async () => ({ about: await desktop!.invoke('okedge:about') }))],
};

/**
 * What the screen lists: the stage that brings each capability to each shell (the plan's stages:
 * 2 Android, 4 desktop, 5 web), so the screen tells "not built yet" from "this shell will never
 * have it". A shell missing from a row never gets that capability.
 */
export const CAPABILITIES: Record<string, Partial<Record<typeof shell, number>>> = {
  'hard key (USB)': { android: 2, electron: 4, web: 5 },
  /* node-onlykey-emulator (stage 1b): its Android build on the phone, its Node addon in Electron's
     main process; a browser reaches it only through the emulator's HID bridge, as a USB key */
  'soft key': { android: 2, electron: 4 },
  'computer link (Bluetooth service)': { android: 2 },
  'phone over Bluetooth': { electron: 4, web: 5 },
};

export type App = { services: Record<string, unknown> };

let started: Promise<App> | null = null;

/** Build and start the app once; later callers get the same app. */
export function startApp(): Promise<App> {
  if (started) return started;
  const app = rectify.build([...common, ...byShell[shell]]);
  started = app.start().then(() => app as App);
  return started;
}
