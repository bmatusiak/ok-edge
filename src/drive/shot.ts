/*
 * THE APP'S PICTURE OF ITSELF, for a drive (PROPOSAL-drive.md; Brad, 2026-10-31: "asking the app for the screenshot,
 * not host dependent - have the app do it"). Each shell captures its own screen (shot.desktop.ts: the window, by its
 * main process); a shell without a capture yet says so - the drive logs the reason instead of a picture.
 * -> PNG as base64, or {why}.
 */
export async function shot(): Promise<{png: string} | {why: string}> {
  return {why: 'this shell does not capture itself yet'};
}
