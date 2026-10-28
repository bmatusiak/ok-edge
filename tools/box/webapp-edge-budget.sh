#!/usr/bin/env bash
# The web app's Edge budget, end to end, on the box: Chromium (webapp.sh site) on the gadget soft key (softkey-gadget.sh),
# driven as a person would - reload, the identity check, open the bucket (its code entered on the key's buttons), the
# Edge tab, a test budget request, Approve, the press - then what the page says. Every step waits for what it needs on
# screen (page-click.js --labels) and says what it saw when it does not come.
#   bash tools/box/webapp-edge-budget.sh
#   FRESH=1 ...   the browser forgets its Edge copy first (a new device: the copy anchors at the key's checkpoint)
#   CONSOLE=/tmp/pc.log ...   the page's own [edge] lines kept in that file across the reload (page-console.js reloads
#                 over its own DevTools connection, so the subscription survives it; a reload from outside drops it)
source ~/.nvm/nvm.sh >/dev/null 2>&1
P=~/project/onlykey
cd $P/ok-edge || exit 1
C() { timeout 20 node tools/box/page-click.js "$@" 2>&1 | tail -1; }
labels() { timeout 10 node tools/box/page-click.js --labels 2>&1 | tail -1; }
press() { (cd $P/node-onlykey-emulator/emulator && timeout 30 node bin/press.js --socket=/tmp/okemu-webapp.sock --quiet "$@" 2>&1 | tail -1); }
L=
waitfor() {
  for _ in $(seq 1 ${2:-60}); do L=$(labels); echo "$L" | grep -q "$1" && return 0; sleep 0.5; done
  echo "!! never saw: $1 - the screen: $(echo "$L" | cut -c1-240)"; return 1
}
say() { echo "== $(date +%T) $*"; }

[ -n "$FRESH" ] && say "a new copy: forgetting $(timeout 10 node tools/box/page-click.js --eval '(() => { const k = Object.keys(localStorage).filter(k => k.includes("edge.mirror.")); k.forEach(x => localStorage.removeItem(x)); return k.length; })()' 2>&1 | tail -1) stored copy"
say "reload"
if [ -n "$CONSOLE" ]; then
  (timeout 900 node tools/box/page-console.js 890 --reload --filter='edge|copy|checkpoint|anchor|exception|error' > "$CONSOLE" 2>&1 &)
  sleep 2
else
  w=$(DISPLAY=:10 xdotool search --name "ok-edge - Chromium" | head -1)
  DISPLAY=:10 xdotool windowactivate --sync "$w" key ctrl+shift+r
fi
waitfor '\[Continue\]\|\[Decrypt Bucket\]\|Locked' || exit 1
# the testnet soft key's PIN (1234561), on its buttons, when it has locked itself
# then back to the page: it asks its key again when its window comes back to the front (useWebKey), never on a timer
echo "$L" | grep -q 'Locked' && {
  say "locked - the PIN on the key's buttons, then back to the page"
  press 1 2 3 4 5 6 1
  sleep 1
  timeout 10 node tools/box/page-click.js --eval 'window.dispatchEvent(new Event("focus")); 1' >/dev/null 2>&1
  waitfor '\[Continue\]\|\[Decrypt Bucket\]' || exit 1
}
echo "$L" | grep -q '\[Continue\]' && { C "Continue" >/dev/null; waitfor '\[Decrypt Bucket\]' || exit 1; }
say "open the bucket"
C "Decrypt Bucket" >/dev/null
waitfor 'Press the key' || exit 1
code=$(echo "$L" | sed -E "s/.*Opening this identity.s bucket \| //" | grep -oE '[1-6]' | head -3 | tr '\n' ' ')
say "its code: $code"
# shellcheck disable=SC2086
press $code
waitfor '\[Menu\]' || exit 1
say "Edge tab, a test budget request"
C "Menu" wait:2 "Edge" >/dev/null
# the test button is disabled while the tab's own first sync is with the key (edge.busy): wait until it is not
C "Open Edge Management" wait:2 >/dev/null
enabled() { timeout 10 node tools/box/page-click.js --eval '[...document.querySelectorAll("[role=button],button")].some(e => e.textContent.trim() === "Agent: request a budget" && e.getAttribute("aria-disabled") !== "true" && !e.disabled)' 2>&1 | tail -1; }
for _ in $(seq 1 120); do [ "$(enabled)" = true ] && break; sleep 1; done
say "the tab is idle ($(enabled)) - requesting"
C "Agent: request a budget" wait:2 "▼ Edge Management" wait:2 >/dev/null
waitfor '\[Approve\]' 40 || exit 1
say "the sheet: $(echo "$L" | sed 's/.*Presses | //' | cut -c1-200)"
# the press waits for the key: a press the firmware is not waiting for is lost (an unlocked key types slot 1), and over
# the tunnel the grant reaches the key seconds after the page says so. press.js --after holds it until the grant's own
# debug line (its seed, as the kit's Edge-over-WebAuthn test waits), then 800 ms. The key's whole output goes to the log.
PL=/tmp/webapp-grant-press.log
(cd $P/node-onlykey-emulator/emulator && timeout 300 node bin/press.js --socket=/tmp/okemu-webapp.sock --after='Generating random number of size = 32' --after-timeout=290000 1 > $PL 2>&1 &)
sleep 2
C "Approve" >/dev/null
# Approve runs the strict copy check first (its own key reads, ~6 s each over the tunnel)
waitfor 'Press the key to confirm\|edge: ' 240 || exit 1
echo "$L" | grep -q 'edge: ' && { say "refused: $(echo "$L" | grep -o 'edge: [^|]*')"; exit 1; }
say "the key waits for its press"
for _ in $(seq 1 60); do grep -q '^press: ' $PL && break; sleep 1; done
say "$(grep '^press: ' $PL | tail -1)"
sleep 10
say "the Edge tab now:"
timeout 30 node tools/box/page-click.js --text 3000 2>&1 | grep -iv '^TEST BUILD\|^Testing mode' | sed -n '/^Budgets/,$p' | head -14 | cut -c1-200
