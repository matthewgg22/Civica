#!/usr/bin/env bash
# Smoke test for scripts/launch-preflight.sh.
#
# Verifies:
#   1. --help runs without crashing and prints expected strings
#   2. dry-run mode completes with exit 0 and prints HARD GATES line
#
# Not exhaustive — the preflight script's value is operational. This just
# catches obvious regressions (syntax errors, missing functions, broken
# summary block).

set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PREFLIGHT="$SCRIPT_DIR/launch-preflight.sh"

fail=0

assert_contains() {
  local haystack="$1" needle="$2" label="$3"
  if echo "$haystack" | grep -qF -- "$needle"; then
    echo "  PASS: $label"
  else
    echo "  FAIL: $label — missing '$needle'"
    fail=1
  fi
}

echo "Test 1: --help"
out=$(bash "$PREFLIGHT" --help 2>&1)
assert_contains "$out" "Civica launch preflight" "help mentions tool name"
assert_contains "$out" "hard gates" "help mentions hard gates"
assert_contains "$out" "--only=" "help documents --only flag"
assert_contains "$out" "SENTRY_AUTH_TOKEN" "help documents env vars"

echo
echo "Test 2: dry-run completes (LAUNCH_PREFLIGHT_DRY_RUN=true)"
out=$(LAUNCH_PREFLIGHT_DRY_RUN=true bash "$PREFLIGHT" 2>&1)
code=$?
assert_contains "$out" "Civica launch preflight" "dry-run header printed"
assert_contains "$out" "HARD GATES:" "dry-run prints HARD GATES line"
assert_contains "$out" "LAUNCH READY:" "dry-run prints LAUNCH READY line"
if [[ "$code" -eq 0 ]]; then
  echo "  PASS: dry-run exit code 0"
else
  echo "  FAIL: dry-run exit code $code (expected 0)"
  fail=1
fi

echo
echo "Test 3: --only=cors runs subset"
out=$(LAUNCH_PREFLIGHT_DRY_RUN=true bash "$PREFLIGHT" --only=cors 2>&1)
assert_contains "$out" "cors-allowlist" "--only=cors includes cors check"
if echo "$out" | grep -q "enrollment-api-health"; then
  echo "  FAIL: --only=cors should not run enrollment-api-health"
  fail=1
else
  echo "  PASS: --only=cors excludes unrelated checks"
fi

echo
if [[ "$fail" -eq 0 ]]; then
  echo "ALL TESTS PASSED"
  exit 0
else
  echo "SOME TESTS FAILED"
  exit 1
fi
