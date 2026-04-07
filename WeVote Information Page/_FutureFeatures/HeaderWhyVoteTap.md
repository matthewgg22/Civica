# Future Feature: Header Why Vote Tap

The upper-left header logo tap that opened the Why Vote overlay has been moved out of active UI.

Current status:
- `PageHeader` logo is non-interactive by default.
- The Why Vote overlay launch from the header is parked for future re-enable.

Code path:
- `WeVote Information Page/SharedUI.swift`
  - `PageHeader` now uses `enableWhyVoteTap: Bool = false` by default.
  - Tap-to-open overlay behavior remains behind that flag.

To re-enable later:
1. Pass `enableWhyVoteTap: true` to `PageHeader(...)` on the screens where desired.
2. Keep `ContentView` overlay receiver path (`.toggleWhyVoteOverlay`) active.
