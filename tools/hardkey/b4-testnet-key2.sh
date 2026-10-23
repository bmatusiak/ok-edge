#!/usr/bin/env bash
# ok-edge B4 step 2, on the box, TESTNET key 2 (DEBUG Edge build) over USB - no phone: this computer is the host.
#   setup (the agent's certificate, two presses; y to keep) -> budget (y, the press) -> exec: a signed commit in a
#   scratch repo -> receipt -> end -> the chain read back. Presses go through the key's debug console (edge-drive.js);
#   automation is for the testnet only.
source ~/.nvm/nvm.sh >/dev/null 2>&1
export NODE_PATH=~/project/onlykey/onlykey-testing/node_modules     # node-hid: the lib keeps it optional, the kit has it
export CONSOLE_LINE=~/project/onlykey/release-3.1.0-test/tools/console-line.js
LIB=~/project/onlykey/node-onlykey-lib/cli/index.js
D="node $HOME/project/onlykey/fw-edge/edge-drive.js $LIB"
R=/tmp/b4-scratch
step() { echo; echo "== $(date +%T) $*"; }
(cd "$(dirname "$CONSOLE_LINE")" && node console-line.js 1111111 >/dev/null 2>&1); sleep 5

step "1. setup (testnet identity)"
$D edge --test-mode setup --ssh ssh://agent@zbox-testnet --gpg "Edge Testnet (zbox) <testnet@example.invalid>" 2>&1 | grep -av --line-buffered "^DEBUG"

step "2. scratch repo"
rm -rf $R && git init -q $R && git -C $R -c user.name="Edge Testnet (zbox)" -c user.email=testnet@example.invalid commit -q --allow-empty -m "b4 testnet scratch"
git -C $R log --oneline -1

step "3. budget"
out=$($D edge --test-mode budget --reason "B4 testnet: sign one commit" --gpg 1 --ssh 0 --ttl 30 2>&1); echo "$out" | grep -av "^DEBUG"
H=$(echo "$out" | grep -o 'head = [0-9a-f]\{64\}' | tail -1 | cut -c8-); echo "budget head: ${H:-none}"
[ -n "$H" ] || { echo "B4-TESTNET-STOPPED: no budget"; exit 1; }

step "4. exec: a signed commit"
out=$($D edge --test-mode exec --head $H --intent "sign: b4 scratch" -- git -C $R -c user.name="Edge Testnet (zbox)" -c user.email=testnet@example.invalid commit --amend --no-edit -S 2>&1); echo "$out" | grep -av "^DEBUG"
seq=$(echo "$out" | grep -o 'receipt owed for #[0-9]*' | grep -o '[0-9]*$' | tail -1); echo "owed: #${seq:-none}"
git -C $R cat-file -p HEAD | grep -c "^gpgsig" | sed 's/^/gpgsig headers on the commit: /'

step "5. receipt"
[ -n "$seq" ] && $D edge --test-mode receipt $seq --msg "sign: b4 scratch" 2>&1 | grep -av --line-buffered "^DEBUG"

step "6. end"
$D edge --test-mode end 2>&1 | grep -av --line-buffered "^DEBUG"

step "7. the chain, read back"
node $LIB edge --test-mode blocks 2>&1 | grep -av --line-buffered "^DEBUG"
echo B4-TESTNET-DONE
