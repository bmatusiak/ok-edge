/**
 * The Edge tab's state: one key source, its mirror, and the verdict.
 *
 * WHICH KEY: the soft key, when this build staged the edge firmware plugin
 * (OKEMU_PLUGINS=edge, buildInfo.hasSoftKeyPlugin) and the soft key is the
 * active key; otherwise there is no Edge here and the tab says so (the fake key
 * that stood in went 2026-10-08 - the testnet soft key is the real thing; it stays
 * only as a test fixture). One instance per app
 * session, kept outside React so switching tabs keeps it.
 */
import {useCallback, useEffect, useRef, useState} from 'react';
import {type EdgeBudget, type EdgeCopyCheck, type EdgeEnded, type EdgeInbox, type EdgeKeyState, type EdgeRequest, type EdgeSource} from '../edge/types';
import {SoftKeyEdge} from '../edgeSoftKey';
import {onKeyFree} from '../computerHold';
import {onBucketTraded} from '../bucketEvents';
import {keyTask} from '../keyBusy';
import {hasSoftKeyPlugin} from '../buildInfo';
import {useBackend} from './KeyContext';
import {blocksOf, chainState, evaluate, forgetVerifiedFor, liveView, loadMirror, lookable, offlineView, sync as syncMirror, tamper as tamperMirror, type EdgeView, type Tamper} from '../edgeStore';

/* a look's copy check: its own verdict (the key's head is not read in a look) - the shape SoftKeyEdge.check gives */
function copyCheckOf(view: EdgeView | null): EdgeCopyCheck | null {
  if (!view) return null;
  const v = view.verdict as {kind: string; seq?: number; from?: number; to?: number};
  return v.kind === 'verified' ? {ok: true} : {ok: false, reason: v.kind, seq: v.seq ?? v.from, to: v.to};
}
import NativeShare from 'okedge-native/specs/NativeShare';

type Source = EdgeSource & EdgeInbox;

let real: SoftKeyEdge | null = null;
/* the key went away: its Edge, opened on that key's session, goes with it - the next is opened afresh (src/keyGone.ts) */
export function forgetEdgeKey(): void {
  real = null;
}

export function useEdge() {
  const backend = useBackend();
  /* a hard key (its firmware has Edge or it does not - SoftKeyEdge.open probes), or a soft key with the Edge plugin; phone and desktop alike */
  const wantReal = backend === 'usb' || hasSoftKeyPlugin('edge');
  const [view, setView] = useState<EdgeView | null>(null);
  const [budgets, setBudgets] = useState<EdgeBudget[]>([]);
  const [past, setPast] = useState<EdgeBudget[]>([]);
  /* your other devices' budgets (full cards, Brad 2026-10-09) - their own list: each phone numbers its budgets from 1 */
  const [others, setOthers] = useState<EdgeBudget[]>([]);
  /* this phone's nametag, for its own cards' corner */
  const [ownName, setOwnName] = useState<string | null>(null);
  /* each of your other devices' chain views, by device id - drawn with this phone's own rows */
  const [deviceViews, setDeviceViews] = useState<Record<string, EdgeView>>({});
  const [requests, setRequests] = useState<EdgeRequest[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /* the links this computer's copy cannot reach (the warm-up's top ends before the key's ring): accepting them as lost goes on */
  const [outOfReach, setOutOfReach] = useState<{from: number; to: number} | null>(null);
  /*
   * What the key is waiting for a PHYSICAL press on: a request ('r<id>'), a
   * resume ('resume:<id>') or a settle ('settle').
   */
  const [pressFor, setPressFor] = useState<string | null>(null);
  /* debts and holds, from HEAD (keys that have them) */
  const [keyState, setKeyState] = useState<EdgeKeyState | null>(null);
  /* budgets a lock or reboot ended, with what is left (Continue) */
  const [ended, setEnded] = useState<EdgeEnded[]>([]);
  /* R27: whether a budget may be asked for from this phone's copy (Yes is off, with the reason, until it may) */
  const [copyCheck, setCopyCheck] = useState<EdgeCopyCheck | null>(null);

  /* the key to talk to; null = no Edge here (not the soft key with the Edge plugin), or it did not answer (locked?) */
  const source = useCallback(async (): Promise<Source | null> => {
    if (!wantReal) return null;
    /* the key the app is using now: another one (unplugged, picked) is opened afresh */
    if (!real || real.backend !== backend) {
      const was = real ? real.backend : 'none';
      real = await SoftKeyEdge.open();
      /* once per key normally: more often means something re-opens it (and drops what the last one held) */
      console.log(`[edge] key opened for ${backend} (was ${was}): ${real ? `edge on ${real.backend}` : 'no edge'}`);
    }
    /*
     * THE CLI'S HISTORY, ONCE A TRADE BRINGS IT (edgeSoftKey.takeShared): the key stays open across refreshes, so its
     * open alone would miss a log that came in later. A memory read of the open bucket - the key is asked only when
     * the bucket's log for it changed.
     */
    if (real) await real.takeShared().catch((e: any) => console.log(`[edge] shared records: not read - ${String(e?.message ?? e)}`));
    return real;
    /*
     * backend IS A DEPENDENCY (box, 2026-10-28): with [wantReal] alone this kept the backend of the hook's first
     * render. In the web app wantReal never changes (its firmware has the edge plugin), so a hook mounted while the
     * app was still on its default 'embedded' compared every later call against it - the opened key says 'usb' -
     * and re-opened the key on EVERY call: each head poll and each button a probe and a PUBKEY over the tunnel, and
     * the new SoftKeyEdge dropped the requests the last one held ("Agent: request a budget" showed nothing).
     */
  }, [wantReal, backend]);

  /*
   * offline: A LOOK (Brad, 2026-11-03: "the head ... verified offline"): the work and the refresh after it read only what
   * this host holds - the copy checked at its newest checkpoint, the head last seen (SoftKeyEdge.beginRun offline). The
   * copy check is the look's own verdict, not a read of the key's head. An action's run reads the key, once.
   */
  const runNow = useCallback(async (work: (s: Source) => Promise<EdgeView>, opts: {offline?: boolean} = {}) => {
    setBusy(true);
    setError(null);
    /* how long each part of an action takes, for the log (Brad, 2026-10-06: presses lag) - times only, nothing sensitive */
    const t0 = Date.now();
    const parts: string[] = [];
    let tp = t0;
    const lap = (name: string) => { const n = Date.now(); parts.push(`${name} ${n - tp}`); tp = n; };
    try {
      const s = await source();
      if (!s) {
        setView({verdict: {kind: 'locked'}, headSeq: null, lastSync: null, rows: []});
        return;
      }
      /*
       * A COPY THAT CANNOT BE BROUGHT UP TO DATE STILL SHOWS (Brad, 2026-10-31: "i did see budget history before, now i
       * dont"): the key's head out of this computer's reach (EDGE_NO_CHECKPOINT) said above the tab - and the rest, the
       * budgets and every device's history this computer holds, read as always. It used to end the whole refresh.
       */
      let cold = false;
      const offline = !!opts.offline;
      if (offline) (s as unknown as {beginRun?: (o: {offline: boolean}) => void}).beginRun?.({offline: true});
      let looked: EdgeView | null = null;
      try {
        looked = await work(s);
        setView(looked);
        setOutOfReach(null);
      } catch (e: any) {
        if (e?.code !== 'EDGE_NO_CHECKPOINT') throw e;
        cold = true;
        setError(e.message);
        /* where the copy ends (its own or the card's top - edgeStore.syncNow) to the key's head: the links no one holds */
        setOutOfReach(Number.isInteger(e.copyEnds) && Number.isInteger(e.keySeq) && e.keySeq > e.copyEnds ? {from: e.copyEnds + 1, to: e.keySeq} : null);
        console.log(`[edge] this key's copy is out of reach (${e.why}${e.copyEnds != null ? `: copy ends #${e.copyEnds}, key #${e.keySeq}, ring from #${e.ringFrom}` : ''}) - showing what this computer holds`);
      }
      const orNone = <T,>(p: Promise<T>, none: T): Promise<T> => (cold ? p.catch(() => none) : p);
      lap('work');
      /* one head read, one copy load for the rest of this refresh (SoftKeyEdge.beginRun) - none in a look */
      if (!offline) (s as unknown as {beginRun?: () => void}).beginRun?.();
      setBudgets(await orNone(s.budgets(), []));
      lap('budgets');
      /* budget history: what this phone opened that is not live now (soft key only) */
      const src = s as unknown as {pastBudgets?: () => Promise<EdgeBudget[]>};
      setPast(src.pastBudgets ? await src.pastBudgets().catch(() => []) : []);
      lap('past');
      const dv = s as unknown as {deviceBudgets?: (id: string, name: string) => Promise<EdgeBudget[]>};
      if (dv.deviceBudgets) {
        const {signedNametags, nametagOr, ownStatement} = require('../edgeDevices');
        const all: EdgeBudget[] = [];
        const views: Record<string, EdgeView> = {};
        const dview = s as unknown as {deviceView?: (id: string) => Promise<EdgeView>};
        for (const d of await signedNametags().catch(() => [])) {
          const view = dview.deviceView ? await dview.deviceView(d.deviceId).catch(() => null) : null;
          if (view) views[String(d.deviceId).toLowerCase()] = view;
          all.push(...(await dv.deviceBudgets(d.deviceId, nametagOr(d.nametag)).catch(() => [])));
        }
        setOthers(all);
        setDeviceViews(views);
        setOwnName((await ownStatement().catch(() => null))?.nametag ?? null);
      }
      setKeyState(s.state ? await orNone(s.state(), null) : null);
      setEnded(s.ended ? await orNone(s.ended(), []) : []);
      lap('state+ended');
      const pending = await orNone(s.pending(), []);
      setRequests(pending);
      lap('pending');
      /* every sync, not only with a request waiting: a copy that fails the budget rules (R3) must show on the tab, not only on the sheet (2026-10-04) */
      setCopyCheck(offline ? copyCheckOf(looked) : await s.check().catch(() => null));
      lap('check');
      const path = (s as unknown as {edge?: {grants?: {lastPath?: string | null}}}).edge?.grants?.lastPath;
      console.log(`[edge] ${offline ? 'look' : 'run'} ${Date.now() - t0} ms: ${parts.join(', ')}${path ? ` (copy check: ${path})` : ''}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      /* the panel shows the message only; where it came from goes to the log (a TypeError says nothing without its stack) */
      console.log(`[edge] refresh failed after ${parts.join(', ') || 'nothing'}: ${e instanceof Error ? e.stack : String(e)}`);
    } finally {
      const s = real;
      (s as unknown as {endRun?: () => void} | null)?.endRun?.();
      setBusy(false);
    }
  }, [source]);
  /*
   * EVERY RUN SAYS WHAT IT IS FOR (Brad, 2026-11-03: "why is it working with my key?"): the "Working with your key" sheet
   * names the task (keyBusy keyTask) - each action its own words (runFor), a refresh with no words of its own the default.
   */
  /* weak: a look asks the key nothing of its own - its reason only when nothing else uses the key (keyBusy weak) */
  const run = useCallback((work: (s: Source) => Promise<EdgeView>, opts: {offline?: boolean; why?: string; weak?: boolean} = {}) =>
    keyTask(opts.why ?? "Edge: refreshing this device's view of the key's chain", () => runNow(work, opts), {weak: !!opts.weak}), [runNow]);
  const runFor = useCallback((why: string, work: (s: Source) => Promise<EdgeView>, opts: {offline?: boolean; weak?: boolean} = {}) =>
    run(work, {...opts, why}), [run]);

  /** B1: HEAD, READ what is new, store, verify everything - after this app's own key action. */
  const sync = useCallback(() => runFor("Bringing this device's copy of the key's chain up to date", async s => (await syncMirror(s)).view), [runFor]);
  /** A look: the copy as this host holds it, checked offline (source() took any log a trade brought) - no key. */
  const lookOnce = useCallback(async () => {
    const s = await source();
    /* nothing to stand on offline yet (no checkpoint kept, this session's head unknown): one sync asks the key, once */
    if (s && !(await lookable(s.deviceId))) {
      console.log('[edge] look: this copy holds no checkpoint of the key yet - one sync reads it');
      return sync();
    }
    return runFor("Looking at this device's copy of the key's chain", k => offlineView(k as unknown as Parameters<typeof offlineView>[0]), {offline: true, weak: true});
  }, [runFor, sync, source]);
  /*
   * ONE LOOK AT A TIME, AND ONE AFTER IT (2026-11-03, the box: a look took 6-8 s over every device's chain, and each
   * computer letting the key go asked for one - a 255-use ship would have queued 255 of them): a look asked while one
   * runs is the one after it, however many are asked - what changed meanwhile is all in that one.
   */
  const looking = useRef<{again: boolean} | null>(null);
  const look = useCallback(async (): Promise<void> => {
    if (looking.current) { looking.current.again = true; return; }
    looking.current = {again: false};
    try {
      do {
        looking.current.again = false;
        await lookOnce();
      } while (looking.current.again);
    } finally {
      looking.current = null;
    }
  }, [lookOnce]);
  /* a merge or a nametag change (edgeDevices): your other devices' cards and logs are read again at once - no pull needed */
  useEffect(() => {
    if (!wantReal) return undefined;
    const {onDevicesChanged} = require('../edgeDevices');
    return onDevicesChanged(() => { void look(); });
  }, [look, wantReal]);
  /* a trade brought a log of this identity's keys (a computer's, after its ship): taken and checked offline (source) */
  useEffect(() => {
    if (!wantReal) return undefined;
    return onBucketTraded(stores => { if (stores.some(st => st.startsWith('edge-logs'))) void look(); });
  }, [look, wantReal]);
  /**
   * The Sync button: a full check from the root (Brad, 2026-10-06) - this session's
   * remembered results are dropped first. Pull-down, presses and a computer letting the key go use sync.
   */
  const fullSync = useCallback(() => runFor("Checking this device's whole copy of the key's chain (Sync)", async s => {
    forgetVerifiedFor(s.deviceId);
    (s as unknown as {edge?: {grants?: {forget?: () => void}}}).edge?.grants?.forget?.();
    return (await syncMirror(s)).view;
  }), [runFor]);
  /** Verify the stored copy against the live head WITHOUT reading - shows an edited copy as it is. */
  const verify = useCallback(() => runFor("Checking this device's copy against the key", async s => (await chainState.validity(s)).view), [runFor]);
  const tamper = useCallback(
    (how: Tamper) => runFor("Testing: changing this device's copy", async s => {
      const m = await tamperMirror(s.deviceId, how);
      return m.links.length ? liveView(s, m) : evaluate(m, null);
    }),
    [runFor],
  );
  /*
   * BLOCKS (BLOCKS.md, Brad 2026-10-07): this key's copy as canonical JSON blocks,
   * shared as a .json file - what anyone can check with SHA-256 and the key's public key.
   * -> a line for the tab: how many blocks, how many links still open, any that did not verify
   */
  const exportBlocks = useCallback(async (): Promise<string> => {
    const s = await source();
    if (!s) return 'the key did not answer';
    const r = await blocksOf(s.deviceId);
    if (!r.count) return r.reason ? 'no blocks: ' + r.reason : 'no blocks yet - a block closes when a budget ends';
    await NativeShare.shareFile('onlykey-edge-blocks-' + new Date().toISOString().slice(0, 10) + '.json', r.json, 'application/json', 'Edge blocks');
    return r.count + ' block(s), ' + r.open + ' link(s) after the last seal' + (r.bad ? ' - ' + r.bad + ' did not verify' : ', all verified');
  }, [source]);
  /** An agent asks for a budget (testing mode, on either key). */
  const request = useCallback(async (from: string, reason: string, scopes: EdgeRequest['scopes']) => {
    const s = await source();
    if (!s) { console.log('[edge] request: no Edge key to ask'); return; }
    s.request(from, reason, scopes);
    const waiting = await s.pending();
    console.log(`[edge] request from ${from}: ${waiting.length} waiting`);
    setRequests(waiting);
    setCopyCheck(await s.check());
  }, [source]);
  /*
   * RULE 8 (Brad, 2026-10-06): a Hold or Revoke the person taps is never kept
   * waiting by the tab's own background work - its buttons follow `stopping`
   * (one of these in flight), not `busy` - and it goes to the front of the
   * key's lane (SoftKeyEdge: urgent). The log says how long it took, from the tap.
   */
  const [stopping, setStopping] = useState(false);
  const stoppingRef = useRef(false);
  const stop = useCallback((what: 'hold' | 'revoke', grantId: number, act: (s: Source) => Promise<void>) => {
    if (stoppingRef.current) return Promise.resolve(); /* a second tap while one is on its way */
    stoppingRef.current = true;
    setStopping(true);
    const t = Date.now();
    console.log(`[edge] ${what} tapped (budget ${grantId})`);
    return runFor(`${what === 'hold' ? 'Holding' : 'Revoking'} budget ${grantId}`, async s => {
      await act(s);
      console.log(`[edge] ${what} on the key ${Date.now() - t} ms after the tap`);
      return (await syncMirror(s)).view;
    }).finally(() => {
      stoppingRef.current = false;
      setStopping(false);
    });
  }, [runFor]);
  const revoke = useCallback((grantId: number) => stop('revoke', grantId, async s => { await s.revoke(grantId); }), [stop]);
  /* the clasp: Yes sends the request; the key waits for the press; then it is live */
  const approve = useCallback((id: number) => runFor('Opening the budget you approved', async s => {
    try {
      await s.approve(id, () => setPressFor(`r${id}`));
    } finally {
      setPressFor(null);
    }
    return (await syncMirror(s)).view;
  }), [runFor]);
  /* R15a: hold needs no press; resume runs the copy check, then waits for one */
  const hold = useCallback((grantId: number) => stop('hold', grantId, async s => { await s.hold?.(grantId); }), [stop]);
  const resume = useCallback((grantId: number) => runFor(`Resuming budget ${grantId}`, async s => {
    try {
      await s.resume?.(grantId, () => setPressFor(`resume:${grantId}`));
    } finally {
      setPressFor(null);
    }
    return (await syncMirror(s)).view;
  }), [runFor]);
  /* R18: the person's Yes on screen first (EdgeScreen), then the press */
  const settle = useCallback(() => runFor('Settling what the key is owed', async s => {
    try {
      await s.settle?.(() => setPressFor('settle'));
    } finally {
      setPressFor(null);
    }
    return (await syncMirror(s)).view;
  }), [runFor]);
  /* Continue: a request for what is left; then Approve is the usual Yes and press */
  const continueBudget = useCallback((grantId: number) => runFor(`Continuing budget ${grantId}`, async s => {
    await s.continueBudget?.(grantId);
    return (await chainState.validity(s)).view;
  }), [runFor]);
  /* 4.7a: an ended AGENT budget only goes away - the agent continues it, not the tab */
  const dismissEnded = useCallback((grantId: number) => runFor(`Putting away ended budget ${grantId}`, async s => {
    await s.dismissEnded?.(grantId);
    return (await chainState.validity(s)).view;
  }), [runFor]);
  /* R24 / the red banner: Yes on screen, then the press; the key links LOSS {from, to} */
  const acceptLoss = useCallback((from: number, to: number) => runFor(`Accepting links #${from}-#${to} as lost`, async s => {
    try {
      await s.acceptLoss?.(from, to, () => setPressFor('loss'));
    } finally {
      setPressFor(null);
    }
    return (await syncMirror(s)).view;
  }), [runFor]);
  /* testing mode: a sign the open testing budget pays, and its receipt (SoftKeyEdge.budgetSign) */
  const budgetSign = useCallback(() => runFor("Testing: a sign paid by a budget", async s => {
    const k = s as Source & {budgetSign?: (t: string) => Promise<{grantId: number; seq: number; paid: boolean}>};
    const r = await k.budgetSign?.('sign');
    if (r) console.log(`[edge] testing sign #${r.seq}: ${r.paid ? `paid by budget ${r.grantId}` : 'NOT paid by the budget'}, receipt filed`);
    return (await syncMirror(s)).view;
  }), [runFor]);
  /* testing mode: an agent's pressed sign with no receipt (soft key only) */
  const agentSign = useCallback(() => runFor("Testing: an agent's sign", async s => {
    const k = s as Source & {agentSign?: (t: string) => Promise<void>};
    await k.agentSign?.('sign');
    return (await syncMirror(s)).view;
  }), [runFor]);
  const press = useCallback(async () => {
    const s = await source();
    await s?.press();
  }, [source]);
  const decline = useCallback((id: number) => runFor('Declining a budget request', async s => {
    await s.decline(id);
    return (await chainState.validity(s)).view;
  }), [runFor]);
  /* the tab opens: a look (B1) - the key is asked by the actions, and by the Sync button */
  useEffect(() => {
    void look();
  }, [look]);

  /*
   * THE CARD FOLLOWS THE KEY, AND THE KEY IS NEVER ASKED ON A TIMER (Brad, 2026-10-29: "re-reads the chain head every
   * few seconds makes it unusable" - on Windows every read is two ceremonies, the silent check first, and a paid sign
   * took 90-105 s queued behind them; on the box the tab was never idle). The 4 s head poll (2026-10-03, bug 2: an
   * agent spends straight on the key over Bluetooth and the card said 0 spent) is gone. The tab reads the key when it
   * opens, on pull-down, after each of its own actions (run), and once a computer lets the key go - its
   * conversation is over, so whatever it spent is on the key now.
   */
  useEffect(() => {
    if (!wantReal) return;
    return onKeyFree(() => { void look(); });
  }, [wantReal, look]);

  return {
    view, budgets, past, others, ownName, deviceViews, requests, busy, stopping, error, pressFor, copyCheck, keyState, ended, available: wantReal, fullSync,
    sync, look, verify, tamper, request, revoke, approve, press, decline,
    hold, resume, settle, agentSign, budgetSign, continueBudget, dismissEnded, acceptLoss, outOfReach, exportBlocks,
  };
}
