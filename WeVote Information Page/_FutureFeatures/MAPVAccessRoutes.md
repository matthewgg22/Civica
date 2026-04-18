# Future Feature: MAPV Access Routes

Status: parked for this launch.

## What is parked
- Deep links to `votenow://mapv`
- Deep links to `votenow://directions`
- Web share links with `target=mapv`
- Hidden notifications that previously opened MAPV from other tabs

## Current behavior
- These routes now redirect to `Registration` (Voting Steps) instead of opening MAPV.

## Code paths
- `WeVote Information Page/ContentView.swift`
  - `handleAppDeepLink(_:)`
  - `handleWebShareLink(_:)`
  - `.onReceive(.openHowToVoteMailInBallot)`
  - `.onReceive(.openHiddenHowToVoteFeatures)`
- `WeVote Information Page/Views/SecondNavigationBarView/VoterRegistrationView.swift`
  - `howToVoteDeepLink` now points to `votenow://registration`

## Re-enable later
1. Restore MAPV routing in `ContentView`.
2. Point `howToVoteDeepLink` back to `votenow://mapv`.
3. Re-validate hidden-entry behavior before enabling in production.
