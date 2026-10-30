# ok-edge: the built site

Release v0.0.12-1347, built by the release workflow from main f49047a13663f54cef79cf62e651c85a12d5cd44. Nothing on this branch is source:
each release replaces all of it. The source and the workflow are on `main` (`.github/workflows/release.yml`).

- `docs/` - the web app, with `docs/firmware/` (the developer-key hex) and `docs/android/manifest.json`
- `worker/index.js` - the Worker, bundled (wrangler.json: no build, no bundling)

Deploy: `npx wrangler deploy` in this folder.
