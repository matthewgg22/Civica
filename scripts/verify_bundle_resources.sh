#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

PBXPROJ="VoteNow.xcodeproj/project.pbxproj"

required_resources=(
  "WeVote Information Page/default.csv"
  "WeVote Information Page/Models/NYCRepresentativesRoster.json"
  "WeVote Information Page/Models/USGovernors.json"
  "WeVote Information Page/Models/USSenators.json"
  "WeVote Information Page/Models/USSenateCommitteeAssignments.json"
  "WeVote Information Page/Models/USHouseMembers.json"
  "WeVote Information Page/Models/USMayorsTop50.json"
  "WeVote Information Page/Models/ElectionEligibilityDataset.json"
  "WeVote Information Page/Models/USTop150MayoralElectionCycles.json"
  "WeVote Information Page/Models/USMidterm2026ElectionDates.json"
  "WeVote Information Page/Models/ElectionGuideTopics.json"
  "WeVote Information Page/Models/RegistrationGuideTopics.json"
)

echo "[1/3] Verifying required bundle resources exist on disk"
missing_count=0
for path in "${required_resources[@]}"; do
  if [[ -f "$path" ]]; then
    echo "ok   $path"
  else
    echo "MISS $path"
    missing_count=$((missing_count + 1))
  fi
done

if (( missing_count > 0 )); then
  echo "Bundle resource verification failed: $missing_count missing file(s)."
  exit 1
fi

echo "[2/3] Verifying VoteNow target uses filesystem-synced app root group"
if ! awk '
  /\/\* WeVote Information Page \*\/ = \{/ { in_block = 1; next }
  in_block && /isa = PBXFileSystemSynchronizedRootGroup;/ { has_isa = 1 }
  in_block && /};/ {
    if (has_isa) {
      found = 1
      exit 0
    }
    in_block = 0
    has_isa = 0
  }
  END { exit found ? 0 : 1 }
' "$PBXPROJ"; then
  echo "Expected WeVote Information Page to be a PBXFileSystemSynchronizedRootGroup."
  exit 1
fi

if ! awk '
  /\/\* VoteNow \*\/ = \{/ { in_target = 1; next }
  in_target && /fileSystemSynchronizedGroups = \(/ { in_groups = 1; next }
  in_target && in_groups && /\/\* WeVote Information Page \*\// {
    found = 1
    exit 0
  }
  in_target && /};/ {
    in_target = 0
    in_groups = 0
  }
  END { exit found ? 0 : 1 }
' "$PBXPROJ"; then
  echo "VoteNow target is not configured with the WeVote Information Page synced group."
  exit 1
fi

echo "[3/3] Verifying no resource membership exceptions for WeVote app root"
if rg -n 'Exceptions for "WeVote Information Page" folder in "VoteNow" target' "$PBXPROJ" >/dev/null; then
  echo "Found membership exceptions for WeVote Information Page in VoteNow target."
  exit 1
fi

echo "Bundle resource verification passed."
