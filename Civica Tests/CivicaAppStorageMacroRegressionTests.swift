import Foundation
import Testing

// Regression for the T15 (#383) codemod that stripped the `@AppStorage`
// macro prefix from 9 declarations, replacing `@AppStorage(CivicaAppStorageKeys.fooKey)`
// with a bare `(CivicaAppStorageKeys.fooKey)`. The mangled form is a syntax
// error in Swift — every iOS build on codex/rebuild-feb18 from 2026-05-30
// onward failed at parse until this fix landed.
//
// This is a SOURCE-level regression test (not behavioral): it reads the
// affected files from disk via `#filePath` and asserts each known
// CivicaAppStorageKeys-backed property declaration carries the
// `@AppStorage(` prefix. A future codemod that re-strips the macro
// without updating callsites fails this suite before it can fail CI.
@Suite("CivicaAppStorageKeys macro prefix regression (PR #383 fallout)")
struct CivicaAppStorageMacroRegressionTests {

    /// Each entry: source file (relative to repo root), and the
    /// CivicaAppStorageKeys.<member> name(s) declared inside that file.
    private static let expectations: [(relativePath: String, keys: [String])] = [
        ("Civica/App/CivicaRootView.swift", [
            "hasCompletedOnboarding",
            "recertInProgress",
        ]),
        ("Civica/App/CivicaSNAPFlowView.swift", [
            "recertInProgress",
            "buddyHasSeenApplyIntro",
            "buddyName",
            "buddyContact",
        ]),
        ("Civica/Features/RecertificationCompanion/Reminders/RecertNotificationPermissionView.swift", [
            "recertCompanionPermissionDismissed",
        ]),
        ("Civica/Features/SNAP/FindHelp/FindHelpRootView.swift", [
            "findHelpHasSeenOnboarding",
        ]),
        ("Civica/Features/SNAP/Application/SNAPDataDeletionView.swift", [
            "hasCompletedOnboarding",
            "recertInProgress",
        ]),
    ]

    @Test("Every CivicaAppStorageKeys declaration carries the @AppStorage macro prefix")
    func everyKeyDeclarationCarriesAppStorageMacro() throws {
        let repoRoot = Self.repoRoot()
        for (relativePath, keys) in Self.expectations {
            let fileURL = repoRoot.appendingPathComponent(relativePath)
            let source = try String(contentsOf: fileURL, encoding: .utf8)

            // Negative assertion — guards the exact regression PR #383 introduced.
            #expect(
                !source.contains("\n    (CivicaAppStorageKeys."),
                "\(relativePath) contains a bare `(CivicaAppStorageKeys.…)` line — `@AppStorage` macro is missing"
            )

            // Positive assertion — every named key must appear prefixed.
            for key in keys {
                let needle = "@AppStorage(CivicaAppStorageKeys.\(key))"
                #expect(
                    source.contains(needle),
                    "\(relativePath) should declare `\(needle)` but does not"
                )
            }
        }
    }

    /// Walks up from this test file's location to the repo root. The test
    /// target ships its sources inside `Civica Tests/`, so two `deletingLastPathComponent()`
    /// hops lands at the repo root. Using `#filePath` keeps the lookup
    /// resilient to checkout location.
    private static func repoRoot(file: StaticString = #filePath) -> URL {
        let fileURL = URL(fileURLWithPath: String(describing: file))
        return fileURL
            .deletingLastPathComponent()  // Civica Tests/
            .deletingLastPathComponent()  // repo root
    }
}
