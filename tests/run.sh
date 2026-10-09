#!/usr/bin/env bash
# Runs the unit tests (Node). Add --sim to also run the browser simulations (Python + Playwright + Chromium).
# Usage: bash tests/run.sh [--sim]
cd "$(dirname "$0")/.." || exit 1
fail=0
for t in tests/unit/*.test.js; do
  out=$(node "$t" 2>&1); code=$?
  printf '%-34s %3s pass  %s fail\n' "$t" "$(grep -c '^PASS' <<<"$out")" "$(grep -c '^FAIL' <<<"$out")"
  if [ $code -ne 0 ] || grep -q '^FAIL' <<<"$out"; then fail=1; grep '^FAIL' <<<"$out"; fi
done
echo "--- comedy frequency (simulated, last-loses rule) ---"; node tests/unit/frequency.report.js | head -1
if [ "$1" = "--sim" ]; then
  for s in tests/sim/offline-rounds.py tests/sim/online.py tests/sim/rooms-lore-showhand.py tests/sim/social.py tests/sim/i18n.py; do
    echo "--- $s"; python3 "$s" || fail=1
  done
fi
exit $fail
