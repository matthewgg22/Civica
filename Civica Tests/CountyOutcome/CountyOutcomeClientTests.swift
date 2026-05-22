import Foundation
import Testing
@testable import Civica

// The applicant's selection must survive a failed network submit —
// local persistence is the source of truth until the enrollment-api
// endpoint ships. Also covers the read-back path used by the prompt
// view to render the "got it" confirmation on re-entry.

@MainActor
@Suite(.serialized)
struct CountyOutcomeClientTests {
    private func makeSuiteDefaults(name: String = #function) -> UserDefaults {
        let suiteName = "county-outcome-tests-\(name)-\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: suiteName)!
        defaults.removePersistentDomain(forName: suiteName)
        return defaults
    }

    @Test func submit_persistsLocallyEvenWhenNetworkStubFails() async {
        let defaults = makeSuiteDefaults()
        struct StubError: Error {}
        let client = CountyOutcomeClient(
            defaults: defaults,
            now: { Date(timeIntervalSince1970: 1_780_000_000) },
            networkSubmit: { _ in throw StubError() }
        )

        let record = await client.submit(packetId: "p1", selection: .approved)

        #expect(record.selection == .approved)
        #expect(record.packetId == "p1")

        // Local record is readable on the next call — independent of
        // the failed network attempt.
        let reread = client.storedRecord(forPacketId: "p1")
        #expect(reread == record)
    }

    @Test func storedRecord_isNilForUnknownPacket() {
        let defaults = makeSuiteDefaults()
        let client = CountyOutcomeClient(defaults: defaults)
        #expect(client.storedRecord(forPacketId: "never-submitted") == nil)
    }

    @Test func submit_overwritesPriorSelectionForSamePacket() async {
        let defaults = makeSuiteDefaults()
        let client = CountyOutcomeClient(
            defaults: defaults,
            networkSubmit: { _ in /* succeed */ }
        )

        _ = await client.submit(packetId: "p2", selection: .pendingDecision)
        _ = await client.submit(packetId: "p2", selection: .approved)

        let final = client.storedRecord(forPacketId: "p2")
        #expect(final?.selection == .approved)
    }
}
