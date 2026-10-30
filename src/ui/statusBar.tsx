/*
 * THE STATUS BAR'S ICONS, SHARED (PROPOSAL-rectify-ok-edge.md R0): each channel (src/features/channels) draws its own icon
 * with these - the same size, the same press, the same purple while data crosses (btActivity.ts).
 */
import {useEffect, useState} from 'react';
import {StyleSheet} from 'react-native';
import {IO_STEP_MS, ioPurple, nextShow, onIo, type IoChannel, type IoShow} from '../btActivity';

/*
 * PURPLE WHILE DATA CROSSES THE WIRE (Brad, 2026-10-07; the rule is btActivity.ts):
 * true while the icon should show traffic - until a second with none. Re-renders only
 * when the answer flips, on the 250 ms steps of a blink.
 */
export function useIoPurple(match: (c: IoChannel) => boolean, solid: boolean): boolean {
  const [purple, setPurple] = useState(false);
  useEffect(() => {
    let show: IoShow | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const tick = () => {
      timer = null;
      const now = Date.now();
      setPurple(ioPurple(show, now, solid));
      if (!show || now >= show.end) { show = null; return; }
      const nextStep = IO_STEP_MS - ((now - show.start) % IO_STEP_MS);
      timer = setTimeout(tick, solid ? show.end - now : Math.min(nextStep, show.end - now));
    };
    const off = onIo((c, at) => {
      if (!match(c)) return;
      show = nextShow(show, at);
      if (!timer) tick();
    });
    return () => { off(); if (timer) clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solid]);
  return purple;
}

export const barStyles = StyleSheet.create({
  barMid: {flexDirection: 'row', alignItems: 'center', gap: 12},
  barIcon: {fontSize: 17},
  pressed: {opacity: 0.6},
});
