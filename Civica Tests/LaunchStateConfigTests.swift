import Foundation
import Testing
@testable import Civica

// Pins the launch-state feature-flag contract that SNAPAgencyDirectory
// + every state-conditioned surface reads from. Uses an isolated
// UserDefaults suite so cross-test bleed can't accidentally flip the
// default behaviour for other suites.

@Suite(.serialized) // serialized: nonisolated(unsafe) static store
struct LaunchStateConfigTests {

    init() {
        let suiteName = "co.civica.LaunchStateConfigTests"
        let suite = UserDefaults(suiteName: suiteName)!
        suite.removePersistentDomain(forName: suiteName)
        LaunchStateConfig.setStore(suite)
    }

    @Test func defaultIsCA() {
        LaunchStateConfig.clearCachedValue()
        #expect(LaunchStateConfig.current == "CA")
    }

    @Test func canBeFlippedToMA() {
        LaunchStateConfig.setCachedValue("MA")
        #expect(LaunchStateConfig.current == "MA")
        // SNAPAgencyDirectory surfaces immediately reflect the change.
        #expect(SNAPAgencyDirectory.launchStateCode == "MA")
    }

    @Test func uppercasesInputForCacheConsistency() {
        LaunchStateConfig.setCachedValue("ma")
        #expect(LaunchStateConfig.current == "MA")
    }

    @Test func unsupportedValueFallsBackToDefault() {
        // Misconfigured server response (e.g. "NY" when NY isn't yet
        // supported) must not strand the app — fall back to default.
        LaunchStateConfig.setCachedValue("NY")
        #expect(LaunchStateConfig.current == "CA")
    }

    @Test func clearedCacheRevertsToDefault() {
        LaunchStateConfig.setCachedValue("MA")
        LaunchStateConfig.clearCachedValue()
        #expect(LaunchStateConfig.current == "CA")
    }

    @Test func snapAgencyDirectoryReadsThroughTheFlag() {
        LaunchStateConfig.setCachedValue("MA")
        #expect(SNAPAgencyDirectory.launchStateCode == "MA")
        LaunchStateConfig.setCachedValue("CA")
        #expect(SNAPAgencyDirectory.launchStateCode == "CA")
    }
}
