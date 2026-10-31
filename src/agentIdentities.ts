/*
 * THE AGENT IDENTITIES in the app (lib edge/src/agents.js; Brad, 2026-10-30: "a plural multi identity section, like
 * nametag, certified/signed/approved, named/labeled, so a agent can pick from a list"; "sync-able in edge ... in the edge
 * bucket"; no rename after certified; one label once; a revocation archives). The list is the identity bucket's store
 * `edge-agents` (`edge-agents-test`), checked with the owner keys READ from the key (edgeDevices.ownerKey) - every device
 * that opens the bucket shows the same list.
 *
 * THE FIRST CARD from the identity kept today (edgeIdentity.ts, the record `edge setup` made): the same labels and the
 * certificate's own created time, so the agent's derived keys - and its gpg fingerprint GitHub verifies - stay the same.
 * The old record stays where it is until the CLI ships with the card (the ship path still reads it).
 */
import {agents as agentsLib} from 'node-onlykey-lib/edge';
import {currentNet} from './net';

const STORE = (): string => agentsLib.store(currentNet());

export type AgentRow = {label: string; status: 'usable' | 'expired' | 'revoked' | 'unverified'; created: number | null; expires: number | null; kinds: string[]; entry: any};

type Listener = () => void;
const listeners = new Set<Listener>();
export function onAgentsChanged(l: Listener): () => void {
  listeners.add(l);
  return () => { listeners.delete(l); };
}
const changed = () => { for (const l of [...listeners]) { try { l(); } catch { /* a listener's own problem */ } } };

async function entries(): Promise<Record<string, string> | null> {
  return require('./bucketStore').storeEntries(STORE());
}

/** The list, checked: null with no bucket open or no owner keys from the key (it shows nothing then, not a guess). */
export async function loadAgents(): Promise<AgentRow[] | null> {
  const e = await entries();
  if (!e) return null;
  const owner = await require('./edgeDevices').ownerKey();
  if (!owner) return null;
  return agentsLib.list(e, owner.ownerKey, owner.ownerKeyPq) as AgentRow[];
}

/* the key's Edge, as the login uses it */
async function edgeNow(): Promise<any> {
  const {edge} = await require('./onlykey').getOnlyKey(require('./hooks/KeyContext').activeBackend());
  if (!edge) throw new Error('this key has no Edge');
  return edge;
}

async function write(label: string, entry: object): Promise<void> {
  await require('./bucketStore').writeEntries(STORE(), {[label]: JSON.stringify(entry)});
  require('./serverRoom').bucketChanged();
  changed();
}

/**
 * Certify the identity kept today as the list's card, under `label` - a press. Refused for a label already in the list
 * (a revoked one stays taken). -> the label.
 */
export async function certifyKeptIdentity(label: string, onPress?: () => void): Promise<string> {
  const kept = await require('./edgeIdentity').loadKept();
  if (!kept) throw new Error('no agent identity is kept here to certify');
  const e = (await entries()) ?? {};
  if (agentsLib.taken(e, label)) throw new Error(`"${label}" is already an agent identity's label`);
  const info = agentsLib.infoFromRecord(kept.record, label);
  const card = await (await edgeNow()).certifyAgent(info, {onPress});
  await write(info.label, {card, certs: agentsLib.certsFromRecord(kept.record)});
  return info.label;
}

/** Revoke one, at a press: it stays listed, archived, and no agent gets it again. */
export async function revokeAgent(label: string, onPress?: () => void): Promise<void> {
  const e = (await entries()) ?? {};
  const was = e[label] ? JSON.parse(e[label]) : null;
  if (!was?.card) throw new Error(`no agent identity "${label}"`);
  const revoked = await (await edgeNow()).certifyRevoke({label, created: was.card.thing.created}, {onPress});
  await write(label, {...was, revoked});
}
