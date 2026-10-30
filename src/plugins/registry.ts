/*
 * THE STARTED APP'S SERVICES, read by anyone - this file imports no feature. src/plugins/index.ts builds and starts the
 * app (it imports every feature, and the features import screens); a screen that reads a registry (the recipients for
 * Messages and Key Chain) reads it here, so no screen imports the file that imports it (Metro's "Require cycle",
 * 2026-10-30, once the core tabs became plugins).
 */
import {useEffect, useState} from 'react';
import type {TabsService} from './tabs';
import type {RecipientSource, RecipientsService} from './recipients';
import type {AppChannel, AppTab, AppWatch, TabState} from './types';

let started: TabsService | null = null;
let recipientsService: RecipientsService | null = null;
const waiting = new Set<() => void>();

/** index.ts, once the app has started */
export function setStarted(tabs: TabsService, recipients: RecipientsService): void {
  started = tabs;
  recipientsService = recipients;
  for (const w of waiting) w();
  waiting.clear();
}

/** The drawer's tabs now, in order (tabs.ts shown); empty until the app has started (a moment after launch). */
export function shownTabs(state: TabState): readonly AppTab[] {
  return started ? started.shown(state) : [];
}

/** Every tab, shown or kept (a hidden one opens by its name). */
export function pluginTabs(): readonly AppTab[] {
  return started ? started.list() : [];
}

/** The plugins that offer people's public keys to core screens (src/plugins/recipients.ts). */
export function pluginRecipientSources(): readonly RecipientSource[] {
  return recipientsService ? recipientsService.list() : [];
}

/** The channels this platform has, in order: each one's status icon and Activity card. */
export function pluginChannels(): readonly AppChannel[] {
  return started ? started.channels() : [];
}

export function pluginWatches(): readonly AppWatch[] {
  return started ? started.watches() : [];
}

/** Re-renders once when the plugins have started. */
export function usePluginsStarted(): boolean {
  const [ok, setOk] = useState(started !== null);
  useEffect(() => {
    if (ok) return;
    const w = () => setOk(true);
    if (started) w();
    else waiting.add(w);
    return () => void waiting.delete(w);
  }, [ok]);
  return ok;
}
