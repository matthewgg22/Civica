# CivicaDesignSystem

Local Swift package containing the Civica design system tokens. The main app
target (`VoteNow`) depends on this package.

The widget extension (`Voting UI Island CardExtension`) keeps its own duplicated
copies of `CivicaColors`, `CivicaTokens`, and `CivicaTypography` for now —
extracting the widget into the package too is deferred to a future PR.

## What's in here

| File | Tokens |
|---|---|
| `CivicaColors.swift` | Color palette, dark-mode adaptive `Color.dynamic`, `Color.init(hex:)`, `UIColor.init(hex:)`, `CivicaPrimaryCTAButtonStyle`, `CivicaUrgentCTAButtonStyle` |
| `CivicaTokens.swift` | `CivicaSpacing` (4/8/12/16/24/32), `CivicaRadius` (8/10/12/16/pill) |
| `CivicaTypography.swift` | 18 semantic font tokens |
| `CivicaShadow.swift` | 3 elevation tiers + `View.civicaShadow(_:color:opacity:)` |
| `CivicaAnimation.swift` | `fast` / `standard` / `snap` / `slow` |

## Adding the package to Xcode (one-time setup)

This package isn't yet wired into `Civica.xcodeproj`. The first time you check
out this branch, do the following in Xcode (takes ~1 minute):

1. Open `Civica.xcodeproj`.
2. **File** → **Add Package Dependencies...**
3. Click **Add Local...** (button at the bottom-left of the dialog).
4. Navigate to and select the `CivicaDesignSystem` folder (the one containing
   `Package.swift`). Click **Add Package**.
5. When Xcode prompts to choose a target, check **`VoteNow`**. Click **Add Package**.
6. Build (Cmd+B). Should succeed.
7. Commit the `Civica.xcodeproj/project.pbxproj` changes and push.
