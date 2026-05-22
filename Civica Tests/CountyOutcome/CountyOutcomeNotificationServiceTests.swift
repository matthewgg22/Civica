import Foundation
import Testing
import UserNotifications
@testable import Civica

// Verifies scheduling semantics for the applicant-side +14d county-
// outcome push. The service delegates to UNUserNotificationCenter via
// UserNotificationCenterProtocol — these tests substitute an
// in-memory fake so we can assert against requests without touching
// the real system center.

@MainActor
@Suite(.serialized)
struct CountyOutcomeNotificationServiceTests {
    @Test func scheduleAsk_addsTriggerFourteenDaysOut() async throws {
        let fake = FakeUserNotificationCenter()
        let service = CountyOutcomeNotificationService(center: fake)

        let now = Date(timeIntervalSince1970: 1_780_000_000)
        let fourteenDays: TimeInterval = 14 * 24 * 60 * 60

        await service.scheduleAsk(packetId: "packet-A", in: fourteenDays, now: now)

        #expect(fake.added.count == 1)
        let request = try #require(fake.added.first)
        #expect(request.identifier == "co.civica.countyOutcome.packet-A.ask")

        let trigger = try #require(request.trigger as? UNCalendarNotificationTrigger)
        let fireDate = try #require(trigger.nextTriggerDate())
        // Trigger fires within a minute of the +14d mark (granularity
        // is minute-level since we drop seconds).
        let expected = now.addingTimeInterval(fourteenDays)
        #expect(abs(fireDate.timeIntervalSince(expected)) < 120)
    }

    @Test func scheduleAsk_replacesExistingRequestForSamePacket() async {
        let fake = FakeUserNotificationCenter()
        let service = CountyOutcomeNotificationService(center: fake)
        let interval: TimeInterval = 14 * 24 * 60 * 60

        await service.scheduleAsk(packetId: "packet-B", in: interval, now: Date())
        await service.scheduleAsk(packetId: "packet-B", in: interval, now: Date())

        // Two adds, but each preceded by a remove of the same id —
        // so the fake's pending list should have exactly one entry.
        let pending = fake.pending
        #expect(pending.count == 1)
        #expect(pending.first?.identifier == "co.civica.countyOutcome.packet-B.ask")
        // And the removal-by-id call must have fired at least once.
        #expect(fake.removedIdentifiers.contains("co.civica.countyOutcome.packet-B.ask"))
    }

    @Test func cancelAsk_removesPendingForPacket() async {
        let fake = FakeUserNotificationCenter()
        let service = CountyOutcomeNotificationService(center: fake)

        await service.scheduleAsk(packetId: "packet-C", in: 14 * 86_400, now: Date())
        service.cancelAsk(packetId: "packet-C")

        #expect(fake.pending.isEmpty)
    }
}

// MARK: - In-memory fake center

final class FakeUserNotificationCenter: UserNotificationCenterProtocol, @unchecked Sendable {
    private(set) var added: [UNNotificationRequest] = []
    private(set) var removedIdentifiers: [String] = []
    var status: UNAuthorizationStatus = .authorized

    var pending: [UNNotificationRequest] {
        let removed = Set(removedIdentifiers)
        // Mirror UN semantics: only the *latest* add for a given id is
        // pending, and removals take effect immediately. We rebuild
        // from the add log on each read.
        var byId: [String: UNNotificationRequest] = [:]
        for request in added {
            byId[request.identifier] = request
        }
        for id in removed {
            byId.removeValue(forKey: id)
        }
        return Array(byId.values)
    }

    func currentAuthorizationStatus() async -> UNAuthorizationStatus { status }

    func requestPushAuthorization(options: UNAuthorizationOptions) async -> Bool {
        status = .authorized
        return true
    }

    func add(_ request: UNNotificationRequest) async throws {
        added.append(request)
    }

    func removePendingNotificationRequests(withIdentifiers identifiers: [String]) {
        removedIdentifiers.append(contentsOf: identifiers)
    }

    func pendingNotificationRequests() async -> [UNNotificationRequest] {
        pending
    }
}
