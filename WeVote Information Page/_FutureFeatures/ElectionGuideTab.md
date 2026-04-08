# Election Guide Tab (Parked)

Status: parked in Future Features as of April 8, 2026.

The bottom tab bar now ships with 4 tabs only:
- My Reps
- Call Reps
- Election Timeline
- Voting Steps

What changed:
- Removed `Tab.electionGuide` from `ContentView.swift`.
- Removed the Election Guide tab item from `ContentView` and `TabAndBaseTab`.

How to restore later:
1. Re-add `case electionGuide` to `enum Tab` in `ContentView.swift`.
2. Re-add `iconName` mapping for `.electionGuide`.
3. Re-add the `NYCMayoralElectionView()` tab entry in `ContentView` (and `TabAndBaseTab` if needed).
