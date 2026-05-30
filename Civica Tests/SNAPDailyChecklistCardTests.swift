import Foundation
import Testing
@testable import Civica

// JR-1 of the iOS product audit (2026-05-29).
//
// `SNAPDailyChecklistCard` adds a status-aware list of "things you can do
// today" to the Phase 2 home. Two qualities are load-bearing:
//
//   1. The item set is correct per status sub-state, ≤ 5 items each
//      (audit guard rail), with full bilingual parity.
//   2. Persistence is keyed per-status, so a status transition renders
//      a fresh checklist without erasing the previously-checked state
//      for the prior status (return-trips restore it).
//
// The Civica target does not link a SwiftUI behavioral-test harness, so
// "tap toggles persistence" is tested at the storage layer: the row's
// `@AppStorage` key is the canonical `SNAPDailyChecklist.storageKey(...)`
// and a write to that key is observed by a fresh read.

@Suite(.serialized)
struct SNAPDailyChecklistCardTests {

    private let suite = "co.civica.tests.dailyChecklistCard"

    private var defaults: UserDefaults {
        UserDefaults(suiteName: suite)!
    }

    init() {
        defaults.removePersistentDomain(forName: suite)
    }

    // MARK: - Item set per status

    private static let supportedStatuses: [SNAPApplicationStatus] = [
        .submittedToState,
        .documentsRequested,
        .interviewScheduled,
        .interviewCompleted,
    ]

    @Test(
        "Every supported status returns 3-5 items (audit guard rail: under 5)",
        arguments: supportedStatuses
    )
    func itemCountStaysUnderFive(status: SNAPApplicationStatus) {
        let items = SNAPDailyChecklist.items(for: status)
        #expect(items.count >= 3, "\(status.rawValue) should have at least 3 items")
        #expect(items.count <= 5, "\(status.rawValue) must have at most 5 items (audit guard rail)")
    }

    @Test(
        "Item slugs are unique within a status (key collisions would alias persistence)",
        arguments: supportedStatuses
    )
    func slugsAreUniqueWithinStatus(status: SNAPApplicationStatus) {
        let slugs = SNAPDailyChecklist.items(for: status).map(\.slug)
        #expect(Set(slugs).count == slugs.count, "\(status.rawValue) has duplicate slugs: \(slugs)")
    }

    @Test("Statuses outside the supported Phase 2 sub-states return no items")
    func unsupportedStatusesReturnEmpty() {
        let unsupported: [SNAPApplicationStatus] = [
            .notStarted, .screenerInProgress, .screenerComplete,
            .packetGenerated, .decisionApproved, .decisionDenied, .recertDue,
        ]
        for status in unsupported {
            #expect(
                SNAPDailyChecklist.items(for: status).isEmpty,
                "\(status.rawValue) should not render the daily checklist"
            )
        }
    }

    @Test(
        "Each item carries a non-empty English and Spanish title",
        arguments: supportedStatuses
    )
    func bilingualParityForEachItem(status: SNAPApplicationStatus) {
        for item in SNAPDailyChecklist.items(for: status) {
            #expect(!item.title.en.isEmpty, "\(status.rawValue)/\(item.slug) missing en copy")
            #expect(!item.title.es.isEmpty, "\(status.rawValue)/\(item.slug) missing es copy")
            #expect(
                item.title.en != item.title.es,
                "\(status.rawValue)/\(item.slug) en and es appear identical — likely a translation gap"
            )
        }
    }

    @Test("Card title has bilingual parity")
    func cardTitleBilingualParity() {
        #expect(!SNAPDailyChecklistStrings.cardTitle.en.isEmpty)
        #expect(!SNAPDailyChecklistStrings.cardTitle.es.isEmpty)
        #expect(SNAPDailyChecklistStrings.cardTitle.en != SNAPDailyChecklistStrings.cardTitle.es)
    }

    // MARK: - Status-aware content

    @Test("Submitted-to-state surfaces the day-30 follow-up reminder")
    func submittedSurfacesDay30Reminder() {
        let slugs = SNAPDailyChecklist.items(for: .submittedToState).map(\.slug)
        #expect(slugs.contains("set-day-30-reminder"))
    }

    @Test("Documents-requested surfaces a portal upload step")
    func documentsRequestedSurfacesUploadStep() {
        let slugs = SNAPDailyChecklist.items(for: .documentsRequested).map(\.slug)
        #expect(slugs.contains("upload-via-portal"))
    }

    @Test("Interview-scheduled surfaces a phone-audio test step")
    func interviewScheduledSurfacesAudioTest() {
        let slugs = SNAPDailyChecklist.items(for: .interviewScheduled).map(\.slug)
        #expect(slugs.contains("test-phone-audio"))
    }

    @Test("Interview-completed surfaces the appeal-window lookup")
    func interviewCompletedSurfacesAppealLookup() {
        let slugs = SNAPDailyChecklist.items(for: .interviewCompleted).map(\.slug)
        #expect(slugs.contains("look-up-appeal-window"))
    }

    // MARK: - Storage key formation

    @Test("Storage key uses the audit-locked prefix + status raw + slug")
    func storageKeyFormation() {
        let key = SNAPDailyChecklist.storageKey(
            status: .submittedToState,
            slug: "save-county-number"
        )
        #expect(key == "co.civica.dailyChecklist.submitted_to_state.save-county-number")
        #expect(key.hasPrefix(CivicaAppStorageKeys.dailyChecklistPrefix + "."))
    }

    // MARK: - Persistence round-trip (stands in for "tap toggles state")

    @Test("Writing to a checklist row's @AppStorage key round-trips")
    func persistenceRoundTrips() {
        let key = SNAPDailyChecklist.storageKey(
            status: .submittedToState,
            slug: "save-county-number"
        )
        #expect(defaults.bool(forKey: key) == false)
        defaults.set(true, forKey: key)
        #expect(defaults.bool(forKey: key) == true)
    }

    // MARK: - Reset semantics on status transition

    @Test("Status transition shows a fresh item set but preserves prior-status state")
    func statusTransitionPreservesPriorStateAndShowsFreshItems() {
        // Check an item under .submittedToState.
        let priorKey = SNAPDailyChecklist.storageKey(
            status: .submittedToState,
            slug: "look-up-timeline"
        )
        defaults.set(true, forKey: priorKey)

        // The new status's items are different (no slug collisions with
        // an item the user just checked under the old status).
        let priorSlugs = Set(SNAPDailyChecklist.items(for: .submittedToState).map(\.slug))
        let nextSlugs = Set(SNAPDailyChecklist.items(for: .documentsRequested).map(\.slug))
        #expect(priorSlugs != nextSlugs, "documentsRequested should not re-show the submitted item set verbatim")

        // The new status's items default to unchecked under their own keys.
        for slug in nextSlugs {
            let nextKey = SNAPDailyChecklist.storageKey(
                status: .documentsRequested,
                slug: slug
            )
            #expect(
                defaults.bool(forKey: nextKey) == false,
                "documentsRequested/\(slug) should start unchecked"
            )
        }

        // The prior-status checked state is untouched — a return trip
        // restores it.
        #expect(defaults.bool(forKey: priorKey) == true)
    }

    @Test("Same slug under two statuses keys to distinct storage cells")
    func sameSlugAcrossStatusesIsolated() {
        // `save-county-number` appears in both .submittedToState and
        // .interviewCompleted by design. The per-status key scoping
        // means checking one does not check the other.
        let submittedKey = SNAPDailyChecklist.storageKey(
            status: .submittedToState,
            slug: "save-county-number"
        )
        let completedKey = SNAPDailyChecklist.storageKey(
            status: .interviewCompleted,
            slug: "save-county-number"
        )
        #expect(submittedKey != completedKey)

        defaults.set(true, forKey: submittedKey)
        #expect(defaults.bool(forKey: completedKey) == false)
    }
}
