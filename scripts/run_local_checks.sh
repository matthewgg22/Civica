#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "[1/4] Python syntax compile checks"
python3 - <<'PY'
from pathlib import Path

python_paths = [Path("backend"), Path("tests")]
checked = 0
for root in python_paths:
    if not root.exists():
        continue
    for path in root.rglob("*.py"):
        source = path.read_text(encoding="utf-8")
        compile(source, str(path), "exec")
        checked += 1

print(f"Compiled {checked} Python files")
PY

echo "[2/4] Built-in unittest smoke checks"
python3 -m unittest discover -s tests -p 'test_*_unittest.py' -v

echo "[3/4] No print/debug telemetry in app+backend sources"
if rg -n '\bprint\(|debugPrint\(|NSLog\(' "WeVote Information Page" backend -g '!build/**' >/tmp/votenow_print_hits.txt; then
  echo "Disallowed print/debug telemetry found:"
  cat /tmp/votenow_print_hits.txt
  exit 1
fi

if [[ "${RUN_XCODEBUILD:-0}" == "1" ]]; then
  echo "[4/4] Optional Xcode build check"
  set -o pipefail
  xcodebuild -project "VoteNow.xcodeproj" -scheme "VoteNow" -configuration Debug -destination "generic/platform=iOS" build \
    2>&1 | rg -n "BUILD SUCCEEDED|BUILD FAILED|error:|warning:"
else
  echo "[4/4] Optional Xcode build check skipped (set RUN_XCODEBUILD=1 to enable)"
fi

if [[ "${RUN_REPS_DATA_CHECKS:-0}" == "1" ]]; then
  echo "[5/5] Optional reps data checks"
  ./scripts/run_reps_data_checks.sh
else
  echo "[5/5] Optional reps data checks skipped (set RUN_REPS_DATA_CHECKS=1 to enable)"
fi
