#!/usr/bin/env bash
# SYNC REDESIGN PHASE 2 ON THE BOX (PROPOSAL-sync-and-identity.md), TESTNET key 2 on USB: the CLI's own Edge history
# reaches the web app through the identity's room - no Bluetooth, nothing typed, no key request for the history itself.
#   1. key 2 unlocked: the kit PIN on its buttons (hardkey-press.js), only when it says locked
#   2. the CLI's agent identity for key 2 (setup, once) and a TEST budget of its own: budget -> a signed commit in a
#      scratch repo -> its receipt -> end. fw-edge/edge-drive.js answers the y/N and presses through the key's debug
#      console - it refuses anything without --test-mode (automation is for test budgets only)
#   3. edge --test-mode status files the CLI's log in the identity bucket's edge-logs-test store: its keys counted
#   4. the web app built (dev: testing mode), the local server restarted (wrangler reads the asset list at start),
#      Chromium on the key's site; key 2 through to the open bucket (webapp-edge-budget.sh KEY=hard STOP_AFTER=bucket)
#   5. the CLI trades with the web app in the room (bucket sync --server, one-shot)
#   6. the Edge tab: the page's own lines say what it took from the bucket, then its budget list
#   SKIP_CLI=1    no new CLI budget (steps 1-2)
#   SKIP_BUILD=1  the web app and the server as they are
source ~/.nvm/nvm.sh >/dev/null 2>&1
P=~/project/onlykey
cd $P/ok-edge || exit 1
# node-hid: the lib keeps it optional and the box's lib checkout has none - the kit's (as b4-testnet-key2.sh)
export NODE_PATH=$P/onlykey-testing/node_modules
export CONSOLE_LINE=$P/release-3.1.0-test/tools/console-line.js
LIB=$P/node-onlykey-lib/cli/index.js
D="timeout 240 node $P/fw-edge/edge-drive.js $LIB"
R=/tmp/phase2-scratch
PC_LOG=/tmp/phase2-page.log
say() { echo "== $(date +%T.%3N) $*"; }
nodebug() { grep -av --line-buffered "^DEBUG"; }
keystate() { timeout 30 node $LIB status 2>&1 | awk '$1 == "state" {print $2}'; }

if [ -z "$SKIP_CLI" ]; then
  if [ "$(keystate)" != unlocked ]; then
    say "1. key 2 is $(keystate) - the kit PIN on its buttons"
    timeout 70 node tools/box/hardkey-press.js 1 1 1 1 1 1 1 2>&1 | tail -1
    for _ in $(seq 1 20); do [ "$(keystate)" = unlocked ] && break; sleep 2; done
    [ "$(keystate)" = unlocked ] || { say "PHASE2-STOPPED: the key did not unlock"; exit 1; }
  fi
  say "1. key 2 is unlocked"

  if timeout 90 node $LIB edge --test-mode status 2>&1 | grep -q "keeps no agent identity"; then
    say "2. the CLI's agent identity for key 2 (setup)"
    $D edge --test-mode setup --ssh ssh://agent@zbox-testnet --gpg "Edge Testnet (zbox) <testnet@example.invalid>" 2>&1 | nodebug
  fi
  rm -rf $R && git init -q $R && git -C $R -c user.name="Edge Testnet (zbox)" -c user.email=testnet@example.invalid commit -q --allow-empty -m "phase 2 scratch"
  say "2. a CLI budget of its own"
  $D edge --test-mode budget --reason "Phase 2: the CLI's own budget" --gpg 1 --ssh 0 --ttl 30 2>&1 | nodebug | tee /tmp/phase2-budget.out
  H=$(grep -o 'head = [0-9a-f]\{64\}' /tmp/phase2-budget.out | tail -1 | cut -c8-)
  [ -n "$H" ] || { say "PHASE2-STOPPED: no budget"; exit 1; }
  $D edge --test-mode exec --head $H --intent "sign: phase 2 scratch" --receipt "sign: phase 2 scratch" -- git -C $R -c user.name="Edge Testnet (zbox)" -c user.email=testnet@example.invalid commit --amend --allow-empty --no-edit -S 2>&1 | nodebug
  say "   gpgsig headers on the commit: $(git -C $R cat-file -p HEAD | grep -c '^gpgsig')"
  $D edge --test-mode end 2>&1 | nodebug
fi

say "3. the CLI's log in the identity bucket"
timeout 90 node $LIB edge --test-mode status 2>&1 | nodebug | tail -4
node -e '
const fs = require("fs"), dir = require("os").homedir() + "/.onlykey-js/buckets/test";
for (const f of fs.readdirSync(dir).filter((f) => /^[0-9a-f]{32}\.json$/.test(f))) {
  const s = (JSON.parse(fs.readFileSync(`${dir}/${f}`, "utf8")).stores || {})["edge-logs-test"] || {};
  const keys = Object.keys(s).filter((k) => s[k] && !s[k].archived);
  if (keys.length) console.log(`   ${f.slice(0, 8)}…: edge-logs-test ${keys.length} keys, ${keys.filter((k) => k.includes(".links.")).length} links block(s), ${keys.filter((k) => k.includes(".open.")).length} opening(s)`);
}'

if [ -z "$SKIP_BUILD" ]; then
  say "4. the web app built, the server restarted, Chromium on the key's site"
  bash tools/box/webapp.sh build || exit 1
  HTTPS=1 bash tools/box/server.sh restart
  bash tools/box/webapp.sh site
  sleep 8
fi
say "4. key 2 in the web app, through to the open bucket"
KEY=hard STOP_AFTER=bucket bash tools/box/webapp-edge-budget.sh || { say "PHASE2-STOPPED: the bucket did not open"; exit 1; }
# the page's own lines from here on (its room, the trade's answers, the Edge copy's take)
timeout 600 node tools/box/page-console.js 590 --filter='room|shared records|\[edge\] (take|copy|verify|sync)|bucket|exception|error' > $PC_LOG 2>&1 &
PCP=$!
trap 'kill $PCP 2>/dev/null' EXIT
# the page joins its room as the bucket opens (before this listener): the CLI's sync below names it when it is there
sleep 5

say "5. the CLI trades with the web app in the room"
NODE_EXTRA_CA_CERTS=$P/devcert/ca.crt timeout 300 node $LIB --test-mode bucket sync --server https://localhost:8787 --test-mode 2>&1 | nodebug | tail -12

say "6. the Edge tab"
timeout 20 node tools/box/page-click.js "Menu" wait:2 "Edge" 2>&1 | tail -1
for _ in $(seq 1 120); do grep -q 'shared records: .*taken\|shared records: nothing taken\|shared records: not read' $PC_LOG && break; sleep 1; done
grep -a 'shared records\|\[edge\] take' $PC_LOG | tail -4 | sed 's/^/   page: /'
sleep 5
timeout 30 node tools/box/page-click.js --text 4000 2>&1 | grep -iv '^TEST BUILD\|^Testing mode' | sed -n '/^Budgets/,/Edge Management/p' | head -30 | cut -c1-200
grep -q 'shared records: [0-9]* link(s) taken' $PC_LOG && echo PHASE2-DONE || echo PHASE2-NOT-TAKEN
