#!/usr/bin/env bash
# REHEARSE THE RELEASE WORKFLOW ON THE BOX (.github/workflows/release.yml), so no runner time is spent finding its bugs.
#
#   bash tools/box/release-rehearse.sh <ok-edge.bundle | ok-edge clone> [jobs]     jobs: firmware android webapp (all)
#
# The same steps as the workflow's jobs, in a CLEAN folder ($W): ok-edge from the bundle (main, as the runner checks it
# out - unpushed commits included), everything else cloned from GitHub as the workflow does - the emulator at the
# record's emulatorCommit, trustcrypto's libraries and OnlyKey-Firmware with every branch local, the Arduino tree, the
# kit, test-moniker. Nothing is published: the last step assembles the cloudflare branch's contents in $W/site.
# Each job leaves what the workflow would upload in $W/out/<job>.
set -euo pipefail
SRC="${1:?usage: release-rehearse.sh <ok-edge bundle or clone> [firmware android webapp]}"
shift
JOBS="${*:-firmware android webapp}"
W="${W:-$HOME/project/onlykey/release-rehearse}"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"
[ -s ~/.nvm/nvm.sh ] && source ~/.nvm/nvm.sh >/dev/null
say() { echo "== $(date +%T) $*"; }
has() { case " $JOBS " in *" $1 "*) return 0 ;; esac; return 1; }

say "workspace $W (jobs: $JOBS)"
if has firmware; then rm -rf "$W"; fi
mkdir -p "$W/out"
cd "$W"
[ -d ok-edge ] || git clone -q -b main "$SRC" ok-edge
emulator=$(node -p "require('./ok-edge/firmware/manifest.json').emulatorCommit")
version=$(node -p "require('./ok-edge/app.json').expo.version")
code=$((1000 + $(git -C ok-edge rev-list --count HEAD)))
tag="v$version-$code"
say "release $tag from ok-edge $(git -C ok-edge rev-parse --short HEAD), emulator ${emulator:0:7}"

# the composite action .github/actions/firmware-sources
sources() {
  [ -d node-onlykey-emulator ] && return 0
  git clone -q https://github.com/bm-ok/node-onlykey-emulator && git -C node-onlykey-emulator checkout -q --detach "$emulator"
  git clone -q --depth 1 https://github.com/bm-ok/arduino-1.6.5-r5-teensy_127
  for r in libraries OnlyKey-Firmware; do
    git clone -q "https://github.com/trustcrypto/$r" "$r"
    for b in $(git -C "$r" for-each-ref --format='%(refname:strip=3)' refs/remotes/origin/ | grep -v '^HEAD$'); do
      git -C "$r" show-ref --verify --quiet "refs/heads/$b" || git -C "$r" branch --quiet "$b" "origin/$b"
    done
  done
  (cd node-onlykey-emulator/emulator && npm ci --ignore-scripts --no-audit --no-fund --loglevel=error)
}

if has firmware; then
  say "firmware"
  sources
  git clone -q --depth 1 https://github.com/bm-ok/onlykey-testing
  node ok-edge/tools/firmware.js check
  node ok-edge/tools/firmware.js ci-build --out out/fw --src "$W" --kit onlykey-testing
  rm -rf out/firmware && cp -a out/fw/firmware out/firmware
fi

okedge_install() {
  [ -d test-moniker ] || git clone -q --depth 1 https://github.com/bmatusiak/test-moniker
  [ -d ok-edge/node_modules ] || (cd ok-edge && ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci --no-audit --no-fund --loglevel=error)
  cp out/firmware/* ok-edge/firmware/
}

if has android; then
  say "android"
  sources
  okedge_install
  (cd ok-edge && OKEDGE_APP_ID=com.okrn npx expo prebuild --platform android --no-install)
  (cd ok-edge/android && OKEDGE_APP_ID=com.okrn OKEMU_PRODUCTION=1 ./gradlew assembleRelease --no-daemon -q)
  apk=ok-edge/android/app/build/outputs/apk/release/app-release.apk
  bad=0
  for h in $(find node-onlykey-emulator/emulator/.stage* -path '*libraries/onlykey/onlykey.h'); do
    if grep -qE '^#define DEBUG\s' "$h"; then echo "DEBUG on in $h"; bad=1; fi
  done
  node -e "if (require('./ok-edge/src/generated/firmware.json').debugLock === false) { console.error('the debugging lock is off'); process.exit(1) }" || bad=1
  if unzip -p "$apk" assets/index.android.bundle | grep -qa 'Soft Key firmware'; then echo "the testing screen is in the bundle"; bad=1; fi
  want=$(node -p "require('./ok-edge/firmware/manifest.json').file")
  [ "$(unzip -p "$apk" "assets/developer_firmware/$want" | sha256sum | cut -d' ' -f1)" = "$(node -p "require('./ok-edge/firmware/manifest.json').sha256")" ] \
    || { echo "the APK does not carry $want as built"; bad=1; }
  [ $bad = 0 ]
  say "   release checks: DEBUG off, debugging lock on, no testing screen, $want inside"
  mkdir -p out/android
  file="onlykey-edge-$version-$code.apk"
  cp "$apk" "out/android/$file"
  apksigner=$(ls -d "$ANDROID_HOME"/build-tools/*/ | sort -V | tail -1)apksigner
  node ok-edge/tools/release/android-manifest.js --apk "out/android/$file" --apksigner "$apksigner" --repo bmatusiak/ok-edge \
    --tag "$tag" --version "$version" --version-code "$code" --commit "$(git -C ok-edge rev-parse HEAD)" --out out/android/manifest.json
fi

if has webapp; then
  say "webapp"
  okedge_install
  wrangler=$(node -p "require('./ok-edge/package.json').scripts['server:dev'].match(/wrangler@([\d.]+)/)[1]")
  (cd ok-edge && rm -rf docs worker-out && CI=1 npx --yes "wrangler@$wrangler" deploy --dry-run --outdir worker-out)
  mkdir -p ok-edge/docs/android
  [ -f out/android/manifest.json ] && cp out/android/manifest.json ok-edge/docs/android/manifest.json
  (cd ok-edge && node tools/release/cloudflare-site.js --docs docs --worker worker-out --out ../site --commit "$(git rev-parse HEAD)" --tag "$tag")
  say "   site: $(find site -type f | wc -l) files, $(du -sh site | cut -f1)"
fi
say "done"
