/*
 * THE WEB APP'S SERVICE WORKER (Brad, 2026-10-29: "i want to make loading the webapp cheap using service worker, using
 * the cache version, and updating"; "this gives the user to use the webapp offline, in airplane mode"). Written into
 * docs/sw.js by tools/web-build.js, with this build's version and its files filled in.
 *
 * One cache per build (okedge-web-<version>), filled when the worker installs: the app then loads from it - fast, and
 * with no network at all. A new build is a new worker (its version differs, so the browser installs it); once active it
 * deletes every older build's cache. Never cached: /version.json (how a page learns a newer build is out, src/webUpdate.ts),
 * this file, the rooms and /mcp (live), the firmware downloads (large, rarely asked).
 */
const VERSION = "f49047a-mvugldjj";
const FILES = ["/","/_expo/static/js/web/index-2171efd831ce6982b9e40a5f1e04a92f.js","/assets/assets/OKS1.f4ca6cefe8e7467ce6c0d1d87a72749e.png","/assets/assets/OKS2.2f5c44d1332e94349584f28e00f6485f.png","/assets/assets/duo-photo.4eb528d6cd229cfc075ac23585931877.png","/assets/assets/onlykey-logo.f70f39fd279ac1d6b7717821500a6f12.png","/assets/assets/onlykey-mark.574cd2e6df2327a6750510fcbd917cfa.png","/assets/assets/onlykey-photo.9096f91b4cb5068d34d30f26c6c83911.png","/favicon.ico","/metadata.json","/sounds/press_loud.mp3","/sounds/press_soft.mp3"];
const CACHE = `okedge-web-${VERSION}`;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith('okedge-web-') && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

const LIVE = (p) => p === '/version.json' || p === '/sw.js' || p === '/mcp' || p.startsWith('/ws/') || p.startsWith('/firmware/');

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin || LIVE(url.pathname)) return;
  /*
   * every route is the one page (the server's single-page handling): the cached '/', else the network. Never
   * /index.html: the server answers it with a redirect to /, and a redirected response served for a page load is refused
   * by the browser (box, 2026-10-29: the reload ended in ERR_FAILED)
   */
  const want = e.request.mode === 'navigate' ? '/' : e.request;
  /* a cached response that came by a redirect is served as a plain copy - a page load refuses a redirected one */
  const plain = (r) => (r && r.redirected ? r.blob().then((b) => new Response(b, { status: r.status, statusText: r.statusText, headers: r.headers })) : r);
  e.respondWith(caches.open(CACHE).then((c) => c.match(want)).then(plain).then((hit) => hit || fetch(e.request)));
});
