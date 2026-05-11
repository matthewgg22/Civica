# Civica iOS target — one-time Xcode setup

Everything outside of project.pbxproj is in place. This file walks you through the four Xcode UI steps that finish wiring the new Civica target. Total time: ~10 minutes.

If you'd rather skip and just point at the running app, the **VoteNow** scheme already builds democracy-only without SNAP.

---

## Prereqs

- You're on the `claude/civica-snap-v1` branch (worktree at `.claude/worktrees/civica-snap-v1/`).
- Xcode 16+ is open with `Civica.xcodeproj`.
- Latest disk state confirmed:
  ```bash
  ls Civica/App Civica/Assets.xcassets Civica/Features/SNAP
  ls "Civica Tests"
  ```
  All three should list files.

---

## Step 1 — Add the Civica app target

**File menu → New → Target…**

In the picker:
- Platform: **iOS**
- Template: **App**
- Click Next.

In the configuration sheet:
| Field | Value |
|---|---|
| Product Name | `Civica` |
| Team | (your team — same as VoteNow) |
| Organization Identifier | `co.civica` (so the bundle id resolves to `co.civica.Civica`; we override below) |
| Bundle Identifier | leave Xcode's default — we'll edit |
| Interface | **SwiftUI** |
| Language | **Swift** |
| Storage | **None** |
| Include Tests | **YES** (creates `CivicaTests` target — we'll redirect it at the existing `Civica Tests/` folder below) |

Click **Finish**. Xcode creates the target and drops some default files into a new top-level group it calls `Civica`. We'll delete those next.

---

## Step 2 — Point the Civica target at the existing `Civica/` folder

Xcode just created `Civica/CivicaApp.swift`, `Civica/ContentView.swift`, `Civica/Assets.xcassets`, etc. as NEW files inside a new group, which collides with the `Civica/` directory I already populated on disk.

**Delete Xcode's auto-generated Civica files first:**
1. In the project navigator (⌘1), select the new `Civica` group Xcode created.
2. Expand it. Delete:
   - `CivicaApp.swift` (Xcode's stub)
   - `ContentView.swift` (Xcode's stub — not the VoteNow one)
   - `Assets.xcassets` (Xcode's stub)
   - `Civica.entitlements` (if Xcode created one — keep mine instead)
   - `Preview Content/` (Xcode's stub)
   - The `Info` plist entries Xcode set inline — we want the file I created
3. Choose **Move to Trash** when prompted (these are Xcode's stubs, not mine).

**Now add the on-disk `Civica/` folder as a file-system-synchronized group:**
1. Right-click the project root (top of the navigator) → **Add Files to "Civica"…**
2. Navigate to the repo root, select the `Civica/` folder.
3. In the dialog:
   - **Action**: "Create groups" → **change to "Create folder references"** (this is Xcode 16's synchronized group)
   - Or if you see "Add as: Group / Folder", pick **Folder**
   - **Targets**: check **Civica**, uncheck **VoteNow**.
4. Click Add.

The `Civica/` folder appears in the navigator as a synced group (yellow folder icon with a small sync arrow). Every file under it is now part of the Civica target automatically.

---

## Step 3 — Wire bundle id, Info.plist, entitlements, asset catalog

Select the **Civica** target → **General** tab:

| Setting | Value |
|---|---|
| Display Name | `Civica` |
| Bundle Identifier | `co.civica.benefits` |
| Version | `1.0` |
| Build | `1` |
| Deployment Info → iOS | `18.2` (same as VoteNow) |
| Supported Destinations | iPhone, iPad |
| App Icons → AppIcon | (auto-picks from Civica/Assets.xcassets/AppIcon) |
| Launch Screen → Color | LaunchBackground (auto-picks from Civica/Assets.xcassets) |

Then **Signing & Capabilities** tab:

1. **Automatically manage signing** → ON
2. **Team** → same as VoteNow
3. Click **+ Capability** → add **App Groups** → check `group.co.civica.benefits` (you'll need to enable this group on the developer portal too, but Xcode will prompt)
4. **Code Signing Entitlements** → drag in or set: `Civica/Civica.entitlements`

Then **Build Settings** tab → search `Info.plist`:

1. **Info.plist File** → set to: `Civica/Info.plist`
2. **Generate Info.plist File** → set to **NO** (we want to use mine, not let Xcode generate)
3. Search for `INFOPLIST_KEY` and delete every `INFOPLIST_KEY_*` row Xcode added — they conflict with my Info.plist.

Search for `Active Compilation Conditions`:
- **Debug** row → add `SNAP_DEV` and `SNAP_CONVERSATION_ENABLED` (or leave empty if you want production-shaped SNAP in dev builds; presence of these flags only turns on extra UI not core functionality)
- **Release** row → leave empty

---

## Step 4 — Add CivicaDesignSystem and any other packages Civica needs

Civica → **General** tab → **Frameworks, Libraries, and Embedded Content** → click **+**:

- **CivicaDesignSystem** (local package — should appear under Workspace Library)
- **Supabase** — Find Help uses Supabase RPC; pick the `Supabase` product
- Anything else the Find Help / SNAP code imports that isn't a system framework

If a future build error says "no such module X", come back here and add the missing dep.

---

## Step 5 — Redirect the CivicaTests target at the existing `Civica Tests/` folder

Xcode created an empty `CivicaTests/` folder for the test target. Repeat steps 2 + 3 for tests:

1. Delete Xcode's auto-generated test stub files.
2. Right-click → Add Files → select the on-disk `Civica Tests/` folder (note the space) → Targets: **CivicaTests** only → Add as folder reference.
3. CivicaTests → Build Settings → search `INFOPLIST_KEY` → delete the auto-added ones.
4. Rename the test target from `CivicaTests` to `Civica Tests` for consistency (optional but matches the folder name).

---

## Step 6 — Delete VoteNow's leftover SNAP infrastructure

VoteNow no longer has any SNAP source code, but there's leftover scheme + configuration scaffolding from the old shared-target days:

1. **Product → Scheme → Manage Schemes…**
2. Delete **VoteNow SNAP Dev** (it pointed at the old shared target's SNAP config; meaningless now).
3. Select **VoteNow** target → Build Settings → search "Debug SNAP":
4. There's a build configuration called **Debug SNAP** on the project — delete it (Editor menu → click Project root → Configurations → select "Debug SNAP" → minus button).
5. After deletion, the old "SNAP Dev" entitlements + bundle id (`Turnout-the-Vote.Civica.snapdev`) vanish too.

---

## Step 7 — Verify both apps build

```bash
# Civica enrollment app
xcodebuild -project Civica.xcodeproj -scheme Civica -configuration Debug -destination 'generic/platform=iOS Simulator' build

# VoteNow democracy app
xcodebuild -project Civica.xcodeproj -scheme VoteNow -configuration Debug -destination 'generic/platform=iOS Simulator' build
```

Both should end in **BUILD SUCCEEDED**. If either fails, paste me the error and I'll diagnose.

---

## Step 8 — Smoke-test in simulator

1. Pick the **Civica** scheme, hit ▶.
2. App should launch into the SNAP entry tile.
3. Tap through to the eligibility intro → toggle "I'm in MA" → Continue.
4. Because `SNAP_CONVERSATION_ENABLED` is set (Step 3), you should see the LLM-driven conversation flow, not the static questionnaire.
5. The mock backend walks the canonical demo to "eligible $135/month."

---

## What "done" looks like

- Two schemes in the run-target dropdown: `VoteNow` and `Civica`.
- Two apps in the simulator with different icons + bundle ids.
- Voting/democracy work happens in VoteNow.
- SNAP enrollment work happens in Civica.
- Shared design system (Hanken Grotesk fonts, Brick/Teal/Paper palette) renders identically in both because both link `CivicaDesignSystem`.

After this is working, the backlog is: real backend (FastAPI), Supabase Storage for documents, magic-link recovery wiring, additional eval traces, and the deferred SNAP review fixes from [/Users/matthewgreer-gentis/.claude/plans/so-for-the-snap-keen-cocoa.md](/Users/matthewgreer-gentis/.claude/plans/so-for-the-snap-keen-cocoa.md).
