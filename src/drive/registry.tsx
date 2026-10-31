/*
 * THE DRIVE'S VIEW OF THE APP (PROPOSAL-drive.md; Brad, 2026-10-31: "1 server to drive from, 3 things to drive -
 * webapp, desktop, android ... they should all be the same"). Every control that can be driven registers here with
 * its label, whether it is enabled, and the layer it sits on; a drive taps it by CALLING its press - never a screen
 * position (2026-10-31: a click measured while a drawer slid in landed where the button had been, and the sign never
 * ran; two controls with one label sent the click to the covered one).
 *
 * LAYERS: an open sheet, drawer or menu is a layer over what is beneath it. Only the top layer's controls are live -
 * what a person could press. Layer 0 is the screen itself.
 *
 * Gated for debugging (Brad: "driving is gated for debugging, so production does not use it"): nothing registers in a
 * build with its debugging lock on.
 */
import React, {createContext, useContext, useEffect, useRef, useState} from 'react';
import {buildInfo} from '../buildInfo';

export const driveGate = (): boolean => __DEV__ || !buildInfo.debugLock;

type Control = {id: number; label: string; enabled: boolean; layer: number; press: () => void};
const controls = new Map<number, Control>();
/* the open layers, in the order they opened: the last is on top */
const layers: number[] = [];
/* text fields a drive may fill, by their placeholder */
const fields = new Map<string, (value: string) => void>();
let nextId = 1;

const listeners = new Set<() => void>();
export function onDriveChange(l: () => void): () => void {
  listeners.add(l);
  return () => { listeners.delete(l); };
}
function changed(): void {
  for (const l of [...listeners]) l();
}

export const topLayer = (): number => (layers.length ? layers[layers.length - 1] : 0);

/** The controls on the top layer, as a person sees them: label and whether it takes a press now. */
export function liveControls(): {label: string; enabled: boolean}[] {
  const top = topLayer();
  return [...controls.values()].filter(c => c.layer === top).map(c => ({label: c.label, enabled: c.enabled}));
}

/** Press the top layer's enabled control with this label. -> null, or why not. */
export function tapLabel(label: string): string | null {
  const top = topLayer();
  const same = [...controls.values()].filter(c => c.label === label);
  if (!same.length) return `no control "${label}"`;
  const live = same.find(c => c.layer === top && c.enabled);
  if (!live) return same.some(c => c.layer === top) ? `"${label}" is disabled` : `"${label}" is covered`;
  live.press();
  return null;
}

/** Fill a registered text field. -> null, or why not. */
export function fillField(placeholder: string, value: string): string | null {
  const set = fields.get(placeholder);
  if (!set) return `no field "${placeholder}"`;
  set(value);
  return null;
}

const LayerContext = createContext(0);

/** A control the drive can tap: its label, whether it is enabled, and what a press does. */
export function useDriveControl(label: string | undefined, enabled: boolean, press: () => void): void {
  const layer = useContext(LayerContext);
  const pressRef = useRef(press);
  pressRef.current = press;
  useEffect(() => {
    if (!label || !driveGate()) return;
    const id = nextId++;
    controls.set(id, {id, label, enabled, layer, press: () => pressRef.current()});
    changed();
    return () => { controls.delete(id); changed(); };
  }, [label, enabled, layer]);
}

/** A text field the drive can fill, by its placeholder. */
export function useDriveField(placeholder: string, set: (value: string) => void): void {
  const setRef = useRef(set);
  setRef.current = set;
  useEffect(() => {
    if (!driveGate()) return;
    const fill = (v: string) => setRef.current(v);
    fields.set(placeholder, fill);
    return () => { if (fields.get(placeholder) === fill) fields.delete(placeholder); };
  }, [placeholder]);
}

/** An overlay: while `open`, what is inside it is the top layer and everything beneath is covered. */
export function DriveLayer({open, children}: {open: boolean; children: React.ReactNode}) {
  const [id] = useState(() => nextId++);
  useEffect(() => {
    if (!open || !driveGate()) return;
    layers.push(id);
    changed();
    return () => {
      const at = layers.lastIndexOf(id);
      if (at >= 0) layers.splice(at, 1);
      changed();
    };
  }, [open, id]);
  return <LayerContext.Provider value={id}>{children}</LayerContext.Provider>;
}

/** A control registered from inside a layer (a sheet's Close, a drawer's handle, a menu item): renders nothing. */
export function DriveTap({label, enabled = true, onPress}: {label: string; enabled?: boolean; onPress: () => void}) {
  useDriveControl(label, enabled, onPress);
  return null;
}

/*
 * WHAT THE APP KNOWS ABOUT ITSELF, for a drive (2026-10-31: "logged in" read off the screen's text came while the
 * identity check was still running, and the next move raced its press sheet). The app sets these where it decides
 * them - MainApp its phase, the key-busy events whether a key request is in flight - and every control update carries
 * them, with whether an overlay is open.
 */
const flags: Record<string, unknown> = {};
export function setDriveFlag(name: string, value: unknown): void {
  if (!driveGate() || flags[name] === value) return;
  flags[name] = value;
  changed();
}
export const driveFlags = (): Record<string, unknown> => ({...flags});
