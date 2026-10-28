# ok-edge: the built site

Release v0.0.10-1221, built by the release workflow from main 6987b9c0fb38f7c8d01ed4d39afd0d91f0fe6fb5. Nothing on this branch is source:
each release replaces all of it. The source and the workflow are on `main` (`.github/workflows/release.yml`).

- `docs/` - the web app, with `docs/firmware/` (the developer-key hex) and `docs/android/manifest.json`
- `worker/index.js` - the Worker, bundled (wrangler.json: no build, no bundling)

Deploy: `npx wrangler deploy` in this folder.
