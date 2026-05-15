import Foundation
import Testing
@testable import Civica

// Tests for SNAPApplicationDraftStore (save/load/clear) and the
// Codable round-trip for SNAPApplicationDraft + every answer struct.
// Each test gets its own UserDefaults suite so nothing leaks to disk.

struct SNAPDraftPersistenceTests {

    // MARK: - Helpers

    /// Returns a fresh UserDefaults suite isolated to this test run.
    private func makeDefaults() -> UserDefaults {
        let suite = "test.civica.snap.draft.\(UUID().uuidString)"
        return UserDefaults(suiteName: suite)!
    }

    // MARK: - Store: load/save/clear

    @Test func loadReturnsNilWhenNothingPersisted() {
        let store = SNAPApplicationDraftStore(defaults: makeDefaults())
        #expect(store.load() == nil)
    }

    @Test func saveAndLoadRoundTripsSequentialMode() {
        let defaults = makeDefaults()
        let store = SNAPApplicationDraftStore(defaults: defaults)

        var draft = SNAPApplicationDraft()
        draft.whereApplying.stateCode = "CA"
        draft.household.householdSize = "3"
        draft.income.grossMonthlyIncome = 2_400

        let state = SNAPApplicationDraftStore.PersistedState(
            draft: draft,
            mode: .sequential,
            sequentialSection: .income
        )
        store.save(state)

        let loaded = store.load()
        #expect(loaded?.mode == .sequential)
        #expect(loaded?.sequentialSection == .income)
        #expect(loaded?.draft.whereApplying.stateCode == "CA")
        #expect(loaded?.draft.household.householdSize == "3")
        #expect(loaded?.draft.income.grossMonthlyIncome == 2_400)
    }

    @Test func saveAndLoadRoundTripsReviewMode() {
        let store = SNAPApplicationDraftStore(defaults: makeDefaults())

        let state = SNAPApplicationDraftStore.PersistedState(
            draft: SNAPApplicationDraft(),
            mode: .review,
            sequentialSection: nil
        )
        store.save(state)

        let loaded = store.load()
        #expect(loaded?.mode == .review)
        #expect(loaded?.sequentialSection == nil)
    }

    @Test func clearRemovesPersistedState() {
        let store = SNAPApplicationDraftStore(defaults: makeDefaults())

        store.save(SNAPApplicationDraftStore.PersistedState(
            draft: SNAPApplicationDraft(),
            mode: .sequential,
            sequentialSection: .whereApplying
        ))
        store.clear()

        #expect(store.load() == nil)
    }

    @Test func saveTwiceLastWriteWins() {
        let defaults = makeDefaults()
        let store = SNAPApplicationDraftStore(defaults: defaults)

        var draft1 = SNAPApplicationDraft()
        draft1.whereApplying.stateCode = "MA"
        store.save(SNAPApplicationDraftStore.PersistedState(
            draft: draft1, mode: .sequential, sequentialSection: .whereApplying
        ))

        var draft2 = SNAPApplicationDraft()
        draft2.whereApplying.stateCode = "CA"
        store.save(SNAPApplicationDraftStore.PersistedState(
            draft: draft2, mode: .review, sequentialSection: nil
        ))

        let loaded = store.load()
        #expect(loaded?.draft.whereApplying.stateCode == "CA")
        #expect(loaded?.mode == .review)
    }

    @Test func twoStoresOnSameSuiteShareData() {
        let defaults = makeDefaults()
        let writer = SNAPApplicationDraftStore(defaults: defaults)
        let reader = SNAPApplicationDraftStore(defaults: defaults)

        var draft = SNAPApplicationDraft()
        draft.applicantAge.dateOfBirth = Date(timeIntervalSince1970: 946_684_800) // 2000-01-01
        writer.save(SNAPApplicationDraftStore.PersistedState(
            draft: draft, mode: .sequential, sequentialSection: .applicantAge
        ))

        let loaded = reader.load()
        #expect(loaded?.draft.applicantAge.dateOfBirth == Date(timeIntervalSince1970: 946_684_800))
    }

    // MARK: - SNAPApplicationDraft: Codable round-trip

    @Test func emptyDraftCodecRoundTrip() throws {
        let draft = SNAPApplicationDraft()
        let data = try JSONEncoder().encode(draft)
        let decoded = try JSONDecoder().decode(SNAPApplicationDraft.self, from: data)
        #expect(draft == decoded)
    }

    @Test func fullyPopulatedDraftCodecRoundTrip() throws {
        var draft = SNAPApplicationDraft()
        draft.whereApplying.stateCode = "CA"
        draft.whereApplying.housingStatus = .stableHome
        draft.applicantAge.dateOfBirth = Date(timeIntervalSince1970: 0)
        draft.household.householdSize = "2"
        draft.household.hasMinorInHousehold = true
        draft.household.hasElderlyOrDisabled = false
        draft.contact.email = "test@example.com"
        draft.contact.phone = "5551234567"
        draft.contact.preferredMethod = .email
        draft.income.anyoneEarning = .yes
        draft.income.grossMonthlyIncome = 3_000
        draft.income.incomeChangesMonthToMonth = .no
        draft.income.hasUnearnedIncome = .notSure
        draft.studentStatus.enrolledInHigherEd = false
        draft.expenses.monthlyRentOrHousing = 1_200
        draft.expenses.monthlyUtilities = 150
        draft.expenses.monthlyChildcare = 0
        draft.expenses.monthlyMedical = 50
        draft.documentsChecklist.documentsAvailable = [.photoID, .proofOfIncome]

        let data = try JSONEncoder().encode(draft)
        let decoded = try JSONDecoder().decode(SNAPApplicationDraft.self, from: data)
        #expect(draft == decoded)
    }

    @Test func documentsChecklistDocumentsAvailableRoundTripsAllTypes() throws {
        var draft = SNAPApplicationDraft()
        draft.documentsChecklist.documentsAvailable = Set(SNAPDocumentType.allCases)

        let data = try JSONEncoder().encode(draft)
        let decoded = try JSONDecoder().decode(SNAPApplicationDraft.self, from: data)
        #expect(decoded.documentsChecklist.documentsAvailable == Set(SNAPDocumentType.allCases))
    }

    @Test func persistedModeRawValuesAreStable() {
        // Changing these raw values would silently break persisted state for existing users.
        #expect(SNAPApplicationDraftStore.PersistedMode.sequential.rawValue == "sequential")
        #expect(SNAPApplicationDraftStore.PersistedMode.review.rawValue == "review")
    }

    // MARK: - SNAPApplicationSection

    @Test func sectionOneBasedIndexMatchesCaseIterableOrder() {
        for (offset, section) in SNAPApplicationSection.allCases.enumerated() {
            #expect(section.oneBasedIndex == offset + 1)
        }
    }

    @Test func sectionCountEqualsAllCasesCount() {
        #expect(SNAPApplicationSection.count == SNAPApplicationSection.allCases.count)
    }

    @Test func requiredSectionsExcludeContactAndDocuments() {
        let optional: Set<SNAPApplicationSection> = [.contact, .documentsChecklist]
        for section in SNAPApplicationSection.allCases {
            if optional.contains(section) {
                #expect(!section.isRequired)
            } else {
                #expect(section.isRequired)
            }
        }
    }
}
