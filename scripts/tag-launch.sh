#!/usr/bin/env bash
set -euo pipefail

REQUIRED_BRANCH="codex/rebuild-feb18"
SERVICES=(enrollment-api api dashboard web)

usage() { echo "Usage: $0 <version>  e.g. $0 v1.0.0-ca-launch" >&2; exit 1; }

# ── args ──────────────────────────────────────────────────────────────────────
[[ $# -eq 1 ]] || usage
VERSION="$1"

# semver-ish: vMAJOR.MINOR.PATCH with optional -suffix (letters, digits, hyphens)
if ! [[ "$VERSION" =~ ^v[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9][a-zA-Z0-9-]*)?$ ]]; then
  echo "error: version must match vX.Y.Z or vX.Y.Z-suffix (got: $VERSION)" >&2
  exit 1
fi

# ── guards ────────────────────────────────────────────────────────────────────
CURRENT_BRANCH=$(git symbolic-ref --short HEAD 2>/dev/null || echo "")
if [[ "$CURRENT_BRANCH" != "$REQUIRED_BRANCH" ]]; then
  echo "error: must be on $REQUIRED_BRANCH (currently: ${CURRENT_BRANCH:-detached HEAD})" >&2
  exit 1
fi

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "error: working tree is dirty — commit or stash changes before tagging" >&2
  exit 1
fi

# ── metadata ──────────────────────────────────────────────────────────────────
COMMIT_SHA=$(git rev-parse HEAD)
DEPLOYER=$(git config user.name 2>/dev/null || echo "unknown")
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# ── check for existing tags ───────────────────────────────────────────────────
EXISTING=()
for svc in "${SERVICES[@]}"; do
  tag="${VERSION}-${svc}"
  if git tag --list "$tag" | grep -q "$tag"; then
    EXISTING+=("$tag")
  fi
done

if [[ ${#EXISTING[@]} -gt 0 ]]; then
  echo "error: the following tags already exist — delete them first if you mean to re-tag:" >&2
  printf "  %s\n" "${EXISTING[@]}" >&2
  exit 1
fi

# ── apply tags ────────────────────────────────────────────────────────────────
TAGS=()
for svc in "${SERVICES[@]}"; do
  tag="${VERSION}-${svc}"
  msg="launch tag ${tag}
timestamp: ${TIMESTAMP}
commit:    ${COMMIT_SHA}
deployer:  ${DEPLOYER}"
  git tag --annotate "$tag" --message "$msg"
  TAGS+=("$tag")
done

# ── summary ───────────────────────────────────────────────────────────────────
echo ""
echo "Tagged at ${COMMIT_SHA} (${TIMESTAMP}):"
printf "  %s\n" "${TAGS[@]}"
echo ""
echo "Review the tags, then push when ready:"
echo "  git push origin --tags"
echo ""
echo "To delete a tag locally if you need to re-tag:"
printf "  git tag -d %s\n" "${TAGS[@]}"
