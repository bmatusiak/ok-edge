#!/bin/bash
# The web app on the box: build docs/, serve it as https://apps.crp.to:8443 (tools/box/serve-docs.js + devcert.sh),
# open Chromium on the xrdp desktop (:10) with apps.crp.to mapped to this box and the dev certificate accepted.
#   tools/box/webapp.sh build | serve | browser | shot | stop
set -u
ROOT=~/project/onlykey
EDGE=$ROOT/ok-edge
PROFILE=$ROOT/webapp-chromium
source ~/.nvm/nvm.sh >/dev/null
case "${1:-}" in
  build) cd $EDGE && npm run build:webapp > $ROOT/logs/build-webapp.log 2>&1; echo "build $?"; tail -1 $ROOT/logs/build-webapp.log ;;
  serve)
    pkill -f "serve-docs.js $EDGE/docs" 2>/dev/null
    setsid nohup node $EDGE/tools/box/serve-docs.js $EDGE/docs $ROOT/devcert 8443 > $ROOT/logs/serve-docs.log 2>&1 < /dev/null &
    sleep 1; cat $ROOT/logs/serve-docs.log ;;
  browser)
    for p in $(pgrep -f "user-data-dir=$PROFILE"); do kill $p 2>/dev/null; done; sleep 1
    DISPLAY=:10 setsid nohup chromium-browser --test-type --remote-debugging-port=9333 --host-resolver-rules="MAP apps.crp.to 127.0.0.1" \
      --ignore-certificate-errors-spki-list="$(cat $ROOT/devcert/apps.crp.to.spki)" \
      --user-data-dir=$PROFILE --no-first-run --new-window https://apps.crp.to:8443/ > $ROOT/logs/webapp-chromium.log 2>&1 < /dev/null &
    echo "opened https://apps.crp.to:8443 on :10" ;;
  shot) DISPLAY=:10 import -window root -resize 60% /tmp/box-screen.png && echo /tmp/box-screen.png ;;
  stop)
    pkill -f "serve-docs.js $EDGE/docs"; for p in $(pgrep -f "user-data-dir=$PROFILE"); do kill $p 2>/dev/null; done; echo stopped ;;
  *) echo "usage: $0 build | serve | browser | shot | stop"; exit 1 ;;
esac
echo "$(date -Is) webapp.sh ${1:-}" >> $ROOT/steps.log
