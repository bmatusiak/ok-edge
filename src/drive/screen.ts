/*
 * THE SCREEN'S TEXT, for a drive (client.ts): what the app shows, read by the app itself, and a call on each change.
 * Each shell reads its own - here the web shells (desktop, web app), from their page; screen.android.ts natively.
 * A field's value is never part of it (innerText leaves input values out).
 */
export async function screenText(): Promise<string> {
  if (typeof document === 'undefined' || !document.body) return '';
  return document.body.innerText;
}

/* on every change of the page, one call per frame at most - the page's own MutationObserver, no polling */
export function watchScreen(changed: () => void): void {
  if (typeof document === 'undefined' || typeof MutationObserver === 'undefined' || !document.body) return;
  let queued = false;
  new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; changed(); });
  }).observe(document.body, {subtree: true, childList: true, characterData: true});
}
