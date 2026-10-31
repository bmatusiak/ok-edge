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
C() { timeout 120 node tools/box/page-click.js "$@" 2>&1 | tail -1 | cut -c1-200; }
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
# step "<outcome regex>" <clicks...>: the presser listens first, then the clicks, then the outcome (or its failure).
# SHOW='<regex>' prints the console lines that match as they come; LIFE=<s> is the step's watchdog (default 90).
# "?<text>" as the outcome: the STATE wanted, on the page (Brad, 2026-10-31: "you dont have an end detection when the
# state you want is there or not") - page-click waits for that text by the page's own changes, under the same watchdog,
# and the presser is stopped when it is there. A console regex is for outcomes the page does not show.
step() {
  local until="$1"; shift
  local log; log=$(mktemp)
  local state="" untilArgs=(--until "$until")
  [ "${until#\?}" != "$until" ] && { state="$until"; untilArgs=(); }
  node tools/box/page-presser.js --approve "${untilArgs[@]}" --life "${LIFE:-90}" --show "${SHOW:-failed|refused|Not made|did not}" > "$log" 2>&1 &
  local p=$!
  if ! waitline "$log" 'listening' "$p" > /dev/null; then sed 's/^/   /' "$log"; rm -f "$log"; return 1; fi
  [ $# -gt 0 ] && C "$@"
  local code
  if [ -n "$state" ]; then
    local got; got=$(timeout $(( ${LIFE:-90} + 10 )) node tools/box/page-click.js --life "${LIFE:-90}" "$state" 2>&1 | tail -1)
    kill $p 2>/dev/null; wait $p 2>/dev/null
    sed 's/^/   /' "$log"; echo "   $got"
    case "$got" in there:*) code=0;; *) code=1;; esac
  else
    # its lines as they come (a cutoff from outside used to lose them all), ending with the presser
    tail -n +1 --pid=$p -f "$log" | sed 's/^/   /'
    wait $p; code=$?
  fi
  rm -f "$log"
  return $code
}
# the PIN on the soft key's keypad, and the login that follows - ends on the identity check's own verdict
login() {
  C "Menu" "This Key" > /dev/null
  # the end of a login: the room joined (or why not) - a card login logs no [identity] verdict; a failure says "did not open"
  step '\[room\] (joined|not joined)|\[identity\] .*(proven|a manual login)|did not open' "Button 1" "Button 1" "Button 1" "Button 1" "Button 1" "Button 1" "Button 1"
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
  C "Menu" "Edge" "▲ Edge Management" "Agent: request a budget" "Close Edge Management" > /dev/null
  # each step ends on the state it is for: the budget live, then each use counted, then the budget sealed
  step '?Active' "Approve" || return 1
  local i
  for i in 1 2; do
    step "?$i of 3 uses spent" "▲ Edge Management" "Agent: a sign the budget pays" "Close Edge Management" || return 1
  done
  step '\[edge\] sealed #[0-9]+: budget [0-9]+ ended' "▲ Edge Management" "Agent: a sign the budget pays" "Close Edge Management" || return 1
  timeout 20 node tools/box/page-click.js --text 4000 | sed -n '/^Past budgets/,$p' | head -12
}
