import Foundation
import SwiftUI

// Practice session orchestrator.
//
// Owns the transcript + status state and drives the three new enrollment-api
// recert/practice routes via InterviewCoachProviding:
//   start    → recert/:recertId/practice/start
//   respond  → recert/:recertId/practice/:sessionId/respond
//   resume   → recert/:recertId/practice/:sessionId  (GET)
//
// Active session_id is persisted under
// `co.civica.interviewCoach.activeSessionId.<recertId>` so a mid-session
// app kill can resume cleanly.
//
// recertId sourcing: there is no shared iOS recert store yet. The parent
// view (RecertCompanionRoot or a debug entry point) is responsible for
// passing a real recertId. When `recertId.isEmpty`, the VM lands in a
// `.failed` state with a clear "practice not configured" message rather
// than hitting the network. Wiring a real applicant-side recert store is
// tracked separately.
@MainActor
final class PracticeSessionViewModel: ObservableObject {
    enum SessionStatus: Equatable {
        case idle
        case awaitingCaseworker
        case awaitingUser
        case complete
        case failed(String)
    }

    struct SessionContext {
        let stateCode: String
        let stateName: String
        let scenario: InterviewScenario
        let archetype: ApplicantArchetype
        let persona: CaseworkerArchetype

        static let defaultMA = SessionContext(
            stateCode: "MA",
            stateName: "Massachusetts",
            scenario: .initial,
            archetype: .gigWorker,
            persona: .friendlyRushed
        )

        /// CA is the launch state — practice mode defaults here.
        static let defaultCA = SessionContext(
            stateCode: "CA",
            stateName: "California",
            scenario: .initial,
            archetype: .gigWorker,
            persona: .friendlyRushed
        )
    }

    // MARK: - Published state

    @Published private(set) var transcript: [InterviewTurnDTO] = []
    @Published private(set) var status: SessionStatus = .idle
    @Published private(set) var flags: [InterviewFlagDTO] = []
    @Published private(set) var latestCoaching: String?
    @Published private(set) var sessionId: String?
    /// End-of-session score, populated when the user taps "Get feedback"
    /// after the interview completes. Backed by POST .../practice/:id/score.
    @Published private(set) var score: InterviewScoreResponseDTO?
    @Published private(set) var isScoring: Bool = false
    @Published private(set) var scoreError: String?
    /// Compatibility shim — the old SSE flow streamed tokens into this string.
    /// The new backend returns full responses, so it's always empty. The view
    /// uses it to gate between "Caseworker is typing…" spinner and live tokens;
    /// keeping it empty means the spinner is always shown during inflight.
    @Published private(set) var streamingCaseworkerText: String = ""
    @Published var draftResponse: String = ""

    let context: SessionContext
    let recertId: String
    private let client: any InterviewCoachProviding

    private var activeSessionStorageKey: String {
        "co.civica.interviewCoach.activeSessionId.\(recertId)"
    }

    init(
        recertId: String,
        context: SessionContext = .defaultCA,
        client: (any InterviewCoachProviding)? = nil
    ) {
        self.recertId = recertId
        self.context = context
        // The default client cannot reach a signed-in token by itself, so
        // requests will fail with `.notAuthenticated` until the View
        // constructs the VM with a wired client via `make(recertId:auth:)`.
        self.client = client ?? InterviewCoachAPIClient(tokenProvider: { nil })
    }

    /// Convenience factory that wires the live client against the supplied
    /// CivicaEnrollmentAuth. PracticeSessionView reads `@EnvironmentObject`
    /// auth and calls this to construct a VM with a working token provider.
    static func make(
        recertId: String,
        context: SessionContext = .defaultCA,
        auth: CivicaEnrollmentAuth
    ) -> PracticeSessionViewModel {
        let live = InterviewCoachAPIClient(tokenProvider: { [weak auth] in
            await auth?.currentAccessToken()
        })
        return PracticeSessionViewModel(recertId: recertId, context: context, client: live)
    }

    // MARK: - Lifecycle

    func startIfNeeded() async {
        guard status == .idle else { return }

        guard !recertId.isEmpty else {
            status = .failed("Practice interview isn't configured for this packet yet.")
            return
        }

        // Try to resume any persisted session for this recert.
        if let persisted = UserDefaults.standard.string(forKey: activeSessionStorageKey),
           !persisted.isEmpty {
            do {
                let state = try await client.fetchPracticeSession(
                    recertId: recertId,
                    sessionId: persisted
                )
                if !state.done {
                    sessionId = state.sessionId
                    flags = state.flags
                    status = .awaitingUser
                    // We don't have the prior transcript from the GET route —
                    // surface a placeholder so the user has visible context.
                    transcript = [
                        InterviewTurnDTO(
                            questionId: "resume-placeholder",
                            questionText: "Resumed practice session. Continue your interview below.",
                            response: nil
                        )
                    ]
                    return
                } else {
                    // Stale completed session; drop it and start fresh.
                    UserDefaults.standard.removeObject(forKey: activeSessionStorageKey)
                }
            } catch {
                // 404/410 → session is gone, fall through to start a new one.
                UserDefaults.standard.removeObject(forKey: activeSessionStorageKey)
            }
        }

        await requestStart()
    }

    func submitUserResponse() async {
        let text = draftResponse.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        guard status == .awaitingUser, let sessionId else { return }

        transcript.append(InterviewTurnDTO(
            questionId: "applicant-turn-\(transcript.count)",
            questionText: text,
            response: text
        ))
        draftResponse = ""
        status = .awaitingCaseworker

        do {
            let resp = try await client.sendPracticeResponse(
                recertId: recertId,
                sessionId: sessionId,
                response: text,
                audioBytesDuration: nil
            )
            flags.append(contentsOf: resp.flags)
            latestCoaching = resp.coaching
            if resp.done {
                // Echo the final turn (with done=true) into the transcript.
                transcript.append(resp.turn)
                status = .complete
                UserDefaults.standard.removeObject(forKey: activeSessionStorageKey)
            } else {
                transcript.append(resp.turn)
                status = .awaitingUser
            }
        } catch let err as InterviewCoachAPIClient.CoachAPIError {
            status = .failed(err.localizedDescription)
        } catch {
            status = .failed("Practice response failed: \(error.localizedDescription)")
        }
    }

    func retry() async {
        guard case .failed = status else { return }
        if sessionId == nil {
            await requestStart()
        } else {
            // Re-issue the last applicant turn if there is one buffered.
            // Simplest behavior: reset to awaitingUser so the user can resend.
            status = .awaitingUser
        }
    }

    // MARK: - End-of-session scoring

    /// Fetch (or generate) the end-of-session score for the completed
    /// practice run. Idempotent on the backend — repeat calls are cheap.
    /// Only meaningful when `status == .complete`.
    func requestScore() async {
        guard status == .complete, let sessionId, score == nil else { return }
        isScoring = true
        scoreError = nil
        defer { isScoring = false }
        do {
            let result = try await client.fetchScore(recertId: recertId, sessionId: sessionId)
            score = result
        } catch let err as InterviewCoachAPIClient.CoachAPIError {
            scoreError = err.localizedDescription
        } catch {
            scoreError = "Could not generate feedback: \(error.localizedDescription)"
        }
    }

    // MARK: - Private

    private func requestStart() async {
        status = .awaitingCaseworker
        streamingCaseworkerText = ""

        do {
            let result = try await client.startPracticeSession(
                recertId: recertId,
                snapshot: nil
            )
            sessionId = result.sessionId
            UserDefaults.standard.set(result.sessionId, forKey: activeSessionStorageKey)
            transcript.append(result.firstQuestion)
            status = .awaitingUser
        } catch let err as InterviewCoachAPIClient.CoachAPIError {
            status = .failed(err.localizedDescription)
        } catch {
            status = .failed("Could not start practice interview: \(error.localizedDescription)")
        }
    }
}
