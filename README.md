# ok-edge: the built site

Release v0.0.14-1848, built by the release workflow from main 22606179709020aa68083bafe60be9f1a7a90c3f. Nothing on this branch is source:
each release replaces all of it. The source and the workflow are on `main` (`.github/workflows/release.yml`).

- `docs/` - the web app, with `docs/firmware/` (the developer-key hex) and `docs/android/manifest.json`
- `worker/index.js` - the Worker, bundled (wrangler.json: no build, no bundling)

Deploy: `npx wrangler deploy` in this folder.
