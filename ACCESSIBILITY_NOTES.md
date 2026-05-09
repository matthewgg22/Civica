# Accessibility Notes

## What Changed
- Updated central color tokens in `/WeVote Information Page/VoteNowColors.swift` to improve contrast for semantic states and controls:
  - Darkened `ctaBlue`, `successGreen`, and `warningAmber` for stronger text/icon contrast.
  - Added explicit pressed/disabled button tokens (`ctaBluePressed`, `ctaBlueDisabled`, `ctaRedPressed`, `ctaRedDisabled`).
  - Added semantic status surface tokens for success/warning/error/info/neutral messaging.
  - Added secondary button fill/border tokens for better contrast in normal/pressed/disabled states.
- Added non-color status indicators (icon + text labels) where status emphasis previously depended heavily on color:
  - `/WeVote Information Page/App/MAPVCardView.swift` status pill now includes icon + text.
  - `/Voting UI Island Card/MAPVLiveActivityWidget.swift` status pill and expanded island status include icon + text.
  - `/WeVote Information Page/Views/LaunchFlowStateCard.swift` now shows explicit state labels (`Loading`, `Action Needed`, `Error`).
  - `/WeVote Information Page/Views/SupabaseStatusView.swift` now uses icon + text indicators for auth and health states.
  - `/WeVote Information Page/Views/SupportVoteView.swift` success/error messages now use labeled icon callouts.
  - `/WeVote Information Page/Views/SecondNavigationBarView/VoterRegistrationView.swift` ballot-status disabled state now includes lock icon + `Unavailable` text.
- Updated affected button styles to use explicit high-contrast normal/pressed/disabled colors instead of opacity-only dimming:
  - `/WeVote Information Page/VoteNowColors.swift`
  - `/WeVote Information Page/App/MAPVCardView.swift`
  - `/WeVote Information Page/App/HoldToConfirmButton.swift`
  - `/WeVote Information Page/Views/LaunchFlowStateCard.swift`

## Validation
- Built app successfully with:
  - `xcodebuild -project "Civica.xcodeproj" -scheme "VoteNow" -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' -derivedDataPath /tmp/VoteNowCodexA11yBuild CODE_SIGNING_ALLOWED=NO build`

## Remaining Risks
- Some screens still use local hardcoded color literals and opacity blends; those paths may still contain contrast edge cases under all states.
- Visual assets (image-based marks/icons) were not contrast-audited against all backgrounds.
- This pass focused on core status and button surfaces; a full WCAG audit pass (including dynamic type extremes and high-contrast mode) is still recommended.
