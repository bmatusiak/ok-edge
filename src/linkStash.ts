/**
 * The soft key's Edge links, kept the moment the key writes them.
 *
 * WHY (Brad, 2026-10-29, the Pixel's live chain: "This phone's copy of the chain does not match the key", #157-#160
 * missing). The key holds only its 8 newest links; the copy took them on a sync round that waited for the key to go
 * quiet - and a login's own requests kept it busy, so an app swiped away seconds after a login (the swipe ends the
 * process) never copied that login's links. Two such runs in a row pushed them out of the key's ring before any run
 * read them, and they were gone.
 *
 * HOW. The soft key's Edge plugin says "edge_link" with the link itself (its seq, the link, the head after it, the
 * reveal - one PICKUP answer), so the link is stored here as it is written: no key request, nothing to wait for.
 * SoftKeyEdge.read takes the links the key no longer holds from here, and only after they weld onto the oldest link
 * the key still has - a stash from another chain (a wiped or restored key) is never offered as this one's.
 *
 * Per net (edgeKey): the live and the testnet soft key keep separate chains. A seq at or below the newest kept starts
 * the stash again (the key's chain started again). The newest KEEP links stay.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import NativeOkEmu from 'okedge-native/specs/NativeOkEmu';
import {fromHex, toHex} from 'node-onlykey-lib/bytes';
import {edgeKey} from './net';
import type {EdgeLinkRecord} from './edgeFake';

const KEEP = 256;
const LINK_BYTES = 64;
const STORE = (): string => edgeKey('linkStash');

/* seq -> [link, head, reveal|null], as hex */
type Kept = Record<string, [string, string, string | null]>;

let queue: Promise<unknown> = Promise.resolve();
/* one read-modify-write at a time: two links written back to back must both land */
const serial = <T>(f: () => Promise<T>): Promise<T> => {
  const p = queue.then(f, f);
  queue = p.catch(() => {});
  return p;
};

async function load(key: string): Promise<Kept> {
  try {
    return JSON.parse((await AsyncStorage.getItem(key)) ?? '{}') as Kept;
  } catch {
    return {};
  }
}

/** Keep one link from the event's bytes: seq u32 LE, the link, the head after it, the reveal (zeros: none). */
export function keepLinkEvent(hex: string): Promise<void> {
  const b = fromHex(hex);
  if (b.length < 4 + LINK_BYTES + 64) return Promise.resolve(); /* an older firmware's event: the seq alone */
  const seq = b[0] | (b[1] << 8) | (b[2] << 16) | (b[3] << 24);
  const link = toHex(b.slice(4, 4 + LINK_BYTES));
  const head = toHex(b.slice(4 + LINK_BYTES, 4 + LINK_BYTES + 32));
  const r = b.slice(4 + LINK_BYTES + 32, 4 + LINK_BYTES + 64);
  const reveal = r.some(x => x) ? toHex(r) : null;
  const key = STORE();
  return serial(async () => {
    let kept = await load(key);
    const seqs = Object.keys(kept).map(Number);
    if (seqs.length && seq <= Math.max(...seqs)) kept = {}; /* the chain started again */
    kept[seq] = [link, head, reveal];
    const all = Object.keys(kept).map(Number).sort((x, y) => x - y);
    for (const s of all.slice(0, Math.max(0, all.length - KEEP))) delete kept[s];
    await AsyncStorage.setItem(key, JSON.stringify(kept));
  });
}

/** The kept run that ends at `to` and goes back no further than `from` (contiguous; empty if `to` is not kept). */
export async function keptRun(from: number, to: number): Promise<{seq: number; record: EdgeLinkRecord}[]> {
  const kept = await serial(() => load(STORE()));
  const out: {seq: number; record: EdgeLinkRecord}[] = [];
  for (let s = to; s >= from && kept[s]; s--) {
    const [link, head, reveal] = kept[s];
    out.unshift({seq: s, record: {link: fromHex(link), head: fromHex(head), reveal: reveal ? fromHex(reveal) : null}});
  }
  return out;
}

let listening = false;
/** Listen for the soft key's links for the life of the app (idempotent; no native side: nothing to keep). */
export function startLinkStash(): void {
  if (listening) return;
  listening = true;
  try {
    NativeOkEmu.onPluginEvent(ev => {
      if (ev.name === 'edge_link') void keepLinkEvent(ev.hex).catch(e => console.log(`[edge] link stash: ${String(e)}`));
    });
  } catch {
    /* jest, the web app: no soft key */
  }
}
