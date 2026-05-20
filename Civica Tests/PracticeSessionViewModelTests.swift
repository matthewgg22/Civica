import Foundation
import Testing
@testable import Civica

// In-process mock provider that returns scripted responses for the
// start → respond loop.
@MainActor
final class MockInterviewCoachClient: InterviewCoachProviding {
    var startResult: StartPracticeResponseDTO = StartPracticeResponseDTO(
        sessionId: "sess-1",
        firstQuestion: InterviewTurnDTO(
            questionId: "q1",
            questionText: "First question",
            response: nil
        )
    )
    var respondResults: [PracticeRespondResponseDTO] = []
    var stateResult: PracticeSessionStateDTO?

    var startInvocations: [String] = []  // recertIds
    var respondInvocations: [(String, String, String)] = []  // (recertId, sessionId, message)

    nonisolated func startPracticeSession(
        recertId: String,
        snapshot: PacketSnapshotDTO?
    ) async throws -> StartPracticeResponseDTO {
        await MainActor.run { startInvocations.append(recertId) }
        return await MainActor.run { startResult }
    }

    nonisolated func sendPracticeResponse(
        recertId: String,
        sessionId: String,
        response: String,
        audioBytesDuration: Int?
    ) async throws -> PracticeRespondResponseDTO {
        await MainActor.run {
            respondInvocations.append((recertId, sessionId, response))
        }
        let result: PracticeRespondResponseDTO? = await MainActor.run {
            respondResults.isEmpty ? nil : respondResults.removeFirst()
        }
        guard let result else {
            throw InterviewCoachAPIClient.CoachAPIError.emptyResponse
        }
        return result
    }

    nonisolated func fetchPracticeSession(
        recertId: String,
        sessionId: String
    ) async throws -> PracticeSessionStateDTO {
        if let s = await MainActor.run(body: { stateResult }) {
            return s
        }
        throw InterviewCoachAPIClient.CoachAPIError.notFound
    }
}

@MainActor
@Suite struct PracticeSessionViewModelTests {

    @Test func startThenRespondThenDoneFlow() async {
        let mock = MockInterviewCoachClient()
        mock.respondResults = [
            PracticeRespondResponseDTO(
                turn: InterviewTurnDTO(questionId: "q2", questionText: "Second?", response: nil),
                flags: [],
                done: false,
                coaching: "Try to be specific."
            ),
            PracticeRespondResponseDTO(
                turn: InterviewTurnDTO(questionId: "q2", questionText: "final echo", response: "ok"),
                flags: [InterviewFlagDTO(type: "income", description: "trigger")],
                done: true,
                coaching: nil
            ),
        ]

        let vm = PracticeSessionViewModel(recertId: "rec-1", client: mock)

        await vm.startIfNeeded()
        #expect(vm.sessionId == "sess-1")
        #expect(vm.status == .awaitingUser)
        #expect(vm.transcript.count == 1)
        #expect(vm.transcript.first?.questionId == "q1")

        vm.draftResponse = "I'm a gig worker."
        await vm.submitUserResponse()
        #expect(vm.status == .awaitingUser)
        #expect(vm.latestCoaching == "Try to be specific.")
        // Applicant turn + new caseworker turn appended after first turn.
        #expect(vm.transcript.count == 3)

        vm.draftResponse = "Yes, three of us."
        await vm.submitUserResponse()
        #expect(vm.status == .complete)
        #expect(vm.flags.count == 1)
    }

    @Test func emptyRecertIdSurfacesConfigError() async {
        let mock = MockInterviewCoachClient()
        let vm = PracticeSessionViewModel(recertId: "", client: mock)
        await vm.startIfNeeded()
        if case .failed(let msg) = vm.status {
            #expect(msg.lowercased().contains("not configured")
                    || msg.lowercased().contains("practice"))
        } else {
            Issue.record("Expected .failed, got \(vm.status)")
        }
        #expect(mock.startInvocations.isEmpty)
    }

    @Test func emptyDraftResponseIsIgnored() async {
        let mock = MockInterviewCoachClient()
        let vm = PracticeSessionViewModel(recertId: "rec-1", client: mock)
        await vm.startIfNeeded()
        vm.draftResponse = "   "
        await vm.submitUserResponse()
        #expect(mock.respondInvocations.isEmpty)
        #expect(vm.status == .awaitingUser)
    }
}
