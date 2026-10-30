/*
 * THE WEB APP OPEN IN MORE THAN ONE TAB (Brad, 2026-10-29: "need to WARN the user with a banner about the multiple
 * chrome tab windows open"). Two tabs of this app ask one key and write one bucket (its rows, bucket/rows.web.ts.ts) and one Edge
 * copy each on their own - their requests interleave on the key, and each writes over what the other just wrote. Said in
 * a banner in every tab while another is open.
 *
 * How a tab knows: a BroadcastChannel of this site's tabs (no server, no service worker - offline too). A tab says hello
 * when it starts and when it comes to the front again, every other tab answers; a tab says bye when it closes. A tab that
 * vanished without a bye (killed) drops out at the next hello, which starts the count afresh.
 */
import {shell} from './platform';

declare const BroadcastChannel: any;
declare const document: any;
declare const window: any;

type Listener = (others: number) => void;
const listeners = new Set<Listener>();
const others = new Set<string>();
const me = Math.random().toString(36).slice(2);
const tell = () => { for (const l of listeners) l(others.size); };

if (shell === 'webapp' && typeof BroadcastChannel !== 'undefined') {
  const ch = new BroadcastChannel('okedge-tabs');
  ch.onmessage = (ev: {data: {t: string; id: string}}) => {
    const m = ev.data;
    if (!m || m.id === me) return;
    if (m.t === 'hello') { others.add(m.id); ch.postMessage({t: 'here', id: me}); }
    else if (m.t === 'here') others.add(m.id);
    else if (m.t === 'bye') others.delete(m.id);
    tell();
  };
  const hello = () => { others.clear(); tell(); ch.postMessage({t: 'hello', id: me}); };
  hello();
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') hello(); });
  if (typeof window !== 'undefined') window.addEventListener('pagehide', () => ch.postMessage({t: 'bye', id: me}));
}

/** How many other tabs of this app are open, now and on every change. */
export function onOtherTabs(l: Listener): () => void {
  listeners.add(l);
  l(others.size);
  return () => { listeners.delete(l); };
}
