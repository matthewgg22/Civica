# Why Call Overlay (Future Feature)

The "Why Call" tap target and full-screen overlay have been moved out of the active
`Call my Rep` experience.

Current status:
- The logo in `IssueCallCenterView` is no longer tappable for Why Call.
- The `WhyCallFloodOverlay` presentation path is removed from active layout flow.

Code retained for future re-enable:
- `WeVote Information Page/SharedUI.swift`
  - `WhyCallFloodOverlay`
  - `WhyCallView`
  - supporting `WhyCall*` content/types

To re-enable later:
1. Reintroduce a tap target in `IssueCallCenterView` header.
2. Restore local state + overlay presentation wiring.
3. Reconnect the launch point to `WhyCallFloodOverlay`.
