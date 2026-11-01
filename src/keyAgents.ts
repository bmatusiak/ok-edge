/*
 * THIS DEVICE'S KEY FOR A COMPUTER'S onlykey-js, THROUGH A ROOM (plan B4; Brad, 2026-11-01: "the cli + bluetooth
 * communication works again but not like it did"; "the app authorizes/approves ble over to the host using the same
 * mechanism"). The computer is an agent of this identity's room on a local mcp-server (the room joined over Bluetooth,
 * bleRoom.ts); the room passes its messages only while the owner accepts it in the Agents list (mcp-server core
 * room.js). Here they meet the lib's key session (node-onlykey-lib desktop/session.js) - the same conversation the
 * desktop's CLI has over its local socket - on the key this app has open, held for the computer as the desktop holds it
 * (keyConversation.ts); its Edge requests go to this app's Edge host as that agent (edgeAgents AGENT_FROM).
 *
 * One computer at a time (the session refuses a second "busy"). OKFWUPDATE never reaches the key from here: the
 * session passes only what the key's own protocol takes, and the firmware update is refused by the transport (lib).
 */
import {createKeySession} from 'node-onlykey-lib/desktop/session';
import {OkEmu} from './transport/OkEmu';
import {UsbPipe} from './transport/UsbPipe';
import {activeBackend} from './hooks/KeyContext';
import {AGENT_FROM, handleEdgeMessage} from './edgeAgents';
import {createKeyConversation} from './keyConversation';
import {ioPulse} from './btActivity';

/* one computer's side of the session: the same object for open, every message and close (the session knows it by it) */
type Client = {send: (obj: object) => void; gone: () => boolean; agent: string; name: string; dead: boolean};

/** Serve a joined room's agents on this device's key; -> stop. */
export function serveKeyAgents(r: any): () => void {
  const conv = createKeyConversation();
  const pipeOf = (): any => (activeBackend() === 'usb' ? UsbPipe : OkEmu);
  let current: Client | null = null;
  /* the one being opened: the session says it connected before open() resolves */
  let opening: Client | null = null;
  /* the key this app has open, as the session's pipe; its writes wait for the hand-over */
  const pipe = {
    isRunning: () => pipeOf().isRunning(),
    start: () => pipeOf().start(),
    write: (iface: number, bytes: Uint8Array) => pipeOf().write(iface, bytes),
    on: (event: string, listener: (e: any) => void) => (event === 'stream' ? pipeOf().on('stream', listener) : () => {}),
    get device() { return {product: activeBackend() === 'usb' ? 'OnlyKey (on the phone)' : 'OnlyKey soft key (on the phone)'}; },
    interfaces: () => [],
    beforeWrite: () => conv.beforeWrite(),
  };
  const session = createKeySession({
    pipe,
    dev: 'android',
    holder: 'the phone',
    hostFor: () => ({
      send: (message: unknown) => {
        const c = current;
        return conv.answer(() => handleEdgeMessage(message, `${AGENT_FROM}${c ? `${c.agent}|${c.name}` : 'unknown'}`));
      },
    }),
    log: (l: string) => console.log(`[key-agent] ${l}`),
    onClient: (connected: boolean) => {
      conv.setConnected(connected);
      console.log(`[key-agent] ${connected ? `${(current ?? opening)?.name ?? 'a computer'} talks to this key` : 'the computer let the key go'}`);
    },
  });
  const clients = new Map<string, Client>();
  const offKey = r.on('key', ({from, name, m}: {from: string; name: string; m: any}) => {
    ioPulse('mcp');
    let c = clients.get(from);
    if (!c) {
      const cl: Client = {agent: from, name: name || `agent ${from.slice(0, 8)}`, dead: false, gone: () => cl.dead, send: (obj: object) => r.keyReply(from, obj)};
      c = cl;
      clients.set(from, c);
    }
    if (m && m.t === 'hello') {
      const cl = c;
      opening = cl;
      void session.open(cl).then((ok: boolean) => { if (ok) current = cl; }).finally(() => { if (opening === cl) opening = null; });
    } else void session.message(c, m);
  });
  const offGone = r.on('key-gone', ({from}: {from: string}) => {
    const c = clients.get(from);
    if (!c) return;
    c.dead = true;
    clients.delete(from);
    session.close(c);
    if (current === c) current = null;
  });
  return () => {
    if (typeof offKey === 'function') offKey();
    if (typeof offGone === 'function') offGone();
    session.stop();
    conv.stop(' (the room closed)');
  };
}
