/*
 * THE EDGE TAB'S DEVICE FILTER (Brad, 2026-10-31: "the 'Warning' yellow label can be a filter for different devices,
 * showing buttons for each device to turn on and off, buttons showing nametag and device short id"; "it should be a
 * filter toggle selection screen"; "by default show all in filter"). Which devices' budgets and presses the Edge tab
 * shows - a view of the history, never a gate on it: everything merged is in the log whatever is switched off here.
 *
 * Kept per viewer (AsyncStorage: this device's own choice, as a remembered tab is); only the devices switched OFF are
 * stored, so a device seen for the first time is shown.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'okedge.edgeFilter.hidden';
let hidden = new Set<string>();
let loaded = false;
const listeners = new Set<() => void>();

async function load(): Promise<void> {
  if (loaded) return;
  loaded = true;
  try { hidden = new Set(JSON.parse((await AsyncStorage.getItem(KEY)) || '[]')); } catch { hidden = new Set(); }
  for (const l of [...listeners]) l();
}

export function onFilter(l: () => void): () => void {
  listeners.add(l);
  void load();
  return () => { listeners.delete(l); };
}

/** Whether a device (its id, lowercase hex) is shown - every device is, until switched off. */
export const shown = (deviceId: string | null | undefined): boolean => !deviceId || !hidden.has(deviceId.toLowerCase());

export function setShown(deviceId: string, on: boolean): void {
  const id = deviceId.toLowerCase();
  if (on) hidden.delete(id); else hidden.add(id);
  for (const l of [...listeners]) l();
  void AsyncStorage.setItem(KEY, JSON.stringify([...hidden])).catch(() => { /* not kept: shown again next time */ });
}

export function showAll(): void {
  hidden = new Set();
  for (const l of [...listeners]) l();
  void AsyncStorage.removeItem(KEY).catch(() => {});
}
