/*
 * THE TABS REGISTRY: every tab in the app adds itself here - the core tabs (src/features/core.tsx) and the feature
 * plugins (Passwords, Guest Book, CryptoBox) alike - and MainApp draws what `shown` lists, naming no tab itself
 * (PROPOSAL-rectify-ok-edge.md R0). The drawer's rules live here, once:
 *   - order: the core tabs number their places; a plugin tab goes `after` the tab it names, else before the last
 *     (Settings stays last - Brad, 2026-10-11);
 *   - hidden: kept, not in the drawer (opened by name - Settings' sub views, the status icons' Activity);
 *   - devOnly: debug builds only (Log);
 *   - when: in the drawer only while it holds (testing mode, a firmware plugin present);
 *   - testing mode with the key still locked: only the tabs marked inLockedTesting (This Key, Testing), nothing else -
 *     no bucket is open (Brad, 2026-10-25).
 */
import type {AppTab, AppWatch, TabState} from './types';

export type TabsService = {
  add(tab: AppTab, watch?: AppWatch): void;
  list(): readonly AppTab[];
  watches(): readonly AppWatch[];
  shown(state: TabState): readonly AppTab[];
  /** a watch with no tab (the key's prompts: the press sheet, the busy sheet, ...) */
  watch(watch: AppWatch): void;
};

export function shownOf(tabs: readonly AppTab[], state: TabState, dev: boolean): AppTab[] {
  const visible = tabs.filter(t => !t.hidden && (dev || !t.devOnly) && (!t.when || t.when(state)));
  if (state.testing && state.testingLocked) return visible.filter(t => t.inLockedTesting).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const all = visible.filter(t => t.order !== undefined).sort((a, b) => a.order! - b.order!);
  for (const t of visible.filter(x => x.order === undefined)) {
    const at = t.after ? all.findIndex(x => x.name === t.after) : -1;
    all.splice(at >= 0 ? at + 1 : Math.max(0, all.length - 1), 0, t);
  }
  return all;
}

export default function setup(_imports: unknown, register: (err: Error | null, services: {tabs: TabsService}) => void) {
  const tabs: AppTab[] = [];
  const watches: AppWatch[] = [];
  register(null, {
    tabs: {
      add(tab, watch) {
        if (tabs.some(t => t.name === tab.name)) throw new Error(`app plugins: two tabs named ${tab.name}`);
        tabs.push(tab);
        if (watch) watches.push(watch);
      },
      list: () => tabs.slice(),
      watches: () => watches.slice(),
      shown: state => shownOf(tabs, state, __DEV__),
      watch: w => { watches.push(w); },
    },
  });
}
setup.consumes = [] as string[];
setup.provides = ['tabs'];
