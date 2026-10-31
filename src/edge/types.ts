/*
 * THE EDGE TYPES the app works with - the key's chain, its copy, its budgets, its requests (SPEC.md). They lived at the top
 * of edgeFake.ts, the testing-mode fake key the Edge tab was first built against (2026-10-02); the fake was never used
 * again once the soft key had the Edge firmware plugin, and is gone (PROPOSAL-rectify-ok-edge.md, dead code). R3 moves
 * the chain's reading and checking into the lib, and these with it.
 */
/** A link as a copy keeps it: the link, the head after it, and a self-press's reveal (R27 checks it against its budget's G). */
export type EdgeLinkRecord = {link: Uint8Array; head: Uint8Array; reveal?: Uint8Array | null};

/** R27: may a budget be asked for from this copy? The first thing that fails, in words. */
export type EdgeCopyCheck = {ok: true} | {ok: false; reason: string; seq?: number; to?: number};
export type EdgeBudget = {
  /* B7 stage 2: the id of the computer it was opened for (edgeAgents computerOf) - a note shows only from it (no agent key since 2026-10-08) */
  computerId?: string;
  /* another device's budget (full cards, 2026-10-09): its nametag and device id - the card's corner */
  device?: string;
  deviceId?: string;
  grantId: number;
  reason: string;
  uses: number;
  used: number;
  scopes: {op: number; slot: number; cap: number; used: number; identity?: string}[];
  /* R3: per-scope counts come from each spend's scope byte (else shared op+slot scopes are one count) */
  exact?: boolean;
  /* a past budget (budget history): how it ended */
  endedHow?: string;
  /* the audit log: when it opened and ended (the phone's clock), its lifetime (minutes), uses that got a receipt */
  openedAt?: number;
  endedAt?: number;
  lifetime?: number;
  receiptsFiled?: number;
  /* the links it spans, like a block: its opening to its last link (in this phone's copy) */
  firstSeq?: number;
  lastSeq?: number;
  genesis: Uint8Array;
  /** R15b: when its lifetime ends (the phone's clock), if this phone approved it */
  endsAt?: number;
  /* opened for an agent (4.7a): its name, shown on the card like the ended card does */
  agent?: string;
};
/** What a key (fake now, the soft key after E3) gives the Edge tab. */
export interface EdgeSource {
  readonly deviceId: Uint8Array;
  /** The key's live head; ringFrom = the oldest seq it can still READ. */
  head(): Promise<{seq: number; head: Uint8Array; ringFrom: number}>;
  read(fromSeq: number, count: number): Promise<EdgeLinkRecord[]>;
  /* useLastHead: the head the caller just read (a sync) may be reused */
  budgets(useLastHead?: boolean): Promise<EdgeBudget[]>;
  /** Receipt messages by the seq they answer - they come by sync, never from the key. */
  messages(): Promise<Record<number, string>>;
  /** End a live budget now (a grant-end link). */
  revoke(grantId: number): void | Promise<void>;

  /*
   * The spec change and R26 (SPEC.md R15a-R18, R26). Optional: the fake key
   * predates them, and the tab shows each control only when the key has it.
   */
  /** What the key says about debts, holds and a restore, from HEAD. */
  state?(): Promise<EdgeKeyState>;
  /** R15a: pause a budget - no press. */
  hold?(grantId: number): Promise<void>;
  /** R15a: resume it - the copy check (R27), then a physical press. */
  resume?(grantId: number, onPress?: () => void): Promise<void>;
  /** R18: clear every owed receipt - a physical press. */
  settle?(onPress?: () => void): Promise<void>;
  /** R24: accept #from..#to as gone for good - a physical press; the key links a LOSS. */
  acceptLoss?(from: number, to: number, onPress?: () => void): Promise<void>;
  /** Budgets a lock or reboot ended, with uses and time left (Continue). */
  ended?(): Promise<EdgeEnded[]>;
  /** Continue: a new request for what is left of an ended budget - Yes and a press, like any budget. */
  continueBudget?(grantId: number): Promise<void>;
  /** 4.7a: hide an ended agent budget's card; the chain does not change. */
  dismissEnded?(grantId: number): Promise<void>;
  /**
   * R27 anchors: the key's own public key (read from the key, never from the
   * copy), the budget openings this phone kept, and the key's latest
   * checkpoint. A key that signs nothing (the fake) has none: then only the
   * genesis and HEAD anchor the copy.
   */
  /** checkpoint false: the public key and openings only - the key signs nothing (a sync in a burst) */
  copyKey?(opts?: {checkpoint?: boolean}): Promise<EdgeCopyKey>;
}

/*
 * HYBRID (lib chain.verifyCheckpoint; Brad, 2026-10-10): the key signs each checkpoint with
 * P-256 AND ML-DSA-65. publicKeyPq is the checkpoint key's ML-DSA-65 twin (1952 bytes, read
 * from the key like publicKey); the key's latest checkpoint carries both signatures - it is
 * the copy's one hybrid anchor, and a copy verifies only when it welds up to it. Older
 * checkpoints (seals, openings) keep and are checked by their P-256 half only.
 */
export type EdgeCopyKey = {
  publicKey: Uint8Array;
  publicKeyPq: Uint8Array | null;
  openings: Record<number, unknown>;
  checkpoint: {seq: number; head: Uint8Array; signature: Uint8Array; signaturePq?: Uint8Array | null} | null;
};

/* refusedTx: B7 stage 2, HEAD byte 60 - TX starts the key refused since it started (0 on older firmware) */
export type EdgeKeyState = {owed: number; held: number[]; refusedTx?: number};

/** A budget someone asked for and the person has not answered yet (spec 4.3 clasp sheet). */
export type EdgeRequest = {
  id: number;
  /** who asked: the computer, by its name (edgeAgents computerOf) */
  from: string;
  reason: string;
  /** identity: on a derived code (201-203, 221-223) the one identity the scope pays for (lib R11a: "ssh://...", "gpg://...") */
  scopes: {op: number; slot: number; cap: number; identity?: string}[];
  /** R15b: the lifetime asked for, in minutes (absent = the key's 12 h) */
  ttlMinutes?: number;
};

/**
 * A budget a lock or reboot ended before it was used up or ran out of time
 * (spec APP.md, Continue): what is left of it, by the phone's clock.
 */
export type EdgeEnded = {
  grantId: number;
  reason: string;
  scopes: {op: number; slot: number; cap: number}[];
  usesLeft: number;
  minutesLeft: number;
  /* opened for an agent (4.7a): the AGENT continues it, so the tab offers only Dismiss - by this name */
  agent?: string;
};
/**
 * Where budget requests arrive. NOT the key: a request comes from the CLI or an
 * MCP server through the user's Edge Worker (APP.md); the key only
 * sees the GRANT_CREATE that follows the person's Yes and press.
 */
export interface EdgeInbox {
  /** A budget request arriving (testing mode makes them until the MCP server / Worker send them). */
  request(from: string, reason: string, scopes: EdgeRequest['scopes']): number;
  pending(): Promise<EdgeRequest[]>;
  /**
   * Yes: the request goes to the key, which waits for a PHYSICAL press;
   * `onPress` says it is waiting, press() presses. Resolves once the budget is live.
   */
  approve(id: number, onPress?: () => void): Promise<void>;
  press(): Promise<void>;
  decline(id: number): Promise<void>;
  /** R27: does this phone's copy verify up to the key's live head? Yes stays off until it does. */
  check(): Promise<EdgeCopyCheck>;
}

