#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "[1/3] Python syntax compile checks"
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

echo "[2/3] Built-in unittest smoke checks"
python3 -m unittest discover -s tests -p 'test_*_unittest.py' -v

if [[ "${RUN_XCODEBUILD:-0}" == "1" ]]; then
  echo "[3/3] Optional Xcode build check"
  set -o pipefail
  xcodebuild -project "VoteNow.xcodeproj" -scheme "VoteNow" -configuration Debug -destination "generic/platform=iOS" build \
    2>&1 | rg -n "BUILD SUCCEEDED|BUILD FAILED|error:|warning:"
else
  echo "[3/3] Optional Xcode build check skipped (set RUN_XCODEBUILD=1 to enable)"
fi
