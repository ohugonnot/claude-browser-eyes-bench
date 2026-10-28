#!/bin/bash
# Chains the 12 runs in the order given by order.py; stops after 3 consecutive technical failures.
# Runs already present in $RUN_DIR/runs/ are skipped, so an interrupted batch can be resumed.
# Usage: harness/run-all.sh
source "$(dirname "${BASH_SOURCE[0]}")/env.sh"
cd "$RUN_DIR" || exit 1; fails=0
for r in $(python3 "$HARNESS/order.py"); do
  c="${r%-*}"; n="${r#*-}"
  [ -f "runs/$r.json" ] && { echo "skip $r"; continue; }
  "$HARNESS/run-one.sh" "$c" "$n"
  bad=$(node -e 'const s=require(process.argv[1]);const t=(s.exit_code!==0&&!s.killed)||s.is_error===true||s.result_event===null||(s.killed||"").startsWith("timeout");console.log(t?1:0)' "$RUN_DIR/runs/$r.json")
  if [ "$bad" = 1 ]; then fails=$((fails+1)); else fails=0; fi
  [ $fails -ge 3 ] && { echo "STOP: 3 consecutive technical failures"; break; }
done
echo DONE
