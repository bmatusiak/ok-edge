#!/bin/bash
# Build the box desktop app's SOFT KEY the way the release does (.github/workflows/release.yml "Build the soft key from
# the same sources"): v3.1.0, no DEBUG console, the plugins the phone's APK is built with (read from
# modules/okedge-native/app.plugin.js, so the two cannot differ), its build record into src/generated.
# Why: a soft key built for a kit run (plugin-test.sh, pulse-test-box.sh: edge alone, DEBUG) left the desktop without
# key_chain - its derive gate then waited for a 3-digit code it never told the app about, and every bucket key derive
# ended CTAP2_ERR_ACTION_TIMEOUT with no code on screen (2026-10-31).
# Then rebuild the test export and restart the app:  npm run build:desktop:test && bash tools/box/desktop-test.sh
#   bash tools/box/softkey-build.sh            DEBUG=1 for the debug console (its Serial prints reach the page's console
#                                               as [okemu-fw] lines); build again without it when done
source ~/.nvm/nvm.sh >/dev/null
EDGE=~/project/onlykey/ok-edge
E=~/project/onlykey/node-onlykey-emulator/emulator
PL=$(node -e "console.log(require('fs').readFileSync('$EDGE/modules/okedge-native/app.plugin.js', 'utf8').match(/const PLUGINS = '([^']+)'/)[1])")
echo "soft key plugins: $PL"
cd "$E" || exit 1
JOBS=max OKEMU_VERSION=v3.1.0 OKEMU_PLUGINS=$PL OKEMU_DEBUG=${DEBUG:-0}OKEMU_APP_OUT=$EDGE/src/generated npm run rebuild > ../../logs/softkey-build.log 2>&1 \
  || { echo "build FAILED - ~/project/onlykey/logs/softkey-build.log"; tail -5 ../../logs/softkey-build.log; exit 1; }
echo "$(date -Is) softkey-build.sh: $PL" >> ~/project/onlykey/steps.log
echo "built: $(jq -c .plugins .stage/build.json)"
