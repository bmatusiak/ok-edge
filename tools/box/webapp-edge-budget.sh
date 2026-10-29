#!/usr/bin/env bash
# The web app's Edge budget, end to end, on the box: Chromium (webapp.sh site) on the gadget soft key (softkey-gadget.sh),
# driven as a person would - reload, the identity check, open the bucket (its code entered on the key's buttons), the
# Edge tab, a test budget request, Approve, the press - then what the page says. Every step waits for what it needs on
# screen (page-click.js --labels) and says what it saw when it does not come.
#   bash tools/box/webapp-edge-budget.sh
#   FRESH=1 ...   the browser forgets its Edge copy first (a new device: the copy anchors at the key's checkpoint)
#   NO_REQUEST=1 ...   no new budget: the signs below use the one already open (every budget is finished)
#   SIGNS=3 ...   then that many signs the budget pays ("Agent: a sign the budget pays"), each with its receipt; the
#                 last use's receipt ends the budget
#   NO_BUCKET=1 ...   a first login here: the page's sealed buckets forgotten, so the key proves the identity first
#   STOP_AFTER=bucket ...   end once the bucket is open (the login's timeline: tools/box/timeline.js)
#   CONSOLE=/tmp/pc.log ...   the page's own [edge] lines kept in that file across the reload (page-console.js reloads
#                 over its own DevTools connection, so the subscription survives it; a reload from outside drops it)
source ~/.nvm/nvm.sh >/dev/null 2>&1
P=~/project/onlykey
cd $P/ok-edge || exit 1
C() { timeout 20 node tools/box/page-click.js "$@" 2>&1 | tail -1; }
labels() { timeout 10 node tools/box/page-click.js --labels 2>&1 | tail -1; }
press() { (cd $P/node-onlykey-emulator/emulator && timeout 30 node bin/press.js --socket=/tmp/okemu-webapp.sock --quiet "$@" 2>&1 | tail -1); }
L=
# the identity check's bucket button: Decrypt Bucket (one kept here) or Create Bucket (none)
BUCKET_BUTTON='\[Decrypt Bucket\]\|\[Create Bucket\]'
waitfor() {
  for _ in $(seq 1 ${2:-60}); do L=$(labels); echo "$L" | grep -q "$1" && return 0; sleep 0.5; done
  echo "!! never saw: $1 - the screen: $(echo "$L" | cut -c1-240)"; return 1
}
# the time to the ms: tools/box/timeline.js lines these steps up with the page's own [timeline] lines
say() { echo "== $(date +%T.%3N) $*"; }

# THE KEY UNLOCKED BEFORE THE PAGE LOADS: a page that loads on a locked key shows This Key "Locked", and nothing there
# asks the key again (only Log in and the PIN screen arm the page's key check) - 2026-10-28, after a soft key restart.
# So the key's own state, read over USB (the lib CLI's status, read-only), and the PIN on its buttons only when it says
# locked: the testnet soft key's PIN (1234561).
keystate() { (cd $P/node-onlykey-lib && timeout 30 node cli/index.js status 2>&1 | awk '$1 == "state" {print $2}'); }
if [ "$(keystate)" != unlocked ]; then
  say "the key is $(keystate) - the PIN on its buttons"
  press 1 2 3 4 5 6 1
  for _ in $(seq 1 20); do [ "$(keystate)" = unlocked ] && break; sleep 2; done
  [ "$(keystate)" = unlocked ] || { say "the key did not unlock"; exit 1; }
fi
say "the key is unlocked"
# NO_BUCKET=1: the page forgets the sealed buckets it kept (okrn.bucket.*) - a first login on this device: nothing to
# open, so the key proves the identity by signing a fresh challenge before a new bucket is sealed (lib plugins/identity)
[ -n "$NO_BUCKET" ] && say "no bucket kept: forgetting $(timeout 10 node tools/box/page-click.js --eval '(() => { const k = Object.keys(localStorage).filter(k => k.startsWith("okrn.bucket.")); k.forEach(x => localStorage.removeItem(x)); return k.length; })()' 2>&1 | tail -1) sealed bucket(s)"
[ -n "$FRESH" ] && say "a new copy: forgetting $(timeout 10 node tools/box/page-click.js --eval '(() => { const k = Object.keys(localStorage).filter(k => k.includes("edge.mirror.")); k.forEach(x => localStorage.removeItem(x)); return k.length; })()' 2>&1 | tail -1) stored copy"
say "reload"
if [ -n "$CONSOLE" ]; then
  # its pid kept and stopped when this run ends: a listener left behind writes into the next run's log twice over
  timeout 900 node tools/box/page-console.js 890 --reload --filter='edge|keybusy|timeline|identity|bucket|copy|checkpoint|anchor|exception|error' > "$CONSOLE" 2>&1 &
  PC=$!
  trap 'kill $PC 2>/dev/null' EXIT
  sleep 2
else
  w=$(DISPLAY=:10 xdotool search --name "ok-edge - Chromium" | head -1)
  DISPLAY=:10 xdotool windowactivate --sync "$w" key ctrl+shift+r
fi
waitfor "\[Continue\]\|$BUCKET_BUTTON\|Locked" || exit 1
# the testnet soft key's PIN (1234561), on its buttons, when it has locked itself
# then back to the page: it asks its key again when its window comes back to the front (useWebKey), never on a timer
echo "$L" | grep -q 'Locked' && {
  say "locked - the PIN on the key's buttons, then back to the page"
  press 1 2 3 4 5 6 1
  # back to the page as a person comes back to it - again every 5 s while it still says Locked (a minute at most): a
  # focus that comes before the key has finished unlocking is answered "locked", and the page asks only on focus
  # (2026-10-28: one nudge 1 s after the PIN, right after the key restarted, left the page Locked on an unlocked key)
  for _ in $(seq 1 12); do
    sleep 5
    timeout 10 node tools/box/page-click.js --eval 'window.dispatchEvent(new Event("focus")); 1' >/dev/null 2>&1
    waitfor "\[Continue\]\|$BUCKET_BUTTON" 8 >/dev/null && break
  done
  waitfor "\[Continue\]\|$BUCKET_BUTTON" || exit 1
}
say "the page shows $(echo "$L" | grep -o "\[Continue\]\|$BUCKET_BUTTON" | head -1)"
echo "$L" | grep -q '\[Continue\]' && { say "Continue"; C "Continue" >/dev/null; waitfor "$BUCKET_BUTTON" || exit 1; say "the page shows $(echo "$L" | grep -o "$BUCKET_BUTTON" | head -1)"; }
# a bucket this device keeps opens (Decrypt Bucket); with none kept the check offers Create Bucket - a first login here
say "open the bucket"
C "$(echo "$L" | grep -o 'Decrypt Bucket\|Create Bucket' | head -1)" >/dev/null
# each code the page asks for, as a person reads it off the sheet (HostChallengeSheet: "Press the key | <what> | On your
# OnlyKey, press these buttons in order: | 1 | 2 | 5"): the bucket's derive, and on a first login - no sealed bucket to
# open - the identity's proof before it (lib plugins/identity verify), until the app is open
for n in 1 2 3; do
  waitfor 'Press the key\|\[Menu\]' || exit 1
  echo "$L" | grep -q '\[Menu\]' && break
  what=$(echo "$L" | sed -E 's/.*Press the key \| ([^|]*) \|.*/\1/' | cut -c1-60)
  code=$(echo "$L" | sed -E 's/.*press these buttons in order: \| //' | grep -oE '[1-6]' | head -3 | tr '\n' ' ')
  say "the page asks for a code ($what): $code"
  # shellcheck disable=SC2086
  press $code
  # the next prompt, or the app: wait for this one to go (its code would be pressed twice)
  for _ in $(seq 1 60); do L=$(labels); echo "$L" | grep -q "$what" || break; sleep 0.5; done
done
waitfor '\[Menu\]' || exit 1
say "the bucket is open"
[ "$STOP_AFTER" = bucket ] && exit 0
say "Edge tab, a test budget request"
C "Menu" wait:2 "Edge" >/dev/null
# THE TESTING BUTTONS LIVE IN EDGE MANAGEMENT, and one there is disabled while the tab works with the key (edge.busy).
# A button that is not on the screen is not a busy tab (2026-10-28: the panel closed after the request read as "never
# idle" for 10 minutes): button() tells absent from disabled, and idle() opens the panel when it is closed - its header
# toggles, so only then.
button() { timeout 10 node tools/box/page-click.js --eval "(() => { const b = [...document.querySelectorAll('[role=button],button')].find(e => e.textContent.trim() === '$1'); return !b ? 'absent' : (b.getAttribute('aria-disabled') === 'true' || b.disabled) ? 'disabled' : 'enabled'; })()" 2>&1 | tail -1 | tr -d '"'; }
panel() { labels | grep -q '▼ Edge Management' || C "Open Edge Management" wait:2 >/dev/null; }
idle() {
  local s=
  for _ in $(seq 1 ${2:-120}); do
    s=$(button "$1"); [ "$s" = enabled ] && return 0
    [ "$s" = absent ] && panel
    sleep 1
  done
  say "never usable: \"$1\" (last seen: $s)"; return 1
}
budget() { timeout 30 node tools/box/page-click.js --text 3000 2>&1 | grep -iv '^TEST BUILD\|^Testing mode' | sed -n '/^Budgets/,/Edge Management/p' | head -${1:-14} | cut -c1-200; }
if [ -z "$NO_REQUEST" ]; then
idle "Agent: request a budget" || exit 1
say "the tab is idle - requesting"
C "Agent: request a budget" wait:2 "▼ Edge Management" wait:2 >/dev/null
waitfor '\[Approve\]' 40 || exit 1
say "the sheet: $(echo "$L" | sed 's/.*Presses | //' | cut -c1-200)"
waits() { [ -n "$CONSOLE" ] && grep -ac 'the key waits for its press' "$CONSOLE" 2>/dev/null || echo 0; }
asked=$(waits)
C "Approve" >/dev/null
# Approve runs the strict copy check first (its own key reads, ~6 s each over the tunnel)
waitfor 'Press the key to confirm\|edge: ' 240 || exit 1
echo "$L" | grep -q 'edge: ' && { say "refused: $(echo "$L" | grep -o 'edge: [^|]*')"; exit 1; }
# as a person presses: after reading the prompt. Over the tunnel the page asks as the grant's ceremony starts, before
# the request is on the key, and a press the firmware is not waiting for is lost (an unlocked key types slot 1); the
# key waits 20 s. (This soft key prints no debug lines, so press.js --after has no cue here.)
if [ -n "$CONSOLE" ]; then
  # the page's own word that the request is on the key (src/keyBusy.ts, after the grant's first ceremony): only then a
  # press can land - over the slow tunnel the lib waits out the key's last reply first, and 3 s came before the request
  for _ in $(seq 1 180); do [ "$(waits)" -gt "$asked" ] && break; sleep 0.5; done
  say "the page says the key waits for its press ($(waits) > $asked) - pressing"
  sleep 0.8
else
  say "the key asks for its press - pressing in 3 s"
  sleep 3
fi
press 1
waitfor 'uses spent' 240 || exit 1
say "the budget is open:"
budget
fi
for i in $(seq 1 ${SIGNS:-0}); do
  idle "Agent: a sign the budget pays" 600 || exit 1
  say "sign $i of $SIGNS"
  C "Agent: a sign the budget pays" >/dev/null
  sleep 2
  # the sign, its receipt and the tab's sync after it: the button comes back when they are done
  idle "Agent: a sign the budget pays" 600 || exit 1
  say "sign $i done"
  timeout 10 node tools/box/page-click.js --text 3000 2>&1 | grep -o 'edge: .*' | head -1 | sed 's/^/   refused: /'
  budget 8 | grep -i 'uses\|spent\|ended\|Active\|No budget' | head -3 | sed 's/^/   /'
done
say "the Edge tab now:"
budget
