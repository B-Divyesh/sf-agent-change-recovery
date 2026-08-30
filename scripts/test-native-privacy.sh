#!/bin/sh
# @claim:local-privacy
set -eu

command -v strace >/dev/null 2>&1 || {
  echo "strace is required to observe the native capture process boundary" >&2
  exit 1
}

proof_dir="$(mktemp -d)"
trap 'rm -rf "$proof_dir"' EXIT HUP INT TERM
cargo test --manifest-path src-tauri/Cargo.toml --no-run --message-format=json >"$proof_dir/build.json"
test_binary="$(python3 - "$proof_dir/build.json" <<'PY'
import json,sys
for line in open(sys.argv[1], encoding='utf-8'):
    try: item=json.loads(line)
    except json.JSONDecodeError: continue
    if item.get('reason') == 'compiler-artifact' and item.get('profile',{}).get('test') and item.get('target',{}).get('name') == 'change_recovery_ledger_lib':
        executable=item.get('executable')
        if executable:
            print(executable)
            break
PY
)"
test -n "$test_binary"

strace -f -qq -e trace=%network -o "$proof_dir/network.trace" \
  "$test_binary" --exact tests::claim_local_privacy --nocapture

if test -s "$proof_dir/network.trace"; then
  echo "native capture attempted a network syscall:" >&2
  cat "$proof_dir/network.trace" >&2
  exit 1
fi
echo "native privacy verified: capture completed with zero network syscalls"
