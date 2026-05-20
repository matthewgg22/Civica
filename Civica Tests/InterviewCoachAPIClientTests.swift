import Foundation
import Testing
@testable import Civica

// URLProtocol stub for InterviewCoach tests. Mirrors the EnrollmentStubProtocol
// pattern: nonisolated(unsafe) statics are necessary because URLProtocol
// subclass methods are called on arbitrary URLSession-internal threads.

final class InterviewCoachStubProtocol: URLProtocol, @unchecked Sendable {
    nonisolated(unsafe) static var handlers: [(URLRequest) -> (Data, Int)] = []
    nonisolated(unsafe) static var capturedRequests: [URLRequest] = []

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        InterviewCoachStubProtocol.capturedRequests.append(request)
        guard !InterviewCoachStubProtocol.handlers.isEmpty else {
            client?.urlProtocol(self, didFailWithError: URLError(.unknown))
            return
        }
        let handler = InterviewCoachStubProtocol.handlers.removeFirst()
        let (data, status) = handler(request)
        let response = HTTPURLResponse(
            url: request.url!,
            statusCode: status,
            httpVersion: nil,
            headerFields: ["Content-Type": "application/json"]
        )!
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: data)
        client?.urlProtocolDidFinishLoading(self)
    }

    override func stopLoading() {}
}

// MARK: - Helpers

private let testBaseURL = URL(string: "https://enrollment.test/v1/enrollment")!
private let testToken = "test-jwt-xyz"

private func makeStubSession() -> URLSession {
    let config = URLSessionConfiguration.ephemeral
    config.protocolClasses = [InterviewCoachStubProtocol.self]
    return URLSession(configuration: config)
}

private func makeClient() -> InterviewCoachAPIClient {
    InterviewCoachAPIClient(
        baseURL: testBaseURL,
        tokenProvider: { testToken },
        session: makeStubSession()
    )
}

// MARK: - Fixtures (mirror recert.ts response shapes)

private func startResponseJSON(sessionId: String = "sess-1") -> Data {
    """
    {
      "session_id": "\(sessionId)",
      "first_question": {
        "question_id": "q-income-1",
        "question_text": "Tell me about your current income.",
        "response": null
      }
    }
    """.data(using: .utf8)!
}

private func respondResponseJSON(done: Bool = false) -> Data {
    """
    {
      "turn": {
        "question_id": "q-household-1",
        "question_text": "Who lives in your household?",
        "response": null
      },
      "flags": [
        { "type": "income", "description": "Mentioned cash payments" }
      ],
      "done": \(done),
      "coaching": "Try giving a specific dollar amount next time."
    }
    """.data(using: .utf8)!
}

private func sessionStateJSON() -> Data {
    """
    {
      "session_id": "sess-1",
      "recert_id": "rec-1",
      "state_code": "CA",
      "turn_count": 3,
      "flags": [],
      "done": false,
      "started_at": "2026-05-19T10:00:00.000Z",
      "completed_at": null
    }
    """.data(using: .utf8)!
}

// MARK: - Tests

// .serialized because the nonisolated(unsafe) static handler queue
// would race across concurrent tests.
@Suite(.serialized)
struct InterviewCoachAPIClientTests {

    init() {
        InterviewCoachStubProtocol.handlers.removeAll()
        InterviewCoachStubProtocol.capturedRequests.removeAll()
    }

    // 1. POST .../practice/start parses session_id + first turn and sends Bearer.
    @Test func startPracticeSessionParsesResponse() async throws {
        InterviewCoachStubProtocol.handlers.append { _ in (startResponseJSON(), 201) }

        let result = try await makeClient().startPracticeSession(
            recertId: "rec-1",
            snapshot: nil
        )

        #expect(result.sessionId == "sess-1")
        #expect(result.firstQuestion.questionId == "q-income-1")
        #expect(result.firstQuestion.questionText.contains("current income"))

        let req = InterviewCoachStubProtocol.capturedRequests.first!
        #expect(req.httpMethod == "POST")
        #expect(req.url?.path.contains("/recert/rec-1/practice/start") == true)
        #expect(req.value(forHTTPHeaderField: "Authorization") == "Bearer \(testToken)")
    }

    // 2. POST .../respond parses turn + flags + coaching.
    @Test func sendPracticeResponseParsesResponse() async throws {
        InterviewCoachStubProtocol.handlers.append { _ in (respondResponseJSON(done: false), 200) }

        let result = try await makeClient().sendPracticeResponse(
            recertId: "rec-1",
            sessionId: "sess-1",
            response: "I make about $800 a week.",
            audioBytesDuration: nil
        )

        #expect(result.turn.questionId == "q-household-1")
        #expect(result.flags.count == 1)
        #expect(result.flags.first?.type == "income")
        #expect(result.done == false)
        #expect(result.coaching?.contains("specific dollar amount") == true)

        let req = InterviewCoachStubProtocol.capturedRequests.first!
        #expect(req.httpMethod == "POST")
        let body = try JSONDecoder().decode([String: String].self, from: req.httpBody!)
        #expect(body["user_message"] == "I make about $800 a week.")
    }

    // 3. GET .../practice/:sessionId decodes state.
    @Test func fetchPracticeSessionDecodesState() async throws {
        InterviewCoachStubProtocol.handlers.append { _ in (sessionStateJSON(), 200) }

        let state = try await makeClient().fetchPracticeSession(
            recertId: "rec-1",
            sessionId: "sess-1"
        )

        #expect(state.sessionId == "sess-1")
        #expect(state.recertId == "rec-1")
        #expect(state.stateCode == "CA")
        #expect(state.turnCount == 3)
        #expect(state.done == false)
    }

    // 4. 401 → notAuthorized.
    @Test func unauthorizedSurfacesNotAuthorizedError() async throws {
        InterviewCoachStubProtocol.handlers.append { _ in
            ("{\"error\":\"unauthorized\"}".data(using: .utf8)!, 401)
        }

        do {
            _ = try await makeClient().startPracticeSession(recertId: "rec-1", snapshot: nil)
            Issue.record("Expected notAuthorized error")
        } catch let err as InterviewCoachAPIClient.CoachAPIError {
            #expect(err == .notAuthorized)
        }
    }

    // 5. 410 → sessionLost.
    @Test func sessionLostSurfacesSessionLostError() async throws {
        InterviewCoachStubProtocol.handlers.append { _ in
            ("{\"message\":\"Session state lost\"}".data(using: .utf8)!, 410)
        }

        do {
            _ = try await makeClient().sendPracticeResponse(
                recertId: "rec-1",
                sessionId: "stale-session",
                response: "anything",
                audioBytesDuration: nil
            )
            Issue.record("Expected sessionLost error")
        } catch let err as InterviewCoachAPIClient.CoachAPIError {
            #expect(err == .sessionLost)
        }
    }

    // 6. 500 → serverError with body preserved.
    @Test func serverErrorPreservesStatusAndBody() async throws {
        InterviewCoachStubProtocol.handlers.append { _ in
            ("kaboom".data(using: .utf8)!, 500)
        }

        do {
            _ = try await makeClient().startPracticeSession(recertId: "rec-1", snapshot: nil)
            Issue.record("Expected serverError")
        } catch let err as InterviewCoachAPIClient.CoachAPIError {
            if case .serverError(let status, let body) = err {
                #expect(status == 500)
                #expect(body == "kaboom")
            } else {
                Issue.record("Expected .serverError, got \(err)")
            }
        }
    }

    // 7a. POST .../respond includes audio_bytes_duration when provided.
    @Test func sendPracticeResponseEncodesAudioBytesDuration() async throws {
        InterviewCoachStubProtocol.handlers.append { _ in (respondResponseJSON(done: false), 200) }

        _ = try await makeClient().sendPracticeResponse(
            recertId: "rec-1",
            sessionId: "sess-1",
            response: "I work part-time.",
            audioBytesDuration: 48_000
        )

        let req = InterviewCoachStubProtocol.capturedRequests.first!
        struct Body: Decodable {
            let user_message: String
            let audio_bytes_duration: Int?
        }
        let decoded = try JSONDecoder().decode(Body.self, from: req.httpBody!)
        #expect(decoded.user_message == "I work part-time.")
        #expect(decoded.audio_bytes_duration == 48_000)
    }

    // 7b. POST .../score parses the new InterviewScoreResponseDTO.
    @Test func fetchScoreParsesResponse() async throws {
        let scoreJSON = """
        {
          "session_id": "sess-1",
          "overall_score": 82,
          "strengths": ["Clear about address", "Mentioned new job"],
          "improvements": ["Add start date", "Include hours/week"],
          "summary_en": "Solid run; tighten income details.",
          "summary_es": "Buena práctica; detalla los ingresos.",
          "generated_at": "2026-05-19T01:00:00Z",
          "engine_version": "claude-haiku-4-5/score-v1"
        }
        """.data(using: .utf8)!
        InterviewCoachStubProtocol.handlers.append { _ in (scoreJSON, 200) }

        let score = try await makeClient().fetchScore(recertId: "rec-1", sessionId: "sess-1")

        #expect(score.sessionId == "sess-1")
        #expect(score.overallScore == 82)
        #expect(score.strengths.count == 2)
        #expect(score.improvements.count == 2)
        #expect(score.summaryEn.contains("Solid run"))
        #expect(score.summaryEs.contains("Buena práctica"))
        #expect(score.engineVersion.contains("claude-haiku"))

        let req = InterviewCoachStubProtocol.capturedRequests.first!
        #expect(req.httpMethod == "POST")
        #expect(req.url?.path.contains("/recert/rec-1/practice/sess-1/score") == true)
    }

    // 8. Missing token → notAuthenticated (no network call attempted).
    @Test func missingTokenSurfacesNotAuthenticated() async throws {
        let client = InterviewCoachAPIClient(
            baseURL: testBaseURL,
            tokenProvider: { nil },
            session: makeStubSession()
        )
        do {
            _ = try await client.startPracticeSession(recertId: "rec-1", snapshot: nil)
            Issue.record("Expected notAuthenticated")
        } catch let err as InterviewCoachAPIClient.CoachAPIError {
            #expect(err == .notAuthenticated)
        }
    }
}
