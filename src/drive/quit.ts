/*
 * THE APP CLOSES ITSELF, for a drive's stop or restart (2026-10-31: a restart that killed the desktop app's processes
 * lost what Chromium had not flushed - the app's copy of its own chain - and the next budget could not be approved).
 * Each shell quits its own way (quit.desktop.ts, quit.android.ts); a shell without one says so and is stopped from
 * outside. -> {ok} or {why}.
 */
export async function quit(): Promise<{ok: true} | {why: string}> {
  return {why: 'this shell does not close itself yet'};
}
