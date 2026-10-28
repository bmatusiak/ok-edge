# ok-edge: the built site

Release v0.0.8-1204, built by the release workflow from main d0e1f0b64e59550de0b20db1100da64a25e7987a. Nothing on this branch is source:
each release replaces all of it. The source and the workflow are on `main` (`.github/workflows/release.yml`).

- `docs/` - the web app, with `docs/firmware/` (the developer-key hex) and `docs/android/manifest.json`
- `worker/index.js` - the Worker, bundled (wrangler.json: no build, no bundling)

Deploy: `npx wrangler deploy` in this folder.
