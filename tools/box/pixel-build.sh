#!/usr/bin/env bash
# The phones' debug APK, built on the box and (with INSTALL=1) installed on the Pixel and started.
#
# Run from Windows over ssh: a plain `ssh box '...'` has neither node (nvm) nor the Android SDK on its PATH, and gradle
# failed on each in turn ("Cannot run program node", then "SDK location not found") - so this sets both itself.
# com.okrn with the debugging lock off: the build the phones run (memory: phones run ok-edge as com.okrn).
#
#   ssh box 'bash ~/project/onlykey/ok-edge/tools/box/pixel-build.sh'            build only
#   ssh box 'INSTALL=1 bash ~/project/onlykey/ok-edge/tools/box/pixel-build.sh'  build, install (data kept), start
set -euo pipefail
. "$HOME/.nvm/nvm.sh"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"
export PATH="$PATH:$ANDROID_HOME/platform-tools"
export ANDROID_SERIAL="${ANDROID_SERIAL:-26251JEGR09693}"
cd "$(dirname "$0")/../../android"
log=/tmp/okedge-build.log
if ! OKEDGE_APP_ID=com.okrn OKRN_DEBUG_LOCK=off ./gradlew assembleDebug -q >"$log" 2>&1; then
  grep -m5 -A3 -E "What went wrong|error:" "$log" || tail -20 "$log"
  exit 1
fi
apk=app/build/outputs/apk/debug/app-debug.apk
echo "built $(date -r "$apk" +%H:%M) $apk"
if [ "${INSTALL:-0}" = 1 ]; then
  adb install -r "$apk" | tail -1
  adb shell monkey -p com.okrn -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1
  echo "started com.okrn on $ANDROID_SERIAL"
fi
