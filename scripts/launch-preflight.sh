#!/usr/bin/env bash
# launch-preflight.sh — Civica launch readiness gate checker.
#
# Runs every "is this ready?" gate identified by the 2026-05-19 launch plan
# (docs/snap/launch-readiness.md) and prints a color-coded PASS/FAIL/SKIP/WARN
# report. Exits 0 if all hard gates pass, 1 if any hard gate fails, 2 if a
# prerequisite tool is missing.
#
# Usage:
#   bash scripts/launch-preflight.sh                # full run
#   bash scripts/launch-preflight.sh --help         # list checks
#   bash scripts/launch-preflight.sh --only=cors    # filter by substring
#   bash scripts/launch-preflight.sh --strict       # WARN → FAIL
#   bash scripts/launch-preflight.sh --verbose      # show raw command output
#
# Extended checks activate when these env vars are set:
#   SENTRY_AUTH_TOKEN   — query Sentry for recent events per service
#   AXIOM_TOKEN         — query Axiom for log-drain liveness
#   DATABASE_URL        — psql checks against Supabase
#
# Dry-run mode: LAUNCH_PREFLIGHT_DRY_RUN=true short-circuits network calls so
# the script can smoke-test in CI / offline.

set -u
# Intentionally not -e: we want every check to run even if one curl fails.

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

ENROLLMENT_API_URL="https://civica-enrollment-api.civica-api.workers.dev"
DASHBOARD_URL="https://civica-dashboard.vercel.app"
SNAP_ENGINE_URL="https://civica-snap-engine.fly.dev"
CIVICA_API_URL="https://civica-api.fly.dev"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# ---------------------------------------------------------------------------
# Color helpers (tput, portable)
# ---------------------------------------------------------------------------

if [[ -t 1 ]] && command -v tput >/dev/null 2>&1; then
  C_RESET="$(tput sgr0)"
  C_RED="$(tput setaf 1)"
  C_GREEN="$(tput setaf 2)"
  C_YELLOW="$(tput setaf 3)"
  C_BLUE="$(tput setaf 4)"
  C_CYAN="$(tput setaf 6)"
  C_BOLD="$(tput bold)"
else
  C_RESET="" C_RED="" C_GREEN="" C_YELLOW="" C_BLUE="" C_CYAN="" C_BOLD=""
fi

# ---------------------------------------------------------------------------
# CLI args
# ---------------------------------------------------------------------------

ONLY=""
STRICT=0
VERBOSE=0
SHOW_HELP=0

for arg in "$@"; do
  case "$arg" in
    --help|-h) SHOW_HELP=1 ;;
    --strict) STRICT=1 ;;
    --verbose|-v) VERBOSE=1 ;;
    --only=*) ONLY="${arg#--only=}" ;;
    *) echo "unknown arg: $arg" >&2; exit 2 ;;
  esac
done

# ---------------------------------------------------------------------------
# Result accumulators
# ---------------------------------------------------------------------------

PASS_COUNT=0
FAIL_COUNT=0
SKIP_COUNT=0
WARN_COUNT=0
HARD_TOTAL=0
HARD_PASS=0
FAIL_DESCRIPTIONS=()
WARN_DESCRIPTIONS=()

# All known check names in display order. Keep this in sync with the case
# statement in main().
ALL_CHECKS=(
  "enrollment-api-health"         # A reachability
  "dashboard-reachable"
  "snap-engine-reachable"
  "civica-api-reachable"
  "cors-allowlist"                # B
  "feature-flags-endpoint"        # C
  "sentry-drains"                 # D
  "log-drain"                     # E
  "db-feature-flags"              # F
  "db-pilot-leads-constraint"
  "db-benefitscal-statuses"
  "compliance-copy"               # G
  "lpie-acl-citation"
  "browserless-secret"            # H
  "benefitscal-credentials"
  "vercel-civica-web"
  "ios-builds"                    # I
)

# ---------------------------------------------------------------------------
# Reporting primitives
# ---------------------------------------------------------------------------

# report <STATUS> <name> <description> [hard|soft]
# STATUS = PASS | FAIL | SKIP | WARN
# hard|soft: whether this check counts toward the launch-blocking total.
report() {
  local status="$1" name="$2" desc="$3" gate="${4:-hard}"
  local color label
  case "$status" in
    PASS) color="$C_GREEN" label="PASS" ;;
    FAIL) color="$C_RED"   label="FAIL" ;;
    SKIP) color="$C_BLUE"  label="SKIP" ;;
    WARN) color="$C_YELLOW" label="WARN" ;;
    *)    color="$C_RESET" label="$status" ;;
  esac

  printf "  [%s%-4s%s] %-30s %s\n" "$color" "$label" "$C_RESET" "$name" "$desc"

  case "$status" in
    PASS)
      PASS_COUNT=$((PASS_COUNT+1))
      [[ "$gate" == "hard" ]] && { HARD_TOTAL=$((HARD_TOTAL+1)); HARD_PASS=$((HARD_PASS+1)); }
      ;;
    FAIL)
      FAIL_COUNT=$((FAIL_COUNT+1))
      [[ "$gate" == "hard" ]] && HARD_TOTAL=$((HARD_TOTAL+1))
      FAIL_DESCRIPTIONS+=("$name: $desc")
      ;;
    SKIP)
      SKIP_COUNT=$((SKIP_COUNT+1))
      ;;
    WARN)
      WARN_COUNT=$((WARN_COUNT+1))
      WARN_DESCRIPTIONS+=("$name: $desc")
      ;;
  esac
}

# verbose echo — shows raw command output when --verbose is set.
vecho() {
  [[ "$VERBOSE" -eq 1 ]] && printf "      %s%s%s\n" "$C_CYAN" "$*" "$C_RESET" || true
}

# ---------------------------------------------------------------------------
# Help
# ---------------------------------------------------------------------------

print_help() {
  cat <<EOF
${C_BOLD}Civica launch preflight${C_RESET} — readiness gate checker

Usage:
  bash scripts/launch-preflight.sh [--only=<pattern>] [--strict] [--verbose]

Flags:
  --help, -h          Show this help and exit
  --only=<pattern>    Only run checks whose name contains <pattern>
  --strict            Treat WARN gates as FAIL (e.g. .pendingSignoff)
  --verbose, -v       Show raw command output per check

Checks (name : category : gate):
  enrollment-api-health        : A reachability       : hard
  dashboard-reachable          : A reachability       : hard
  snap-engine-reachable        : A reachability       : hard
  civica-api-reachable         : A reachability       : hard
  cors-allowlist               : B CORS (PR #197)     : hard
  feature-flags-endpoint       : C feature flags      : hard
  sentry-drains                : D Sentry             : hard*
  log-drain                    : E Axiom log drain    : hard*
  db-feature-flags             : F database           : hard*
  db-pilot-leads-constraint    : F database           : hard*
  db-benefitscal-statuses      : F database           : hard*
  compliance-copy              : G legal copy         : warn
  lpie-acl-citation            : G LPIE ACL TODO      : warn
  browserless-secret           : H operator infra     : warn
  benefitscal-credentials      : H operator infra     : warn
  vercel-civica-web            : H operator infra     : warn
  ios-builds                   : I iOS build          : warn

  * = SKIPs (rather than FAILs) when its env var / tool is unavailable.

Env vars that enable extended checks:
  SENTRY_AUTH_TOKEN     Sentry recent-event query
  AXIOM_TOKEN           Axiom log-drain query
  DATABASE_URL          psql checks against Supabase

Exit codes:
  0  all hard gates pass (LAUNCH READY)
  1  one or more hard gates failed
  2  missing prerequisite (curl, jq, gh)
EOF
}

# ---------------------------------------------------------------------------
# Prerequisite gate
# ---------------------------------------------------------------------------

require_tools() {
  local missing=()
  for t in curl jq; do
    command -v "$t" >/dev/null 2>&1 || missing+=("$t")
  done
  if (( ${#missing[@]} > 0 )); then
    echo "${C_RED}preflight cannot run: missing tools: ${missing[*]}${C_RESET}" >&2
    exit 2
  fi
}

# Should this check run given --only filter?
should_run() {
  local name="$1"
  [[ -z "$ONLY" ]] && return 0
  [[ "$name" == *"$ONLY"* ]] && return 0
  # Also allow category-style aliases.
  case "$ONLY" in
    reachability)
      [[ "$name" == *"-reachable" || "$name" == "enrollment-api-health" ]] && return 0
      ;;
    db|database)
      [[ "$name" == db-* ]] && return 0
      ;;
    sentry) [[ "$name" == "sentry-drains" ]] && return 0 ;;
    cors)   [[ "$name" == "cors-allowlist" ]] && return 0 ;;
  esac
  return 1
}

dry_run() { [[ "${LAUNCH_PREFLIGHT_DRY_RUN:-}" == "true" ]]; }

# ---------------------------------------------------------------------------
# A. Reachability checks
# ---------------------------------------------------------------------------

# Fetch a URL with a short timeout. Echoes "<status_code>|<body>".
# Uses curl -sS (not -f) so we capture the HTTP code on 4xx/5xx too.
http_probe() {
  local url="$1"
  if dry_run; then
    echo "200|{\"ok\":true}"
    return 0
  fi
  local status body
  status=$(curl -sS --max-time 8 -o /tmp/preflight_body.$$ -w '%{http_code}' "$url" 2>/dev/null || echo "000")
  body=$(cat /tmp/preflight_body.$$ 2>/dev/null || echo "")
  rm -f /tmp/preflight_body.$$
  echo "${status}|${body}"
}

check_enrollment_api_health() {
  local name="enrollment-api-health"
  should_run "$name" || return 0
  local out status body
  out=$(http_probe "$ENROLLMENT_API_URL/health")
  status="${out%%|*}"; body="${out#*|}"
  vecho "GET $ENROLLMENT_API_URL/health → $status"
  vecho "body: $body"
  if [[ "$status" == "200" ]] && echo "$body" | grep -q '"ok"[[:space:]]*:[[:space:]]*true'; then
    report PASS "$name" "200 OK, ok:true"
  else
    report FAIL "$name" "expected 200 ok:true, got status=$status"
  fi
}

check_dashboard_reachable() {
  local name="dashboard-reachable"
  should_run "$name" || return 0
  local status
  if dry_run; then status="200"; else
    status=$(curl -sS --max-time 8 -o /dev/null -w '%{http_code}' "$DASHBOARD_URL" 2>/dev/null || echo "000")
  fi
  vecho "GET $DASHBOARD_URL → $status"
  if [[ "$status" =~ ^(200|301|302|307|308)$ ]]; then
    report PASS "$name" "HTTP $status from $DASHBOARD_URL"
  else
    report FAIL "$name" "expected 200/3xx from dashboard, got $status"
  fi
}

check_snap_engine_reachable() {
  local name="snap-engine-reachable"
  should_run "$name" || return 0
  local status
  if dry_run; then status="200"; else
    status=$(curl -sS --max-time 8 -o /dev/null -w '%{http_code}' "$SNAP_ENGINE_URL/health" 2>/dev/null || echo "000")
  fi
  vecho "GET $SNAP_ENGINE_URL/health → $status"
  if [[ "$status" == "000" ]]; then
    report SKIP "$name" "host did not resolve / connect ($SNAP_ENGINE_URL)"
  elif [[ "$status" == "200" ]]; then
    report PASS "$name" "200 OK from snap-engine"
  else
    report FAIL "$name" "expected 200, got $status"
  fi
}

check_civica_api_reachable() {
  local name="civica-api-reachable"
  should_run "$name" || return 0
  local status
  if dry_run; then status="200"; else
    status=$(curl -sS --max-time 8 -o /dev/null -w '%{http_code}' "$CIVICA_API_URL/health" 2>/dev/null || echo "000")
  fi
  vecho "GET $CIVICA_API_URL/health → $status"
  if [[ "$status" == "200" ]]; then
    report PASS "$name" "200 OK from civica-api"
  else
    report FAIL "$name" "expected 200, got $status"
  fi
}

# ---------------------------------------------------------------------------
# B. CORS allowlist (PR #197)
# ---------------------------------------------------------------------------

check_cors_allowlist() {
  local name="cors-allowlist"
  should_run "$name" || return 0

  if dry_run; then
    report PASS "$name" "(dry-run) dashboard reflected, evil rejected"
    return 0
  fi

  # Allowed origin: should be reflected back.
  local allowed_hdr
  allowed_hdr=$(curl -fsS -X OPTIONS \
    -H "Origin: https://civica-dashboard.vercel.app" \
    -H "Access-Control-Request-Method: POST" \
    --max-time 8 -i "$ENROLLMENT_API_URL/v1/enrollment/feature-flags" 2>/dev/null \
    | tr -d '\r' \
    | grep -i '^access-control-allow-origin:' || true)
  vecho "allowed preflight header: $allowed_hdr"

  # Disallowed origin: header should be absent or not reflect evil.
  local evil_hdr
  evil_hdr=$(curl -fsS -X OPTIONS \
    -H "Origin: https://evil.example.com" \
    -H "Access-Control-Request-Method: POST" \
    --max-time 8 -i "$ENROLLMENT_API_URL/v1/enrollment/feature-flags" 2>/dev/null \
    | tr -d '\r' \
    | grep -i '^access-control-allow-origin:' || true)
  vecho "evil preflight header: $evil_hdr"

  local allow_ok=0 evil_ok=0
  echo "$allowed_hdr" | grep -qi "civica-dashboard.vercel.app" && allow_ok=1
  if [[ -z "$evil_hdr" ]] || ! echo "$evil_hdr" | grep -qi "evil.example.com"; then
    evil_ok=1
  fi

  if [[ "$allow_ok" -eq 1 && "$evil_ok" -eq 1 ]]; then
    report PASS "$name" "dashboard reflected, evil.example.com rejected"
  elif [[ "$allow_ok" -eq 0 ]]; then
    report FAIL "$name" "dashboard origin not reflected (header: ${allowed_hdr:-<absent>})"
  else
    report FAIL "$name" "evil.example.com was reflected — allowlist broken"
  fi
}

# ---------------------------------------------------------------------------
# C. Feature flags endpoint (PR #197)
# ---------------------------------------------------------------------------

check_feature_flags_endpoint() {
  local name="feature-flags-endpoint"
  should_run "$name" || return 0
  local body
  if dry_run; then
    body='{"lpie_auto_exempt_enabled":true}'
  else
    body=$(curl -fsS --max-time 8 "$ENROLLMENT_API_URL/v1/enrollment/feature-flags" 2>/dev/null || echo "")
  fi
  vecho "feature-flags body: $body"
  if [[ -z "$body" ]]; then
    report FAIL "$name" "endpoint did not respond"
    return 0
  fi
  local flag
  flag=$(echo "$body" | jq -r '.lpie_auto_exempt_enabled // empty' 2>/dev/null)
  if [[ "$flag" == "true" || "$flag" == "false" ]]; then
    report PASS "$name" "lpie_auto_exempt_enabled = $flag"
  else
    report FAIL "$name" "lpie_auto_exempt_enabled missing from response"
  fi
}

# ---------------------------------------------------------------------------
# D. Sentry drains
# ---------------------------------------------------------------------------

check_sentry_drains() {
  local name="sentry-drains"
  should_run "$name" || return 0
  if [[ -z "${SENTRY_AUTH_TOKEN:-}" ]]; then
    report SKIP "$name" "(no SENTRY_AUTH_TOKEN — set to enable check)"
    return 0
  fi

  local services=("snap-engine" "enrollment-api" "civica-api" "snap-api" "dashboard")
  local org="${SENTRY_ORG:-civica}"
  local any_fail=0
  local detail=""

  for svc in "${services[@]}"; do
    local resp count
    resp=$(curl -fsS --max-time 10 \
      -H "Authorization: Bearer $SENTRY_AUTH_TOKEN" \
      "https://sentry.io/api/0/projects/$org/$svc/events/?statsPeriod=24h" 2>/dev/null || echo "[]")
    count=$(echo "$resp" | jq 'length' 2>/dev/null || echo 0)
    vecho "  $svc: events_24h=$count"
    if [[ "$count" -gt 0 ]]; then
      detail+="$svc=$count "
    else
      detail+="${svc}=0(FAIL) "
      any_fail=1
    fi
  done

  if [[ "$any_fail" -eq 0 ]]; then
    report PASS "$name" "all 5 services have events in last 24h"
  else
    report FAIL "$name" "no events in 24h from: $detail"
  fi
}

# ---------------------------------------------------------------------------
# E. Axiom log drain
# ---------------------------------------------------------------------------

check_log_drain() {
  local name="log-drain"
  should_run "$name" || return 0
  if [[ -z "${AXIOM_TOKEN:-}" ]]; then
    report SKIP "$name" "(no AXIOM_TOKEN — log drain not configured per Session H)"
    return 0
  fi

  local org="${AXIOM_ORG_ID:-civica}"
  local dataset="${AXIOM_DATASET:-civica-prod}"
  # Simple APL query: count events in last 24h.
  local resp count
  resp=$(curl -fsS --max-time 10 -X POST \
    -H "Authorization: Bearer $AXIOM_TOKEN" \
    -H "Content-Type: application/json" \
    -H "X-Axiom-Org-ID: $org" \
    -d "{\"apl\":\"['$dataset'] | where _time > ago(24h) | count\"}" \
    "https://api.axiom.co/v1/datasets/_apl?format=tabular" 2>/dev/null || echo "")
  count=$(echo "$resp" | jq -r '.tables[0].columns[0][0] // 0' 2>/dev/null || echo 0)
  vecho "axiom count_24h = $count"
  if [[ "$count" -gt 0 ]]; then
    report PASS "$name" "$count events in $dataset over last 24h"
  else
    report FAIL "$name" "no events received in last 24h ($dataset)"
  fi
}

# ---------------------------------------------------------------------------
# F. Database invariants
# ---------------------------------------------------------------------------

psql_or_skip() {
  if ! command -v psql >/dev/null 2>&1; then
    echo "__no_psql__"
    return 1
  fi
  if [[ -z "${DATABASE_URL:-}" ]]; then
    echo "__no_url__"
    return 1
  fi
  return 0
}

check_db_feature_flags() {
  local name="db-feature-flags"
  should_run "$name" || return 0
  psql_or_skip > /dev/null
  case "$?" in
    0) ;;
    *)
      if ! command -v psql >/dev/null 2>&1; then
        report SKIP "$name" "(psql not installed)"
      else
        report SKIP "$name" "(no DATABASE_URL)"
      fi
      return 0
      ;;
  esac

  local out
  out=$(psql "$DATABASE_URL" -tAc \
    "SELECT enabled FROM public.feature_flags WHERE key = 'lpie_auto_exempt_enabled';" 2>/dev/null || echo "")
  vecho "feature_flags row: '$out'"
  if [[ "$out" == "t" || "$out" == "f" ]]; then
    report PASS "$name" "row present, enabled=$out"
  else
    report FAIL "$name" "no row for key='lpie_auto_exempt_enabled'"
  fi
}

check_db_pilot_leads_constraint() {
  local name="db-pilot-leads-constraint"
  should_run "$name" || return 0
  psql_or_skip > /dev/null
  if [[ $? -ne 0 ]]; then
    report SKIP "$name" "(psql/DATABASE_URL unavailable)"
    return 0
  fi
  local out
  out=$(psql "$DATABASE_URL" -tAc \
    "SELECT conname FROM pg_constraint WHERE conname = 'pilot_leads_audience_shape';" 2>/dev/null || echo "")
  vecho "constraint row: '$out'"
  if [[ "$out" == "pilot_leads_audience_shape" ]]; then
    report PASS "$name" "CHECK constraint present"
  else
    report FAIL "$name" "missing CHECK constraint pilot_leads_audience_shape"
  fi
}

check_db_benefitscal_statuses() {
  local name="db-benefitscal-statuses"
  should_run "$name" || return 0
  psql_or_skip > /dev/null
  if [[ $? -ne 0 ]]; then
    report SKIP "$name" "(psql/DATABASE_URL unavailable)"
    return 0
  fi
  local out
  out=$(psql "$DATABASE_URL" -tAc \
    "SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'benefitscal_submissions_status_check';" 2>/dev/null || echo "")
  vecho "constraint def: $out"
  local need=(queued running succeeded failed pending_review submitted)
  local missing=()
  for s in "${need[@]}"; do
    echo "$out" | grep -q "'$s'" || missing+=("$s")
  done
  if [[ ${#missing[@]} -eq 0 ]]; then
    report PASS "$name" "all 6 statuses allowed"
  else
    report FAIL "$name" "missing statuses: ${missing[*]}"
  fi
}

# ---------------------------------------------------------------------------
# G. Compliance + LPIE
# ---------------------------------------------------------------------------

check_compliance_copy() {
  local name="compliance-copy"
  should_run "$name" || return 0
  local file="$REPO_ROOT/Civica/Features/SNAP/Generated/SNAPComplianceCopyRegistry+Generated.swift"
  if [[ ! -f "$file" ]]; then
    report SKIP "$name" "(generated file missing — run codegen)"
    return 0
  fi
  local pending approved
  pending=$(grep -c "status: \.pendingSignoff" "$file" || true)
  approved=$(grep -c "status: \.approved" "$file" || true)
  vecho "pending=$pending approved=$approved"
  local desc="$pending pending, $approved approved"
  if [[ "$pending" -eq 0 ]]; then
    report PASS "$name" "$desc — all strings approved"
  elif [[ "$STRICT" -eq 1 ]]; then
    report FAIL "$name" "$desc (--strict)"
  else
    report WARN "$name" "$desc (counsel batch in flight)" "soft"
  fi
}

check_lpie_acl_citation() {
  local name="lpie-acl-citation"
  should_run "$name" || return 0
  local count
  count=$(grep -rl "TODO: replace with actual CA CDSS ACL number" "$REPO_ROOT/Civica" 2>/dev/null | wc -l | tr -d ' ')
  vecho "ACL TODO sites: $count"
  if [[ "$count" -eq 0 ]]; then
    report PASS "$name" "no ACL TODO placeholders remain"
  elif [[ "$STRICT" -eq 1 ]]; then
    report FAIL "$name" "$count sites still have TODO placeholder (--strict)"
  else
    report WARN "$name" "$count sites still have TODO placeholder" "soft"
  fi
}

# ---------------------------------------------------------------------------
# H. Operator infrastructure
# ---------------------------------------------------------------------------

# wrangler_secret_has <secret_name> — echoes 0/1 to stdout, exits 2 if no wrangler.
wrangler_secret_has() {
  local secret="$1"
  if ! command -v wrangler >/dev/null 2>&1; then
    return 2
  fi
  ( cd "$REPO_ROOT/apps/enrollment-api" && wrangler secret list 2>/dev/null ) \
    | grep -q "\"$secret\"" && return 0 || return 1
}

check_browserless_secret() {
  local name="browserless-secret"
  should_run "$name" || return 0
  wrangler_secret_has "BROWSERLESS_API_KEY"
  case "$?" in
    0) report PASS "$name" "BROWSERLESS_API_KEY present" ;;
    1) report WARN "$name" "BROWSERLESS_API_KEY missing from enrollment-api secrets" "soft" ;;
    2) report SKIP "$name" "(wrangler CLI not installed)" ;;
  esac
}

check_benefitscal_credentials() {
  local name="benefitscal-credentials"
  should_run "$name" || return 0
  if ! command -v wrangler >/dev/null 2>&1; then
    report SKIP "$name" "(wrangler CLI not installed)"
    return 0
  fi
  local user_ok=1 pw_ok=1
  wrangler_secret_has "BENEFITSCAL_CBO_USERNAME" || user_ok=0
  wrangler_secret_has "BENEFITSCAL_CBO_PASSWORD" || pw_ok=0
  if [[ "$user_ok" -eq 1 && "$pw_ok" -eq 1 ]]; then
    report PASS "$name" "both CBO credentials set"
  else
    report WARN "$name" "credentials not set (gate inactive — see TODO-14)" "soft"
  fi
}

check_vercel_civica_web() {
  local name="vercel-civica-web"
  should_run "$name" || return 0
  if ! command -v vercel >/dev/null 2>&1; then
    report SKIP "$name" "(vercel CLI not installed)"
    return 0
  fi
  local out
  out=$(vercel project ls 2>/dev/null || vercel ls 2>/dev/null || echo "")
  vecho "vercel ls output (truncated): $(echo "$out" | head -3)"
  if echo "$out" | grep -q "civica-web"; then
    report PASS "$name" "civica-web project present on Vercel"
  else
    report WARN "$name" "civica-web project not found (TODO-16)" "soft"
  fi
}

# ---------------------------------------------------------------------------
# I. iOS build health
# ---------------------------------------------------------------------------

check_ios_builds() {
  local name="ios-builds"
  should_run "$name" || return 0
  if [[ "$(uname)" != "Darwin" ]] || ! command -v xcodebuild >/dev/null 2>&1; then
    report SKIP "$name" "(non-macOS or xcodebuild missing)"
    return 0
  fi
  if dry_run; then
    report PASS "$name" "(dry-run) BUILD SUCCEEDED"
    return 0
  fi
  local tail_out
  tail_out=$(cd "$REPO_ROOT" && xcodebuild build \
    -scheme Civica \
    -destination 'platform=iOS Simulator,name=iPhone 16' \
    CODE_SIGNING_ALLOWED=NO ENABLE_USER_SCRIPT_SANDBOXING=NO \
    -quiet 2>&1 | tail -5)
  vecho "$tail_out"
  if echo "$tail_out" | grep -q "BUILD SUCCEEDED"; then
    report PASS "$name" "BUILD SUCCEEDED"
  elif echo "$tail_out" | grep -q "BUILD FAILED"; then
    report WARN "$name" "BUILD FAILED — see xcodebuild output" "soft"
  else
    report WARN "$name" "ambiguous xcodebuild outcome" "soft"
  fi
}

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------

# Render a 20-char ASCII bar for a given percentage.
bar() {
  local pct="$1"
  local filled=$(( pct / 5 ))   # 100 / 20 = 5% per slot
  local i out=""
  for ((i=0; i<20; i++)); do
    if (( i < filled )); then out+="█"; else out+="░"; fi
  done
  printf "%s" "$out"
}

print_summary() {
  local total=$(( PASS_COUNT + FAIL_COUNT + SKIP_COUNT + WARN_COUNT ))
  [[ $total -eq 0 ]] && total=1
  local p_pct=$(( PASS_COUNT * 100 / total ))
  local f_pct=$(( FAIL_COUNT * 100 / total ))
  local s_pct=$(( SKIP_COUNT * 100 / total ))
  local w_pct=$(( WARN_COUNT * 100 / total ))
  local ts; ts="$(date -u '+%Y-%m-%d %H:%M:%S UTC')"

  echo
  echo "${C_BOLD}═══════════════════════════════════════════════════════════════${C_RESET}"
  echo " Civica launch preflight — $ts"
  echo "${C_BOLD}═══════════════════════════════════════════════════════════════${C_RESET}"
  printf " ${C_GREEN}PASS${C_RESET}:  %2d   %s  %d%%\n" "$PASS_COUNT" "$(bar $p_pct)" "$p_pct"
  printf " ${C_RED}FAIL${C_RESET}:  %2d   %s  %d%%\n" "$FAIL_COUNT" "$(bar $f_pct)" "$f_pct"
  printf " ${C_BLUE}SKIP${C_RESET}:  %2d   %s  %d%%\n" "$SKIP_COUNT" "$(bar $s_pct)" "$s_pct"
  printf " ${C_YELLOW}WARN${C_RESET}:  %2d   %s  %d%%\n" "$WARN_COUNT" "$(bar $w_pct)" "$w_pct"
  echo "───────────────────────────────────────────────────────────────"
  printf " HARD GATES:    %d / %d  pass\n" "$HARD_PASS" "$HARD_TOTAL"

  if [[ $FAIL_COUNT -eq 0 ]]; then
    printf " LAUNCH READY:  ${C_GREEN}YES${C_RESET}\n"
  else
    local first="${FAIL_DESCRIPTIONS[0]%%:*}"
    local rest=""
    if [[ ${#FAIL_DESCRIPTIONS[@]} -gt 1 ]]; then
      local second="${FAIL_DESCRIPTIONS[1]%%:*}"
      rest=" + $second"
    fi
    printf " LAUNCH READY:  ${C_RED}NO${C_RESET}  ← %s%s FAIL\n" "$first" "$rest"
    echo
    echo " Next steps:"
    local d
    for d in "${FAIL_DESCRIPTIONS[@]}"; do
      echo "   - $d"
    done
  fi

  if [[ ${#WARN_DESCRIPTIONS[@]} -gt 0 && $VERBOSE -eq 1 ]]; then
    echo
    echo " Warnings (informational):"
    for d in "${WARN_DESCRIPTIONS[@]}"; do
      echo "   - $d"
    done
  fi
  echo "${C_BOLD}═══════════════════════════════════════════════════════════════${C_RESET}"
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

main() {
  if [[ "$SHOW_HELP" -eq 1 ]]; then
    print_help
    exit 0
  fi

  require_tools

  echo "${C_BOLD}Civica launch preflight${C_RESET} — running checks..."
  if [[ -n "$ONLY" ]]; then echo "  (filter: --only=$ONLY)"; fi
  if [[ "$STRICT" -eq 1 ]]; then echo "  (mode: --strict)"; fi
  echo

  # A. Reachability
  check_enrollment_api_health
  check_dashboard_reachable
  check_snap_engine_reachable
  check_civica_api_reachable

  # B. CORS
  check_cors_allowlist

  # C. Feature flags
  check_feature_flags_endpoint

  # D. Sentry
  check_sentry_drains

  # E. Log drain
  check_log_drain

  # F. Database
  check_db_feature_flags
  check_db_pilot_leads_constraint
  check_db_benefitscal_statuses

  # G. Compliance
  check_compliance_copy
  check_lpie_acl_citation

  # H. Operator infra
  check_browserless_secret
  check_benefitscal_credentials
  check_vercel_civica_web

  # I. iOS builds (only when explicitly requested via --only=ios; full
  # xcodebuild is slow and not appropriate for ad-hoc preflight runs).
  if [[ "$ONLY" == *"ios"* ]]; then
    check_ios_builds
  fi

  print_summary

  if [[ "$FAIL_COUNT" -gt 0 ]]; then
    exit 1
  fi
  exit 0
}

main "$@"
