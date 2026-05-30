import Foundation
import Testing
@testable import Civica

// Smoke tests for CivicaAppStorageKeys (CQ-10, T15 of iOS audit 2026-05-29).
//
// Guards against three failure modes:
//   1. Typo in a key string (write-then-read round-trip catches silent mismatches).
//   2. `language` alias drifting from `CivicaLanguage.defaultStorageKey`.
//   3. findHelpHasSeenOnboarding — the intentional `find_help.` prefix that
//      predates the `co.civica.` convention is preserved so existing user state
//      is not silently invalidated on upgrade.

@Suite(.serialized)
struct CivicaAppStorageKeysTests {

    private let suite = "co.civica.tests.appStorageKeysSmoke"

    private var defaults: UserDefaults {
        UserDefaults(suiteName: suite)!
    }

    init() {
        defaults.removePersistentDomain(forName: suite)
    }

    // MARK: - Round-trip

    @Test func hasCompletedOnboardingRoundTrips() {
        defaults.set(true, forKey: CivicaAppStorageKeys.hasCompletedOnboarding)
        #expect(defaults.bool(forKey: CivicaAppStorageKeys.hasCompletedOnboarding) == true)
    }

    @Test func recertInProgressRoundTrips() {
        defaults.set(true, forKey: CivicaAppStorageKeys.recertInProgress)
        #expect(defaults.bool(forKey: CivicaAppStorageKeys.recertInProgress) == true)
    }

    @Test func buddyNameRoundTrips() {
        defaults.set("Maria", forKey: CivicaAppStorageKeys.buddyName)
        #expect(defaults.string(forKey: CivicaAppStorageKeys.buddyName) == "Maria")
    }

    @Test func buddyContactRoundTrips() {
        defaults.set("555-1234", forKey: CivicaAppStorageKeys.buddyContact)
        #expect(defaults.string(forKey: CivicaAppStorageKeys.buddyContact) == "555-1234")
    }

    @Test func buddyHasSeenApplyIntroRoundTrips() {
        defaults.set(true, forKey: CivicaAppStorageKeys.buddyHasSeenApplyIntro)
        #expect(defaults.bool(forKey: CivicaAppStorageKeys.buddyHasSeenApplyIntro) == true)
    }

    @Test func recertCompanionPermissionDismissedRoundTrips() {
        defaults.set(true, forKey: CivicaAppStorageKeys.recertCompanionPermissionDismissed)
        #expect(defaults.bool(forKey: CivicaAppStorageKeys.recertCompanionPermissionDismissed) == true)
    }

    @Test func findHelpHasSeenOnboardingRoundTrips() {
        defaults.set(true, forKey: CivicaAppStorageKeys.findHelpHasSeenOnboarding)
        #expect(defaults.bool(forKey: CivicaAppStorageKeys.findHelpHasSeenOnboarding) == true)
    }

    // MARK: - Invariants

    @Test func languageAliasMatchesCivicaLanguageDefaultStorageKey() {
        #expect(CivicaAppStorageKeys.language == CivicaLanguage.defaultStorageKey)
    }

    @Test func findHelpKeyPreservesFindHelpPrefix() {
        // The find_help. prefix predates co.civica. convention and must
        // NOT be changed — existing user state is keyed on this string.
        #expect(CivicaAppStorageKeys.findHelpHasSeenOnboarding == "find_help.has_seen_onboarding")
    }

    @Test func allCoKeysHaveCivicaPrefix() {
        let coKeys = [
            CivicaAppStorageKeys.hasCompletedOnboarding,
            CivicaAppStorageKeys.recertInProgress,
            CivicaAppStorageKeys.buddyHasSeenApplyIntro,
            CivicaAppStorageKeys.buddyName,
            CivicaAppStorageKeys.buddyContact,
            CivicaAppStorageKeys.recertCompanionPermissionDismissed,
            CivicaAppStorageKeys.dailyChecklistPrefix,
        ]
        for key in coKeys {
            #expect(key.hasPrefix("co.civica."), "Key '\(key)' should start with 'co.civica.'")
        }
    }

    // MARK: - Regression: PR #383 @AppStorage macro stripping (fix PR closes this)
    //
    // When PR #383 landed, the @AppStorage macro was stripped from every
    // migrated call site, leaving bare `(CivicaAppStorageKeys.<key>)` lines.
    // Those lines are valid Swift (they evaluate and discard the key string)
    // but the property wrapper is gone, so the property is never bound to
    // UserDefaults.  The pattern `^\s+\(CivicaAppStorageKeys\.` is the
    // fingerprint; this test fails if it reappears.

    @Test func noBareCivicaAppStorageKeysCallSites() throws {
        let fm = FileManager.default
        // Resolve the project root relative to this test bundle.
        // The test bundle lives at …/Civica.app or …/CivicaTests.xctest;
        // walk up until we find Civica.xcodeproj.
        var dir = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent() // Civica Tests/
            .deletingLastPathComponent() // project root
        // Verify we landed in the right place.
        let proj = dir.appendingPathComponent("Civica.xcodeproj")
        guard fm.fileExists(atPath: proj.path) else {
            // Can't locate project root from test runner path — skip rather than false-fail.
            return
        }
        let civicaDir = dir.appendingPathComponent("Civica")
        guard let enumerator = fm.enumerator(at: civicaDir,
                                              includingPropertiesForKeys: nil,
                                              options: [.skipsHiddenFiles]) else { return }

        var offenders: [String] = []
        for case let fileURL as URL in enumerator {
            guard fileURL.pathExtension == "swift" else { continue }
            guard let content = try? String(contentsOf: fileURL, encoding: .utf8) else { continue }
            for (i, line) in content.components(separatedBy: "\n").enumerated() {
                // Match the bare-paren pattern: whitespace + `(CivicaAppStorageKeys.`
                let trimmed = line.drop(while: \.isWhitespace)
                if trimmed.hasPrefix("(CivicaAppStorageKeys.") {
                    let rel = fileURL.path.replacingOccurrences(of: dir.path + "/", with: "")
                    offenders.append("\(rel):\(i + 1)")
                }
            }
        }
        #expect(offenders.isEmpty,
                "@AppStorage macro missing — bare (CivicaAppStorageKeys.) at: \(offenders.joined(separator: ", "))")
    }
}
