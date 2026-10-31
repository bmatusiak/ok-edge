/* THE DESKTOP APP'S PICTURE OF ITSELF (shot.ts): its own window, captured by its main process (electron/main.js okedge:shot) */
export async function shot(): Promise<{png: string} | {why: string}> {
  const bridge = (globalThis as any).okedge;
  if (!bridge?.invoke) return {why: 'no desktop bridge'};
  try {
    return {png: String(await bridge.invoke('okedge:shot'))};
  } catch (e) {
    return {why: String((e as Error)?.message ?? e)};
  }
}
