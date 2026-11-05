/**
 * THE APPROVAL SHEET for an agent's budget request (APP.md, step
 * 2). Over whatever tab is open: an agent asks while the person is elsewhere.
 *
 * It shows what the person approves - the reason TEXT, the identity NAMES, the
 * caps, the lifetime and who asks - never a hash. Then the key waits for the
 * press; no press, no budget. The answer the agent gets is shown last.
 *
 * The state lives in src/edgeAgents.ts; this only draws it.
 */
import React, {useEffect, useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {answerSheet, closeSheet, onSheet, pressFromSheet, type SheetAsk, type SheetState} from '../edgeAgents';
import type {CardAsk} from '../agentIdentities';
import {Btn} from './components';
import {Locate} from './PressSheet';
import {Sheet} from './Sheet';
import {PressIcon} from './PressIcon';
import {useTapWanted} from './tapWanted';
import {usePressSince} from './SheetCountdown';
import {theme} from './theme';
import {consentRefusal} from '../debugGuard';
import {BudgetCard} from '../screens/EdgeScreen';
import {SoftKeyEdge} from '../edgeSoftKey';
import {chainState, type EdgeView} from '../edgeStore';
import type {EdgeBudget} from '../edge/types';
import {budgetStatus} from '../budgetStatus';
import {openBudget} from '../edgeNav';
import {currentNet} from '../net';
import {identity as identityLib, pressAsk as pressAskLib} from 'node-onlykey-lib/edge';
import {DEVICE_WORD} from '../platform';
import {usePressSound} from './pressSound';
import {activeBackend} from '../hooks/KeyContext';

/* what each typed refusal means, in the person's words (the agent gets the code) */
const REFUSAL_TEXT: Record<string, string> = {
  declined: 'You declined. The agent was told "declined".',
  timeout: 'Nobody answered in time. The agent was told "timeout". Until you close this, new requests are refused without asking - nobody is here to answer them.',
  copy_unverified: `This ${DEVICE_WORD}'s copy of the chain does not verify, so nothing was sent to the key. The agent was told "copy_unverified".`,
  receipt_owed: 'A receipt is owed for an earlier use. The agent was told "receipt_owed".',
  invalid: 'The request could not be a budget. The agent was told "invalid".',
  busy: `Another request was on this ${DEVICE_WORD}. The agent was told "busy" and may ask again.`,
};

/* the agent identity (SPEC H7): a computer sets it, nothing reaches the key */
const IDENTITY_REFUSAL_TEXT: Record<string, string> = {
  declined: 'You declined. The computer was told "declined"; nothing was kept.',
  timeout: 'Nobody answered in time; nothing was kept. Until you close this, new requests are refused without asking - nobody is here to answer them.',
};

const refusalText = (refusal: string, kind: string) =>
  (kind === 'identity' ? IDENTITY_REFUSAL_TEXT[refusal] : undefined) ?? REFUSAL_TEXT[refusal] ?? `Refused: ${refusal}`;

/* each ask's words for the drive (useTapWanted, Locate) - one place, by kind; the rehearsals match on them */
function askWords(a: SheetAsk): {tap: string; approve: string; press: string} {
  if (a.kind === 'identity') return {tap: 'agent identity', approve: 'agent identity - approve', press: 'agent identity press'};
  if (a.kind === 'card') return {tap: `agent card "${a.card.label}"`, approve: `agent card "${a.card.label}" - approve`, press: `agent card press "${a.card.label}"`};
  if (a.kind === 'press') return {tap: `press ask "${a.what}"`, approve: `press ask "${a.what}" - approve`, press: `press "${a.what}"`};
  return {tap: `budget ask "${a.view?.reason}"`, approve: `budget ask "${a.view?.reason}" - approve`, press: `budget press "${a.view?.reason}"`};
}

/* a new agent card as the sheet shows it: its label, the keys its budgets may use, its certificate (lib agents.answer) */
function CardRows({card}: {card: CardAsk}) {
  const day = (s: number) => new Date(s * 1000).toISOString().slice(0, 10);
  const rows: [string, string][] = [['label', card.label]];
  if (card.derive.ssh) rows.push(['ssh', card.derive.ssh]);
  if (card.derive.gpg !== undefined) rows.push(['gpg', card.derive.gpg]);
  /* stored keys on the key itself (2026-11-04: the release signer's RSA3), and the MCP agent the card is bound to */
  /* named by an agent's certificate (mcpPlans runCard): each certificate and the slot it found - the agent never learns the slot */
  if (card.keys?.length) card.keys.forEach((k, i) => rows.push([card.keys!.length > 1 ? `key ${i + 1}` : 'key', k]));
  else if (card.slots?.length) rows.push(['stored keys', card.slots.map(s => (s <= 4 ? `RSA${s}` : `ECC${s - 100}`)).join(', ')]);
  if (card.agent) rows.push(['for agent', card.agent.slice(0, 16)]);
  if (card.committer) rows.push(['committer', `${card.committer.name} <${card.committer.email}>`]);
  if (card.fingerprint) rows.push(['certificate', identityLib.spacedFingerprint(card.fingerprint)]);
  rows.push(['made', day(card.created)], ['expires', card.expires ? day(card.created + card.expires) : 'never']);
  return (
    <View style={styles.reason}>
      {rows.map(([k, v]) => <Text key={k} style={styles.op}>{`${k}  ${v}`}</Text>)}
    </View>
  );
}

/* the same rows the CLI prints and Edge Management shows (node-onlykey-lib/edge identity.rows) */
function IdentityRows({record}: {record: any}) {
  return (
    <View style={styles.reason}>
      {identityLib.rows(record).map(([k, v]: [string, string]) => (
        <Text key={k} style={styles.op}>{`${k}  ${v}`}</Text>
      ))}
    </View>
  );
}

const opName = (op: string) => (op === 'sign' ? 'Sign' : op === 'decrypt' ? 'Decrypt' : op);

const clock = (ms: number) => {
  const t = new Date(ms);
  return `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`;
};

/* from when the request arrived - not from each redraw, or the end time creeps */
function until(minutes: number, from: number): string {
  const t = new Date(from + minutes * 60000);
  const hh = String(t.getHours()).padStart(2, '0');
  const mm = String(t.getMinutes()).padStart(2, '0');
  const span = minutes < 60 ? `${minutes} min` : minutes % 60 ? `${Math.floor(minutes / 60)} h ${minutes % 60} min` : `${minutes / 60} h`;
  return `${span} (until ${hh}:${mm})`;
}

/*
 * THE COUNTDOWN to whatever runs out next (Brad, 2026-10-03: "a countdown to
 * things that expire"): the two minutes to say Yes, then the key's 25 s press
 * window. Seconds left, redrawn each second; null when nothing is running.
 * Red when the loud sound starts (PressAlert): the question's second minute, the
 * press after its first 10 s - the colour and the sound say the same thing.
 */
export function useSecondsLeft(until: number | null): number | null {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!until) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [until]);
  return until ? Math.max(0, Math.ceil((until - now) / 1000)) : null;
}
export const mmss = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

/*
 * AFTER APPROVE (Brad, 2026-10-07): the new budget's progress card - the Edge tab's
 * own BudgetCard, live: it refreshes on every check of the chain, so its uses and
 * receipts move while the sheet is open - instead of a Close button. Tapped, it
 * opens the budget's details on the Edge tab; Back closes the sheet as before.
 */
function ApprovedBudget({grantId}: {grantId: number}) {
  const [card, setCard] = useState<{b: EdgeBudget; live: boolean; view: EdgeView | null} | null>(null);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      const source = await SoftKeyEdge.open();
      if (!source || !alive) return;
      const live = await source.budgets(true).catch(() => [] as EdgeBudget[]);
      const now = live.find(x => x.grantId === grantId);
      /* the head last read, not a new read: this redraws on every check (2026-11-03: one head read per sync, for a card) */
      const b = now ?? (await source.pastBudgets(true).catch(() => [] as EdgeBudget[])).find(x => x.grantId === grantId);
      if (alive && b) setCard({b, live: !!now, view: chainState.current(source.deviceId)?.view ?? null});
    };
    void load();
    const off = chainState.on('checked', () => void load());
    return () => { alive = false; off(); };
  }, [grantId]);
  if (!card) return <Text style={styles.dim}>{`Budget ${grantId}`}</Text>;
  return (
    <BudgetCard
      b={card.b}
      busy={false}
      heading={`Budget ${grantId}`}
      status={budgetStatus(card.b, card.live, card.view)}
      onOpen={() => { closeSheet(); openBudget(grantId); }}
    />
  );
}

export function EdgeRequestSheet() {
  /* the system bars (the A13's 3-button bar once covered this sheet's Close) are the Sheet's job */
  const [s, setS] = useState<SheetState | null>(null);
  /* no second confirm since 2026-10-08: no "yours" mark - the identities asked for are on the sheet (Brad) */
  useEffect(() => onSheet(next => { setS(next); }), []);
  const left = useSecondsLeft(s && (s.phase === 'ask' || s.phase === 'press') ? s.until : null);
  /* the press phase: from when it began to the request's deadline, along the bottom */
  const pressSince = usePressSince(s?.phase === 'press');
  const askSince = usePressSince(s?.phase === 'ask');
  /*
   * NO DOUBLE TAPS (Brad, 2026-10-04: a tap on Approve took a moment to register, the
   * timer ticked, a second tap landed on the next step by accident). The buttons start
   * disabled and wake 1 s after each step appears (the ask, the second confirm, the
   * press); a tap disables them all until the phone has moved to the next step.
   */
  /*
   * READY BELONGS TO ONE STEP (box desktop, 2026-11-01: a new sheet's first render still had the last step's ready - its
   * Approve looked live and "[tap] wanted" was said, the drive tapped, then the reset after that render turned the button
   * off and the tap was dropped): the step that became ready is remembered, and a new step is not ready from its first
   * render until its own second has passed.
   */
  const step = s ? s.phase : null;
  const stepAsk = s ? s.ask : null;
  const [readyFor, setReadyFor] = useState<{phase: string | null; ask: unknown} | null>(null);
  const [acting, setActing] = useState(false);
  useEffect(() => {
    setActing(false);
    const t = setTimeout(() => setReadyFor({phase: step, ask: stepAsk}), 1000);
    return () => clearTimeout(t);
  }, [step, stepAsk]);
  const ready = !!readyFor && readyFor.phase === step && readyFor.ask === stepAsk;
  const off = !ready || acting;
  /* the person's answer is waited for (not the key's press): the drive's signal (tapWanted) - no icon */
  const asked = s?.ask;
  useTapWanted(s?.phase === 'ask' && !off && consentRefusal() === null, asked ? askWords(asked).tap : '', asked?.blocked ? ['Decline'] : ['Approve', 'Decline']);
  const act = (fn: () => void) => () => {
    if (off) return;
    setActing(true);
    fn();
  };
  /*
   * The desktop's and the browser's sound (the phone's is native): the question rings until it is answered, and the
   * press after it until it is pressed - a hard key's too, which has no confirm state to ring by.
   */
  const waiting = s && (s.phase === 'ask' || s.phase === 'press') && !acting ? s.until : null;
  usePressSound(waiting, s?.phase === 'ask' ? 'ask' : 'press');
  if (!s) return null;
  const a = s.ask;
  /* the budget is open: its card says the rest (Brad, 2026-10-07: "remove the old stuff at the top that is in the card") */
  const opened = s.phase === 'done' && s.result.ok && s.result.grantId !== undefined;
  /*
   * Spec rule 10, the app's lock: the ONE shared check (debugGuard.consentRefusal) for
   * every kind this sheet shows - a budget, a registration, a place that keeps copies.
   * Off only in testing mode (option 1, Brad 2026-10-04); a production build always
   * has it. Asked at render and again on the tap (debugging can be turned on in between).
   */
  const refusal = s.phase === 'ask' || s.phase === 'press' ? consentRefusal() : null;
  const consent = (fn: () => void) => act(() => {
    if (consentRefusal()) return;
    fn();
  });

  return (
    /* closable only when done; extraBottom: in debug builds React Native's warning toasts sit along the bottom and catch taps (2026-10-04) */
    <Sheet tone="edge" onClose={s.phase === 'done' ? closeSheet : undefined} extraBottom={48} countdown={pressSince !== null && s.phase === 'press' ? {since: pressSince, seconds: Math.max(1, Math.round((s.until - pressSince) / 1000))}
      /* the answer has a timer too, so it gets the bar (Brad, 2026-11-01: "if it has a timer it gets a timer progress bar") */
      : askSince !== null && s.phase === 'ask' ? {since: askSince, seconds: Math.max(1, Math.round((s.until - askSince) / 1000))} : null}>
            {/* the testnet (src/net.ts): a throwaway key - said before anything is approved */}
            {currentNet() === 'test' ? <Text style={[styles.title, {color: theme.io}]}>TESTNET</Text> : null}
            {a.kind === 'identity' ? (
              <>
                <Text style={[styles.title, {color: theme.warn}]}>Agent identity</Text>
                <Text style={styles.dim}>{`From ${a.computer ?? 'a computer'}: keep this as the agent's identity`}</Text>
                <IdentityRows record={a.record} />
                {a.was && !identityLib.same(a.was, a.record) ? (
                  <Text style={[styles.dim, {color: theme.warn}]}>
                    {`It replaces the one kept now (certificate ${identityLib.spacedFingerprint(a.was.cert.fingerprint)}).`}
                  </Text>
                ) : null}
                <Text style={styles.dim}>
                  {`Every agent that asks this ${DEVICE_WORD} uses it: the same ssh and gpg keys. Approving is a tap - the key already signed the certificate on the computer.`}
                </Text>
              </>
            ) : a.kind === 'card' ? (
              <>
                {/* A COMPUTER'S NEW AGENT CARD (Brad, 2026-11-03): its label and the keys its budgets may use - then one press */}
                <Text style={[styles.title, {color: theme.warn}]}>Agent card</Text>
                <Text style={styles.dim}>{`From ${a.computer ?? 'a computer'}: make this agent card - budgets under it may use these keys and no others`}</Text>
                <CardRows card={a.card} />
                <Text style={styles.dim}>{`Approve here, then press the key once: it certifies the card. The label "${a.card.label}" cannot change afterwards.`}</Text>
              </>
            ) : a.kind === 'press' ? (
              <>
                {/*
                  * A COMPUTER'S PRESS, AS A BUDGET IS SHOWN (Brad, 2026-11-03: "edge gives a prompt sheet, i press approve, and
                  * then the key press"; "i dont know what i was approving"): who asks, what for in its own words, the message
                  * the key will sign (the CLI prints the same), the code - and only after Approve does the key hear of it
                  */}
                <Text style={[styles.title, {color: theme.warn}]}>A computer asks to use the key</Text>
                <Text style={styles.dim}>{`From ${a.computer ?? 'a computer'}`}</Text>
                <View style={styles.reason}>
                  <Text style={styles.op}>{a.what}</Text>
                </View>
                {a.subject ? <Text style={styles.dim}>{`message ${pressAskLib.shortSubject(a.subject)}`}</Text> : null}
                <Text style={styles.dim}>{a.code ? `then on the key: ${a.code} (or any button, if the key asks one press)` : 'then a press on the key'}</Text>
                <Text style={styles.dim}>Approve here, then press the key - nothing reaches the key before you approve.</Text>
              </>
            ) : (
              <>
                <Text style={[styles.title, {color: theme.warn}]}>
                  {a.view.continues !== null ? `Continues budget ${a.view.continues}` : 'An agent asks for a budget'}
                </Text>
                <Text style={styles.dim}>
                  {/* who asks: the computer behind the link (Brad, 2026-10-08: no agent key - the link says who; edgeAgents computerOf) */}
                  {`From ${a.computer ?? 'a computer'}`}
                </Text>
                {/* the agent card it is under (lib approve.js checked every scope against it before this sheet) */}
                {a.view.card ? <Text style={styles.dim}>{`Under the agent card "${a.view.card}" - its keys only`}</Text> : null}
                {opened ? null : (<>
                <View style={styles.reason}>
                  <Text style={styles.op}>{a.view.reason}</Text>
                </View>
                {a.view.scopes.map((sc: any, i: number) => (
                  <View key={i} style={[styles.scope, sc.own && styles.scopeOwn]}>
                    <Text style={[styles.op, sc.own && {color: theme.error}]}>
                      {`${opName(sc.op)} · ${sc.identity ? sc.identity : `slot ${sc.slot}`}`}
                    </Text>
                    <Text style={styles.dim}>{`${sc.identity ? `slot ${sc.slot} · ` : ''}up to ${sc.cap} use${sc.cap === 1 ? '' : 's'}`}</Text>
                  </View>
                ))}
                <Text style={styles.dim}>{`${a.view.uses} use${a.view.uses === 1 ? '' : 's'} without a press · for ${until(a.view.lifetime, a.at)}`}</Text>
                {(a.view.covered || []).map((c: any, i: number) => (
                  <Text key={`c${i}`} style={[styles.dim, {color: theme.warn}]}>
                    {`${c.sameComputer ? 'This computer already has' : 'A budget already has'} ${c.usesLeft} use${c.usesLeft === 1 ? '' : 's'} left on ${c.identity || `slot ${c.slot}`}${c.endsAt ? ` until ${clock(c.endsAt)}` : ''} (budget ${c.grantId}).`}
                  </Text>
                ))}
                {a.view.continues !== null ? (
                  <Text style={styles.dim}>{`The same scopes as budget ${a.view.continues}, with new uses and a new lifetime. It opens with a press, like a new budget.`}</Text>
                ) : null}
                </>)}
              </>
            )}

            {s.phase === 'ask' && a.blocked ? (
              <Text style={[styles.dim, {color: theme.error}]}>{`Approve is off: ${a.blocked} Nothing is sent to the key.`}</Text>
            ) : null}
            {s.phase === 'ask' && left !== null ? (
              <Text style={[styles.countdown, left <= 60 && {color: theme.error}]}>{`Answer within ${mmss(left)}`}</Text>
            ) : null}
            {/* the tap registered: say so at once - the phone syncs and checks its copy before the key asks for the press (the 'lag', Brad 2026-10-04) */}
            {s.phase === 'ask' && acting ? (
              <Text style={[styles.op, {color: theme.warn}]}>Approved - getting the key ready…</Text>
            ) : null}
            {s.phase === 'ask' && refusal ? <Text style={[styles.op, {color: theme.error}]}>{refusal}</Text> : null}
            {s.phase === 'ask' && !acting ? (
              <View style={styles.row}>
                <Locate what={askWords(a).approve} live={!(off || refusal !== null || !!a.blocked)}>
                <Btn
                  large
                  title="Approve"
                  tone="primary"
                  disabled={off || refusal !== null || !!a.blocked}
                  onPress={consent(() => answerSheet('approve'))}
                />
                </Locate>
                <Btn large title="Decline" disabled={off} onPress={act(() => answerSheet('decline'))} />
              </View>
            ) : null}
            {s.phase === 'press' ? (
              <>
                {/*
                  * ONE PRESS, ONE SHEET (box ship rehearsal, 2026-11-03: a budget's press on the USB key raised two press icons -
                  * this sheet's and the key's own press sheet, which says what the press is for - and this one stayed up after
                  * the key answered): a hard key's press is asked on its press sheet (HostChallengeSheet); here only the soft
                  * key's, whose button this sheet holds.
                  */}
                {activeBackend() === 'usb' ? null : <PressIcon />}
                <Text style={[styles.op, {color: theme.warn}]}>Press the key to confirm</Text>
                {left !== null ? (
                  <Text style={[styles.countdown, left <= 15 && {color: theme.error}]}>{`Press within ${mmss(left)}`}</Text>
                ) : null}
                {/* a hard key (the desktop's USB key) is pressed on the key itself: no button here, nothing about a soft key */}
                {activeBackend() === 'usb' ? (
                  <Text style={styles.dim}>Press the button on your OnlyKey.</Text>
                ) : (
                  <>
                    <Text style={styles.dim}>
                      This {DEVICE_WORD} is also the key, so its press proves less than a hard key's.
                    </Text>
                    {refusal ? <Text style={[styles.op, {color: theme.error}]}>{refusal}</Text> : null}
                    <View style={styles.row}>
                      <Locate what={askWords(a).press} live={!(off || refusal !== null)}>
                        <Btn large title="Press the soft key" tone="primary" disabled={off || refusal !== null} onPress={consent(() => void pressFromSheet())} />
                      </Locate>
                    </View>
                  </>
                )}
              </>
            ) : null}
            {s.phase === 'pressed' ? (
              <Text style={[styles.op, {color: theme.warn}]}>Processing...</Text>
            ) : null}
            {s.phase === 'done' ? (
              <>
                <Text style={[styles.op, {color: s.result.ok ? theme.ok : theme.error}]}>
                  {s.result.ok ? s.result.text : refusalText(s.result.refusal, a.kind)}
                </Text>
                {!s.result.ok && s.result.detail ? <Text style={styles.dim}>{s.result.detail}</Text> : null}
                {s.result.ok && s.result.grantId !== undefined ? (
                  <>
                    <ApprovedBudget grantId={s.result.grantId} />
                    {/* close it here too, the full width (Brad, 2026-10-07): the card opens the details */}
                    <Btn large wide title="▼" label="Close" onPress={closeSheet} />
                  </>
                ) : (
                  <View style={styles.row}>
                    <Btn large title="Close" onPress={closeSheet} />
                  </View>
                )}
              </>
            ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  title: {fontWeight: '600', fontSize: 17},
  op: {color: theme.text, fontSize: theme.fontSize, lineHeight: theme.lineHeight},
  dim: {color: theme.textDim, fontSize: 13, lineHeight: 19},
  reason: {backgroundColor: theme.inputBg, borderRadius: theme.radius, padding: 10},
  scope: {borderWidth: 1, borderColor: theme.border, borderRadius: theme.radius, padding: 8, gap: 2},
  scopeOwn: {borderColor: theme.error, borderWidth: 2},
  warning: {borderWidth: 2, borderColor: theme.error, borderRadius: theme.radius, padding: 10, gap: 4, backgroundColor: 'rgba(248,113,113,0.12)'},
  warningTitle: {color: theme.error, fontWeight: '700', fontSize: 16},
  warningText: {color: theme.text, fontSize: 14, lineHeight: 20},
  row: {flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10},
  countdown: {color: theme.warn, fontSize: 20, fontWeight: '700', marginTop: 6},
  code: {color: theme.warn, fontSize: 120, fontWeight: '700', textAlign: 'center', alignSelf: 'stretch', fontVariant: ['tabular-nums'], marginVertical: 4},
  codeName: {fontSize: 60},
});
