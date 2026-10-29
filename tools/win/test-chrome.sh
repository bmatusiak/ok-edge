#!/usr/bin/env bash
# A TEST Chrome on Windows (Git Bash), for a test hard key on this PC's USB (key 1): the web app from the box's dev
# server (tools/box/server.sh, HTTPS=1, port 8787) under the key's own site name, so WebAuthn's rpId is the one the
# key's ctap_bridge answers (ok-edge.bmatusiak.workers.dev) - the deployed path, served from the box.
#   bash tools/win/test-chrome.sh            open it (a window of its own; your everyday Chrome is not touched)
#   bash tools/win/test-chrome.sh stop       close it (its own profile's processes only)
# Its own profile (%LOCALAPPDATA%\okedge-test-chrome): the name mapping and the dev certificate's acceptance hold only
# in this browser. The certificate is accepted by its public key's fingerprint (the box's devcert), never by turning
# checks off. DevTools on port 9334, so the page can be read and driven from here.
BOX=192.168.51.113
SITE=ok-edge.bmatusiak.workers.dev
CHROME="/c/Program Files/Google/Chrome/Application/chrome.exe"
PROFILE="$LOCALAPPDATA\\okedge-test-chrome"
case "${1:-open}" in
  open)
    spki=$(ssh -o BatchMode=yes bmatusiak@$BOX 'cat ~/project/onlykey/devcert/apps.crp.to.spki' </dev/null) || { echo "could not read the box's devcert"; exit 1; }
    "$CHROME" --user-data-dir="$PROFILE" --no-first-run --remote-debugging-port=9334 \
      --host-resolver-rules="MAP $SITE $BOX" --ignore-certificate-errors-spki-list="$spki" \
      --new-window "https://$SITE:8787/" >/dev/null 2>&1 &
    disown
    echo "opened https://$SITE:8787 (the box's server) in a test Chrome - profile $PROFILE, DevTools :9334" ;;
  stop)
    powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='chrome.exe'\" | Where-Object { \$_.CommandLine -like '*okedge-test-chrome*' } | ForEach-Object { Stop-Process -Id \$_.ProcessId -Force -ErrorAction SilentlyContinue }"
    echo stopped ;;
  *) echo "usage: $0 [open|stop]"; exit 1 ;;
esac
