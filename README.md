# ok-edge: the built site

Release v0.0.9-1219, built by the release workflow from main b51752be9951f4f0df8c273577d1073b434d2760. Nothing on this branch is source:
each release replaces all of it. The source and the workflow are on `main` (`.github/workflows/release.yml`).

- `docs/` - the web app, with `docs/firmware/` (the developer-key hex) and `docs/android/manifest.json`
- `worker/index.js` - the Worker, bundled (wrangler.json: no build, no bundling)

Deploy: `npx wrangler deploy` in this folder.
