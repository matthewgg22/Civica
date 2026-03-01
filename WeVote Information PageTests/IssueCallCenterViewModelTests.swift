import Foundation
import Testing
@testable import VoteNow

@MainActor
struct IssueCallCenterViewModelTests {
    private struct MockAPIClient: CivicIssueCallAPIClientProtocol {
        var resolveResponse: CivicIssueResolutionResponse
        var examples: [CivicExampleIssueCard] = []
        var history: [CivicHistoryGroup] = []

        func fetchExamples(userID: String, reps: [CivicRepTarget]) async throws -> [CivicExampleIssueCard] {
            examples
        }

        func resolve(
            userID: String,
            concernText: String,
            selectedAsk: CivicAsk,
            targetReps: [CivicRepSlot],
            optionalBillRef: String?
        ) async throws -> CivicIssueResolutionResponse {
            resolveResponse
        }

        func logCall(
            userID: String,
            repID: String,
            issueID: String,
            briefID: String,
            outcome: CivicCallOutcome,
            stafferPosition: String?,
            notes: String
        ) async throws {}

        func fetchHistory(userID: String) async throws -> [CivicHistoryGroup] {
            history
        }
    }

    @Test
    func submitAndAdvanceToNextRep() async {
        let reps = sampleFederalReps()
        let response = sampleResolution()
        let vm = IssueCallCenterViewModel(
            federalReps: reps,
            userZip: "10001",
            apiClient: MockAPIClient(resolveResponse: response),
            cacheStore: CivicCallBriefCacheStore(defaults: UserDefaults(suiteName: "IssueCallCenterViewModelTests.submitAndAdvance")!)
        )

        vm.concernText = "Air quality standards and enforcement"
        vm.selectedAsk = .support

        await vm.submitAssistantRequest()

        #expect(vm.callBriefs.count == 3)
        #expect(vm.activeBriefID == vm.filteredBriefs.first?.id)

        if let first = vm.filteredBriefs.first {
            await vm.logOutcome(for: first, outcome: .voicemail)
            #expect(vm.activeBriefID == vm.filteredBriefs.dropFirst().first?.id)
        } else {
            Issue.record("Expected first brief to exist")
        }
    }

    @Test
    func requiresExplicitAskBeforeSubmit() async {
        let vm = IssueCallCenterViewModel(
            federalReps: sampleFederalReps(),
            userZip: "10001",
            apiClient: MockAPIClient(resolveResponse: sampleResolution()),
            cacheStore: CivicCallBriefCacheStore(defaults: UserDefaults(suiteName: "IssueCallCenterViewModelTests.askRequired")!)
        )

        vm.concernText = "Constituent concern"
        vm.selectedAsk = nil

        await vm.submitAssistantRequest()

        #expect(vm.callBriefs.isEmpty)
        #expect(vm.errorMessage != nil)
    }

    private func sampleFederalReps() -> [Official] {
        [
            Official(
                name: "House Test",
                divisionId: "ocd-division/country:us/state:ny/cd:10",
                party: "Independent",
                officeTitle: "U.S. Representative",
                photoURL: nil,
                officialPhone: "(202) 555-1001"
            ),
            Official(
                name: "Senator Alpha",
                divisionId: "ocd-division/country:us/state:ny",
                party: "Independent",
                officeTitle: "U.S. Senator",
                photoURL: nil,
                officialPhone: "(202) 555-1002"
            ),
            Official(
                name: "Senator Beta",
                divisionId: "ocd-division/country:us/state:ny",
                party: "Independent",
                officeTitle: "U.S. Senator",
                photoURL: nil,
                officialPhone: "(202) 555-1003"
            )
        ]
    }

    private func sampleResolution() -> CivicIssueResolutionResponse {
        CivicIssueResolutionResponse(
            issueID: "issue-1",
            issueTitle: "Air quality standards",
            issueSummary: "Constituent asks for support",
            resolvedEntities: CivicResolvedEntities(
                bills: ["H.R.123"],
                committees: ["Energy and Commerce"],
                agencies: ["EPA"]
            ),
            callBriefs: [
                sampleBrief("brief-1", slot: .house, repName: "House Test", phone: "(202) 555-1001"),
                sampleBrief("brief-2", slot: .senate1, repName: "Senator Alpha", phone: "(202) 555-1002"),
                sampleBrief("brief-3", slot: .senate2, repName: "Senator Beta", phone: "(202) 555-1003")
            ]
        )
    }

    private func sampleBrief(_ id: String, slot: CivicRepSlot, repName: String, phone: String) -> CivicCallBrief {
        CivicCallBrief(
            id: id,
            repID: "rep-\(id)",
            repName: repName,
            officeType: slot == .house ? "U.S. Representative" : "U.S. Senator",
            primaryPhoneNumber: phone,
            localOfficePhoneNumber: nil,
            relevanceBadges: ["Related bill active"],
            relatedBills: ["H.R.123"],
            relatedCommittees: ["Energy"],
            liveScript: "Live script",
            voicemailScript: "Voicemail",
            talkingPoints: ["Point 1", "Point 2", "Point 3"],
            issueID: "issue-1",
            repSlot: slot
        )
    }
}
