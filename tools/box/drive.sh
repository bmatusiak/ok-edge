# Driving the box desktop app's TESTNET soft key, EVENT DRIVEN (Brad, 2026-10-31: "your script should be event based,
# not timer based ... if a timer is used you will always fail"; timers only for inactivity). Sourced:
#   source tools/box/drive.sh;  appup;  C "Menu" "Edge";  step '<outcome regex>' "<click>" ...
# No sleeps: a step starts page-presser.js BEFORE the click that sets it off; the presser presses each sheet the moment
# the app logs it live, and the step ends on the app's own console line for its outcome. page-click waits for a
# control by the page's own changes (MutationObserver). The only timers are inactivity cutoffs.
source ~/.nvm/nvm.sh >/dev/null
cd ~/project/onlykey/ok-edge || return 1
export CDP_PORT=9334
say() { echo "== $(date +%T) $*"; }
# a click (or ?label wait) - its exit status is page-click's: a step that did not happen fails the caller
C() { local out; out=$(timeout 120 node tools/box/page-click.js "$@" 2>&1); local code=$?; echo "$out" | tail -1 | cut -c1-200; return $code; }
# the first line of `file` matching `re`, as it is written (tail -f, no polling); the reader ends with the match -
# with a writer pid, also when the writer ends (a presser that died before its line - "fetch failed", the page not up
# yet - left this waiting for good, 2026-10-31); returns 1 then
waitline() {
  local file="$1" re="$2" writer="$3" tp
  tp=$(mktemp)
  ( tail -n +1 ${writer:+--pid=$writer} -f "$file" & echo $! > "$tp"; wait ) | grep -m1 -E "$re"
  local found=${PIPESTATUS[1]}
  kill "$(cat "$tp")" 2>/dev/null; rm -f "$tp"
  return "$found"
}
# has <label>: a precheck - on screen now? (no wait)
has() { timeout 30 node tools/box/page-click.js --has "$1" > /dev/null 2>&1; }
# step "<goal>" <clicks...> - one move, driven by state (Brad, 2026-10-31: "you have no prechecking on the state when
# you're in the middle of driving"):
#   1. PRECHECK: a goal "?<text>" already on the page - the step is done, nothing clicked;
#   2. the presser listens, then the clicks;
#   3. it ends on the goal showing, a failure newly shown ("Try again"; FAIL=<label>), or its watchdog (LIFE=<s>, 90).
# The goal is a STATE on the page. A console regex is only for an outcome the page does not show AND that only this
# step's own click can cause - a line logged before the step starts is never seen (a finished login waited out its
# watchdog for a "room joined" that had come and gone). SHOW='<regex>' prints matching console lines as they come.
step() {
  local until="$1"; shift
  if [ "${until#\?}" != "$until" ] && has "${until#\?}"; then echo "   already: \"${until#\?}\""; return 0; fi
  local log; log=$(mktemp)
  local untilArgs=(--until "$until")
  [ "${until#\?}" != "$until" ] && untilArgs=(--done "${until#\?}")
  # a failure the page shows ends the step at once: "Try again" (FAIL=<label> for another)
  node tools/box/page-presser.js --approve "${untilArgs[@]}" --fail "${FAIL:-Try again}" --life "${LIFE:-90}" --show "${SHOW:-failed|refused|Not made|did not}" > "$log" 2>&1 &
  local p=$!
  if ! waitline "$log" 'listening' "$p" > /dev/null; then sed 's/^/   /' "$log"; rm -f "$log"; return 1; fi
  # a click that did not happen ends the step now, with page-click's reason - not after the watchdog
  if [ $# -gt 0 ] && ! C "$@"; then kill $p 2>/dev/null; wait $p 2>/dev/null; sed 's/^/   /' "$log"; rm -f "$log"; return 1; fi
  # its lines as they come (a cutoff from outside used to lose them all), ending with the presser
  tail -n +1 --pid=$p -f "$log" | sed 's/^/   /'
  wait $p; local code=$?
  rm -f "$log"
  return $code
}
# logged in: the unlocked key's own page - from wherever the app is (the screen says which move is next)
LOGGED_IN="Slots — Soft Key"
login() {
  if has "$LOGGED_IN"; then echo "   already logged in"; return 0; fi
  if has "Try again"; then step "?$LOGGED_IN" "Try again"; return; fi
  local b; for b in "Decrypt Bucket" "Create Bucket"; do has "$b" && { step "?$LOGGED_IN" "$b"; return; }; done
  has "Button 1" || C "Menu" "This Key" > /dev/null
  step "?$LOGGED_IN" "Button 1" "Button 1" "Button 1" "Button 1" "Button 1" "Button 1" "Button 1"
}
# the app (re)started and its page up (the browser's own target event), then into testing mode
appup() {
  bash tools/box/desktop-test.sh > /dev/null
  local line; line=$(waitline ../logs/desktop-test.log 'DevTools listening on ws://')
  node tools/box/page-ready.js "${line##* }" || return 1
  C "Enter testing mode" > /dev/null
}
# one budget on the open soft key: request, approve + its press, three signs it pays
budget_demo() {
  C "Menu" "Edge" > /dev/null
  # precheck: a live budget is spent, not stacked on; an ask already waiting is approved, not asked again
  if ! has "Active"; then
    has "Approve" || C "▲ Edge Management" "Agent: request a budget" "Close Edge Management" > /dev/null
    step '?Active' "Approve" || return 1
  fi
  # each sign ends on the state it is for: the use counted; the last one, no live budget left (it completed)
  local i
  for i in 1 2; do
    step "?$i of 3 uses spent" "▲ Edge Management" "Agent: a sign the budget pays" "Close Edge Management" || return 1
  done
  step "?No budget. A budget lets an agent use the key a set number of times without a press; you approve it once." \
    "▲ Edge Management" "Agent: a sign the budget pays" "Close Edge Management" || return 1
  timeout 20 node tools/box/page-click.js --text 4000 | sed -n '/^Past budgets/,$p' | head -12
}
