/* THE DESKTOP APP CLOSES ITSELF (quit.ts): its main process quits, as the window's close would - storage flushed */
export async function quit(): Promise<{ok: true} | {why: string}> {
  const bridge = (globalThis as any).okedge;
  if (!bridge?.invoke) return {why: 'no desktop bridge'};
  /* answered first; the quit follows once the reply is out (electron/main.js okedge:quit) */
  void bridge.invoke('okedge:quit');
  return {ok: true};
}
