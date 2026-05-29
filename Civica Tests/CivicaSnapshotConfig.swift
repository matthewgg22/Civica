import Foundation
import SwiftUI
import SnapshotTesting
import Testing
@testable import Civica
import CivicaDesignSystem

// PR-0 of docs/audits/civica-ios-product-audit-2026-05-29.md.
//
// Closes the long-standing infra gap noted inline in
// EBTBalanceA11yTests.swift:10, EBTCardLockViewTests.swift:19, and
// EBTFeatureFlagRegressionTests.swift:17 ("Civica does not currently
// link a snapshot-testing or ViewInspector package"). With this file
// merged, subsequent audit PRs (T6 Dynamic Type, T7 dark mode + iPad)
// register against the committed PNG baselines.
//
// ┌─────────────────────────────────────────────────────────────┐
// │ HOW TO RECORD A NEW BASELINE                                │
// ├─────────────────────────────────────────────────────────────┤
// │ 1. Set CivicaSnapshotConfig.isRecording = true at the top   │
// │    of the failing test (or globally for a bulk re-record).  │
// │ 2. Run the test once — it FAILS with "Recorded snapshot".   │
// │ 3. Inspect the generated PNG under                          │
// │    Civica Tests/__Snapshots__/<TestSuite>/.                 │
// │ 4. Flip isRecording back to false.                          │
// │ 5. Re-run the test — it now PASSES against the committed    │
// │    PNG.                                                     │
// │ 6. git add Civica Tests/__Snapshots__/<TestSuite>/*.png.    │
// └─────────────────────────────────────────────────────────────┘
//
// HOW TO ADD A NEW SCREEN: see /CivicaEntryViewSnapshotTests.swift in
// the same folder for the canonical pattern (3 traits → 3 baselines
// per screen). Three traits are the minimum coverage per the audit:
//   .default   — light / default Dynamic Type
//   .xxxLarge  — light / .accessibility3 (one step below max per RA-1)
//   .dark      — dark / default Dynamic Type
//
// The pointfreeco library writes PNGs next to the test source under
// __Snapshots__/<TestSuiteName>/<TestName>.<traitTag>.png. Diffs
// surface in PR review.
//
// FONT REGISTRATION: SwiftUI tests do not run the app delegate, so
// CivicaFonts.register() must be called once before any snapshot is
// recorded. The Suite-level static initializer below handles this.

enum CivicaSnapshotConfig {

    // Master record switch. KEEP THIS FALSE in committed code. Flip to
    // true only when re-recording baselines; revert before committing.
    static let isRecording: Bool = false

    // The fixed device frame for every snapshot. iPhone 16 Pro at the
    // standard portrait size (393pt × 852pt). Choosing one fixed device
    // keeps baselines deterministic; per-device baselines would be a
    // separate matrix we don't need until iPad work lands in T7.
    static let deviceSize = CGSize(width: 393, height: 852)

    // Per-trait modifier configuration. One enum case per trait set.
    enum Trait: String, CaseIterable {
        case `default`
        case xxxLarge
        case dark

        var dynamicTypeSize: DynamicTypeSize {
            switch self {
            case .default, .dark: return .large
            case .xxxLarge:       return .accessibility3
            }
        }

        var colorScheme: ColorScheme {
            switch self {
            case .default, .xxxLarge: return .light
            case .dark:               return .dark
            }
        }

        var suffix: String { rawValue }
    }

    // Fonts have to be registered before the first SwiftUI render in
    // the test process. Calling this is idempotent — CivicaFonts.register()
    // guards against double-registration. Internal (not private) so the
    // free `civicaAssertSnapshot` helper below can touch it.
    static let bootstrap: Void = {
        CivicaFonts.register()
    }()
}

/// Records or verifies one snapshot per Trait for a given view.
/// Call from a Swift Testing `@Test` function; one call produces three
/// baselines (default / xxxLarge / dark). Failures fail the test.
///
/// `testName` defaults to `#function`, which at the caller resolves to
/// the @Test function name — so the generated PNG filenames look like
/// `phase1ColdStart().phase1-coldstart-default.png` instead of the
/// mangled `civicaAssertSnapshot-of-named-...` prefix.
@MainActor
func civicaAssertSnapshot<V: View>(
    of view: V,
    named name: String,
    fileID: StaticString = #fileID,
    file filePath: StaticString = #filePath,
    testName: String = #function,
    line: UInt = #line
) {
    // Touch the bootstrap so CivicaFonts.register() runs once.
    _ = CivicaSnapshotConfig.bootstrap

    for trait in CivicaSnapshotConfig.Trait.allCases {
        let wrapped = AnyView(
            view
                .environment(\.dynamicTypeSize, trait.dynamicTypeSize)
                .preferredColorScheme(trait.colorScheme)
                .frame(
                    width: CivicaSnapshotConfig.deviceSize.width,
                    height: CivicaSnapshotConfig.deviceSize.height
                )
        )
        let hosting = UIHostingController(rootView: wrapped)
        hosting.view.frame = CGRect(origin: .zero, size: CivicaSnapshotConfig.deviceSize)
        hosting.overrideUserInterfaceStyle = (trait.colorScheme == .dark) ? .dark : .light

        let snapshotName = "\(name).\(trait.suffix)"

        // pointfreeco's swift-snapshot-testing 1.19.x exposes the
        // new `record: SnapshotTestingConfiguration.Record?` parameter
        // (legacy `Bool` overload is deprecated). `.all` re-records
        // every baseline; `nil` (default) verifies against the
        // committed PNGs. Swift Testing surfaces assertSnapshot
        // failures the same way it surfaces XCTest assertions.
        assertSnapshot(
            of: hosting,
            as: .image(
                precision: 0.99,
                perceptualPrecision: 0.98,
                size: CivicaSnapshotConfig.deviceSize
            ),
            named: snapshotName,
            record: CivicaSnapshotConfig.isRecording ? .all : nil,
            fileID: fileID,
            file: filePath,
            testName: testName,
            line: line
        )
    }
}
