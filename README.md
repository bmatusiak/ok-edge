# ok-edge: the built site

Release v0.0.13-1395, built by the release workflow from main 62f69e329f52e0e82d1a4507bdbe7bf5a33d6b43. Nothing on this branch is source:
each release replaces all of it. The source and the workflow are on `main` (`.github/workflows/release.yml`).

- `docs/` - the web app, with `docs/firmware/` (the developer-key hex) and `docs/android/manifest.json`
- `worker/index.js` - the Worker, bundled (wrangler.json: no build, no bundling)

Deploy: `npx wrangler deploy` in this folder.
