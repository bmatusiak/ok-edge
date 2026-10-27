/*
 * THE PRESS SOUND ON THE DESKTOP AND IN THE WEB APP (Brad, 2026-10-27: "the mobile app plays a sound, the desktop
 * app does [not]" - "the edge sheet needs the sound too for hardkeys for both desktop and webapp").
 *
 * The phone sounds a wait natively (modules/okedge-native PressAlert.kt): it reads the soft key's own confirm state,
 * so it rings with the screen off. The desktop and the browser have no such side, so the SHEETS ring there instead,
 * while they are up and not yet answered - with the phone's own files (public/sounds, copied from the module's
 * res/raw) and its own cadence:
 *
 *   a press  -> soft at once and every 2 s; past 10 s loud every 3 s (the key gives up at 20 s)
 *   a question (the Edge sheet's Yes/No) -> the same, loud only in its second minute
 *
 * One hook, used by the sheets on every shell: on the phone it does nothing, so a wait never rings twice.
 * A hard key has no confirm state to read, so on the desktop and in the browser the Edge sheet is the only place
 * that knows a hard key is waiting - it rings for it here.
 */
import {useEffect} from 'react';
import {shell} from '../platform';

const SOFT_EVERY_MS = 2_000;
const LOUD_EVERY_MS = 3_000;
const LOUD_AFTER_MS = {press: 10_000, ask: 60_000} as const;

export type SoundKind = keyof typeof LOUD_AFTER_MS;

/* one element per file, made on first use (no Audio in jest or on the phone) */
const players: Partial<Record<'soft' | 'loud', HTMLAudioElement>> = {};
function play(which: 'soft' | 'loud') {
  try {
    const a = (players[which] ??= new Audio(`/sounds/press_${which}.mp3`));
    a.currentTime = 0;
    /* a page the person has not touched yet may not play: the sheet still shows, so nothing else is lost */
    void a.play().catch(() => undefined);
  } catch {
    /* no Audio here */
  }
}

/**
 * Ring while `wait` is set (anything naming this one wait - its start, its deadline) and it is not answered.
 * Another `wait` is a new wait: it starts soft again, timed from when it was first seen here.
 */
export function usePressSound(wait: number | null, kind: SoundKind) {
  useEffect(() => {
    if (shell === 'android' || !wait) return;
    const since = Date.now();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const ring = () => {
      const loud = Date.now() - since >= LOUD_AFTER_MS[kind];
      play(loud ? 'loud' : 'soft');
      timer = setTimeout(ring, loud ? LOUD_EVERY_MS : SOFT_EVERY_MS);
    };
    ring();
    return () => { if (timer) clearTimeout(timer); };
  }, [wait, kind]);
}
