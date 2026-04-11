#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

export PYTHONPYCACHEPREFIX="${PYTHONPYCACHEPREFIX:-/tmp/mapc_v3_pycache}"
mkdir -p "$PYTHONPYCACHEPREFIX"
PYTHON_BIN="${PYTHON_BIN:-}"
if [[ -z "$PYTHON_BIN" ]]; then
  if [[ -x "$ROOT_DIR/.venv/bin/python3" ]]; then
    PYTHON_BIN="$ROOT_DIR/.venv/bin/python3"
  else
    PYTHON_BIN="python3"
  fi
fi

echo "[mapc_v3_gate] Python syntax checks"
"$PYTHON_BIN" -m py_compile \
  backend/civic_api/api.py \
  backend/civic_api/mapc_pipeline_v3.py \
  backend/civic_api/models.py \
  backend/civic_api/script_package_service.py

echo "[mapc_v3_gate] Verifying MAPC v3 health snapshot shape"
"$PYTHON_BIN" - <<'PY'
from backend.civic_api.mapc_pipeline_v3 import MAPCPipelineV3Service

svc = MAPCPipelineV3Service()
snapshot = svc.health_snapshot()
required = {"enabled", "state_sessions", "pending_sessions", "idempotency_entries", "lint_reason_counts"}
missing = sorted(required.difference(snapshot.keys()))
if missing:
    raise SystemExit(f"missing health keys: {missing}")
print("health snapshot ok")
PY

echo "[mapc_v3_gate] Running MAPC v3 regression tests"
if "$PYTHON_BIN" -c "import pytest" >/dev/null 2>&1; then
  "$PYTHON_BIN" -m pytest -q \
    tests/test_mapc_pipeline_v3.py \
    tests/test_mapc_pipeline_v3_golden.py
else
  echo "pytest is not installed. Install test dependencies before deploy."
  exit 2
fi

echo "[mapc_v3_gate] PASS"
