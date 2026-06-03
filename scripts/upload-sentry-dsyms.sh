#!/bin/sh
# Upload Civica iOS dSYMs to Sentry so release-build crash reports are
# symbolicated. Invoked by an Xcode build phase on the Civica target.
#
# Behavior:
#
# - Skips silently for non-Release configurations -- local dev / debug
#   builds do not need dSYM upload; debug builds carry symbols inline.
# - Skips silently if sentry-cli is not installed -- fresh checkouts,
#   developer machines without the tool, etc.
# - Skips silently if SENTRY_ORG_SLUG / SENTRY_PROJECT_SLUG / auth are
#   missing -- the build still succeeds; only dSYM upload is dropped.
#   This is the right default: a missing operator config should never
#   break the build, only degrade observability.
#
# Operator setup (one-time per build machine):
#
#   1. Install sentry-cli:
#        brew install getsentry/tools/sentry-cli
#   2. Set CIVICA_SENTRY_AUTH_TOKEN in one of:
#        - CI env (recommended for Xcode Cloud / GitHub Actions archive)
#        - ~/.sentryclirc                (system-wide for your user)
#        - $SRCROOT/.sentryclirc        (project-local, gitignored;
#          copy from .sentryclirc.template)
#   3. Confirm Secrets.xcconfig defines SENTRY_ORG_SLUG +
#      SENTRY_PROJECT_SLUG (template has defaults that match the
#      apple-ios project on sentry.io).
#
# Sentry auth-token scopes required:
#   project:read, project:write, project:releases.
#
# See docs/findings/2026-06-03-resilience-audit-outcomes.md for the
# audit context that motivated this script.

set -e

if [ "${CONFIGURATION}" != "Release" ]; then
  echo "info: Sentry dSYM upload skipped — configuration is ${CONFIGURATION}, not Release."
  exit 0
fi

# Resolve sentry-cli. Try PATH first, then the two homebrew prefixes
# (Apple Silicon at /opt/homebrew, Intel at /usr/local). Xcode build
# phases run with a sparse PATH so explicit fallback matters.
SENTRY_CLI=""
if command -v sentry-cli >/dev/null 2>&1; then
  SENTRY_CLI="$(command -v sentry-cli)"
elif [ -x /opt/homebrew/bin/sentry-cli ]; then
  SENTRY_CLI="/opt/homebrew/bin/sentry-cli"
elif [ -x /usr/local/bin/sentry-cli ]; then
  SENTRY_CLI="/usr/local/bin/sentry-cli"
else
  echo "warning: sentry-cli not installed; dSYMs will not upload. Install with: brew install getsentry/tools/sentry-cli"
  exit 0
fi

if [ -z "${SENTRY_ORG_SLUG}" ] || [ -z "${SENTRY_PROJECT_SLUG}" ]; then
  echo "warning: SENTRY_ORG_SLUG (\"${SENTRY_ORG_SLUG}\") or SENTRY_PROJECT_SLUG (\"${SENTRY_PROJECT_SLUG}\") missing from xcconfig; dSYMs will not upload."
  exit 0
fi

# Auth-token resolution: env beats .sentryclirc beats default fallback.
# sentry-cli handles the search order itself; we just check that
# *something* is configured so we can warn loudly when nothing is.
if [ -z "${SENTRY_AUTH_TOKEN}" ] && [ -z "${CIVICA_SENTRY_AUTH_TOKEN}" ] && [ ! -f "${HOME}/.sentryclirc" ] && [ ! -f "${SRCROOT}/.sentryclirc" ]; then
  echo "warning: no Sentry auth token configured (env SENTRY_AUTH_TOKEN / CIVICA_SENTRY_AUTH_TOKEN, ~/.sentryclirc, or \$SRCROOT/.sentryclirc). dSYMs will not upload."
  exit 0
fi

# Prefer the Civica-namespaced env var if present (matches the
# CIVICA_SENTRY_DSN convention in Secrets.xcconfig).
if [ -n "${CIVICA_SENTRY_AUTH_TOKEN}" ] && [ -z "${SENTRY_AUTH_TOKEN}" ]; then
  export SENTRY_AUTH_TOKEN="${CIVICA_SENTRY_AUTH_TOKEN}"
fi

echo "info: uploading dSYMs to Sentry — org=${SENTRY_ORG_SLUG} project=${SENTRY_PROJECT_SLUG}"
echo "info: dSYM folder = ${DWARF_DSYM_FOLDER_PATH}"

"${SENTRY_CLI}" debug-files upload \
  --org "${SENTRY_ORG_SLUG}" \
  --project "${SENTRY_PROJECT_SLUG}" \
  "${DWARF_DSYM_FOLDER_PATH}"
