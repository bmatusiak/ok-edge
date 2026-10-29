#!/bin/bash
# The user's server (mcp-server/, wrangler dev) on the box, by its pid file - never by `pkill -f`, which matches the
# ssh command line that runs it and kills the caller.
#   [HTTPS=1] tools/box/server.sh start|stop|restart|status|test
# HTTPS=1: https://apps.crp.to:8787 with the dev certificate, so the web app it serves can reach a key (M2 testing).
# start: npm run server:dev in its own session (log ~/project/onlykey/logs/server-dev.log), waits for "Ready on".
# test:  the room and MCP tests against it (mcp-server/test/rooms.test.js, mcp.test.js); HTTPS=1 for a server started so.
# wrangler dev does not reload code synced from Windows reliably: restart after a sync.
source ~/.nvm/nvm.sh >/dev/null
cd ~/project/onlykey/ok-edge || exit 1
LOG=~/project/onlykey/logs/server-dev.log
PID=/tmp/okedge-server.pid

running() { [ -s "$PID" ] && kill -0 "$(cat "$PID")" 2>/dev/null; }

stop() {
  if running; then
    kill -- -"$(cat "$PID")" 2>/dev/null || kill "$(cat "$PID")"
    for _ in $(seq 1 20); do running || break; sleep 0.5; done
    echo "stopped $(cat "$PID")"
  else
    echo "not running"
  fi
  rm -f "$PID"
}

start() {
  running && { echo "running $(cat "$PID")"; return; }
  if [ "${HTTPS:-}" = 1 ]; then
    # the web app reaches a key only from a secure page on a site the key allows: serve as https://apps.crp.to:8787
    # with the box's dev certificate (devcert.sh; Chromium maps apps.crp.to to this box)
    C=~/project/onlykey/devcert
    setsid npx --yes wrangler@4.153.0 dev --ip 0.0.0.0 --port 8787 --local-protocol https --var 'SEALED_IDENTITIES:*' \
      --https-key-path "$C/apps.crp.to.key" --https-cert-path "$C/apps.crp.to.crt" > "$LOG" 2>&1 < /dev/null &
  else
    setsid npm run server:dev > "$LOG" 2>&1 < /dev/null &
  fi
  echo $! > "$PID"
  for _ in $(seq 1 90); do grep -qE "Ready on|✘" "$LOG" && break; sleep 2; done
  grep -E "Ready on|✘" "$LOG" | head -3
}

case "${1:-status}" in
  start) start ;;
  stop) stop ;;
  restart) stop; start ;;
  status) running && echo "running $(cat "$PID")" || echo "not running" ;;
  # the room and MCP tests; a server started HTTPS=1 is reached over loopback, its dev certificate not checked (it names
  # apps.crp.to, not 127.0.0.1) - this run only, never the browser's
  test)
    if [ -n "$HTTPS" ]; then export OKS_URL=https://127.0.0.1:8787 NODE_TLS_REJECT_UNAUTHORIZED=0; else export OKS_URL=http://127.0.0.1:8787; fi
    timeout 180 node --test --test-timeout=30000 mcp-server/test/rooms.test.js mcp-server/test/mcp.test.js 2>&1 | grep -E "^✔|^✖|^ℹ (tests|pass|fail)|AssertionError" ;;
  *) echo "usage: $0 start|stop|restart|status|test"; exit 1 ;;
esac
