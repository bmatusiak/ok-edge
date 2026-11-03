/* THE DESKTOP APP CLOSES ITSELF (quit.ts): its main process quits, as the window's close would - storage flushed */
export async function quit(): Promise<{ok: true} | {why: string}> {
  const bridge = (globalThis as any).okedge;
  if (!bridge?.invoke) return {why: 'no desktop bridge'};
  /*
   * what the page holds as it goes (2026-11-03: the Server setting was gone after some quick closes) - the setting and how
   * many keys its storage has; the next start says what it read (serverRoom.ts), so a write lost at exit shows
   */
  try { const ls = (globalThis as any).localStorage; console.log(`[room] at quit: the server setting ${ls?.getItem('okedge.room.server') ?? 'none'}, ${ls?.length ?? 0} stored keys`); } catch { /* no storage */ }
  /* answered first; the quit follows once the reply is out (electron/main.js okedge:quit) */
  void bridge.invoke('okedge:quit');
  return {ok: true};
}
