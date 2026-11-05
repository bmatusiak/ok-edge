#!/usr/bin/env bash
# The phones' debug APK, built on the box and (with INSTALL=1) installed on the Pixel and started.
#
# Run from Windows over ssh: a plain `ssh box '...'` has neither node (nvm) nor the Android SDK on its PATH, and gradle
# failed on each in turn ("Cannot run program node", then "SDK location not found") - so this sets both itself.
# com.okedge.debug (the debug channel, modules/okedge-native/app.plugin.js) with the debugging lock off.
#
#   ssh box 'bash ~/project/onlykey/ok-edge/tools/box/pixel-build.sh'            build only
#   ssh box 'INSTALL=1 bash ~/project/onlykey/ok-edge/tools/box/pixel-build.sh'  build, install (data kept), start
#   ssh box 'RELEASE=1 bash ~/project/onlykey/ok-edge/tools/box/pixel-build.sh'  the release channel, unsigned (for apk-sign)
set -euo pipefail
. "$HOME/.nvm/nvm.sh"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"
export PATH="$PATH:$ANDROID_HOME/platform-tools"
export ANDROID_SERIAL="${ANDROID_SERIAL:-26251JEGR09693}"
cd "$(dirname "$0")/../../android"
log=/tmp/okedge-build.log
if [ "${RELEASE:-0}" = 1 ]; then
  # THE RELEASE CHANNEL, UNSIGNED (step 8, 2026-11-04: an APK for red-key's RSA3 to sign, as the workflow's release job):
  # com.okedge, "OnlyKey", the production soft key, the official signer read from signing/release.crt.pem; gradle leaves
  # it unsigned (app.plugin.js signingConfig null) - tools/release/apk-sign signs it. Cold: Metro's cache dropped first,
  # so no transform from a debug-channel bundle is reused (memory prefer-clean-uncached-builds).
  rm -rf "${TMPDIR:-/tmp}"/metro-* ../node_modules/.cache
  if ! EXPO_PUBLIC_OKEDGE_CHANNEL=release OKEMU_PRODUCTION=1 ./gradlew assembleRelease -q >"$log" 2>&1; then
    grep -m5 -A3 -E "What went wrong|error:" "$log" || tail -20 "$log"
    exit 1
  fi
  apk=app/build/outputs/apk/release/app-release-unsigned.apk
  echo "built $(date -r "$apk" +%H:%M) $(pwd)/$apk"
  exit 0
fi
if ! OKRN_DEBUG_LOCK=off ./gradlew assembleDebug -q >"$log" 2>&1; then
  grep -m5 -A3 -E "What went wrong|error:" "$log" || tail -20 "$log"
  exit 1
fi
apk=app/build/outputs/apk/debug/app-debug.apk
echo "built $(date -r "$apk" +%H:%M) $apk"
if [ "${INSTALL:-0}" = 1 ]; then
  adb install -r "$apk" | tail -1
  adb shell monkey -p com.okedge.debug -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1
  echo "started com.okedge.debug on $ANDROID_SERIAL"
fi
