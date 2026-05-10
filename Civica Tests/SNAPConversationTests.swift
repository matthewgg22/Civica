import Foundation
import Testing
@testable import VoteNow

// EXPERIMENTAL SILOED MODULE: tests for the SNAP conversational pipeline
// iOS surface (codegenned models + view model state transitions).
//
// The privacy-boundary tests in SNAPPrivacyBoundaryTests.swift remain
// unchanged for now per the locked privacy decision: the guardrails
// they assert stay in force until the privacy attorney review lands.

// MARK: - Wire-shape Codable roundtrip

struct SNAPSessionModelsTests {
    @Test func turnResultCodableRoundtrip() throws {
        let original = SNAPTurnResult(
            sessionId: "abc-123",
            turnIndex: 4,
            assistantQuestion: "How much do you pay in rent?",
            helperText: "Type the amount in dollars.",
            expectedInputType: .numericDollars,
            choiceOptions: nil,
            nextTopic: .housingCost,
            eligibilityPreview: nil,
            isTerminal: false,
            needsClarification: false,
            clarificationText: nil,
            costTelemetry: [],
            confidence: 0.96
        )

        let encoded = try JSONEncoder().encode(original)
        let decoded = try JSONDecoder().decode(SNAPTurnResult.self, from: encoded)

        #expect(decoded.sessionId == original.sessionId)
        #expect(decoded.turnIndex == original.turnIndex)
        #expect(decoded.expectedInputType == .numericDollars)
        #expect(decoded.nextTopic == .housingCost)
    }

    @Test func eligibilityResultDecodesFromBackendShape() throws {
        // Sample payload mirrors what the FastAPI backend will emit
        // (snake_case keys, ISO date string, decimal as JSON number).
        let json = """
        {
          "status": "eligible",
          "monthly_benefit": 135,
          "expedited_eligible": false,
          "contributing_factors": ["ma_bbce_applied"],
          "required_verifications": [
            {
              "code": "income_paystub",
              "label_en": "Recent paystub",
              "label_es": "Recibo de pago reciente",
              "explanation_en": "Most recent paystub covering the last 30 days.",
              "explanation_es": "Recibo más reciente de los últimos 30 días.",
              "is_required_for_initial_application": true,
              "can_be_postponed_for_expedited": false
            }
          ],
          "ineligibility_reason": null,
          "effective_date": "2025-05-10",
          "rules_version": "federal-2025-05-10/MA-2025-05-10"
        }
        """.data(using: .utf8)!

        let decoded = try JSONDecoder().decode(SNAPEligibilityResult.self, from: json)
        #expect(decoded.status == .eligible)
        #expect(decoded.monthlyBenefit == 135)
        #expect(decoded.requiredVerifications.count == 1)
        #expect(decoded.requiredVerifications[0].code == "income_paystub")
        #expect(decoded.rulesVersion == "federal-2025-05-10/MA-2025-05-10")
    }

    @Test func startSessionResponseDecodesFromBackendShape() throws {
        let json = """
        {
          "session_id": "abc",
          "opening_turn": {
            "session_id": "abc",
            "turn_index": 0,
            "assistant_question": "Hi — to start, who's in your household with you?",
            "helper_text": null,
            "expected_input_type": "free_text",
            "choice_options": null,
            "next_topic": "household_composition",
            "eligibility_preview": null,
            "is_terminal": false,
            "needs_clarification": false,
            "clarification_text": null,
            "cost_telemetry": [],
            "confidence": 1.0
          }
        }
        """.data(using: .utf8)!

        let decoded = try JSONDecoder().decode(SNAPStartSessionResponse.self, from: json)
        #expect(decoded.sessionId == "abc")
        #expect(decoded.openingTurn.expectedInputType == .freeText)
        #expect(decoded.openingTurn.nextTopic == .householdComposition)
    }
}

// MARK: - SNAPConversationViewModel state transitions

struct SNAPConversationViewModelTests {
    @MainActor
    @Test func startTransitionsIdleToAwaitingInput() async {
        let vm = SNAPConversationViewModel(
            client: MockSNAPNetworkClient(),
            stateCode: "MA",
            language: "en"
        )
        #expect(vm.phase == .idle)

        await vm.start()
        #expect(vm.phase == .awaitingInput)
        #expect(vm.transcript.count == 1)
        #expect(vm.sessionId != nil)
    }

    @MainActor
    @Test func sendTransitionsThroughSendingThenAwaiting() async {
        let vm = SNAPConversationViewModel(
            client: MockSNAPNetworkClient(),
            stateCode: "MA",
            language: "en"
        )
        await vm.start()

        await vm.send("Just me, US citizen, 32, not a student.")
        // After the send completes, mock returns turn 1 (cash receipt question),
        // so we should be awaiting input again.
        #expect(vm.phase == .awaitingInput)
        // Transcript: opening + user + assistant.
        #expect(vm.transcript.count == 3)
    }

    @MainActor
    @Test func canonicalDemoReachesTerminalEligibleVerdict() async {
        let vm = SNAPConversationViewModel(
            client: MockSNAPNetworkClient(),
            stateCode: "MA",
            language: "en"
        )
        await vm.start()                        // opening
        await vm.send("just me, US citizen, 32, not a student")  // -> cash question
        await vm.send("no")                      // -> income question
        await vm.send("$1800")                   // -> housing question
        await vm.send("$1400")                   // -> terminal verdict

        guard case .terminal(let result) = vm.phase, let verdict = result else {
            Issue.record("Expected terminal phase with eligibility verdict; got \(vm.phase)")
            return
        }
        #expect(verdict.status == .eligible)
        #expect(verdict.monthlyBenefit == 135)
    }

    @MainActor
    @Test func sendOnTerminalIsNoOp() async {
        let vm = SNAPConversationViewModel(
            client: MockSNAPNetworkClient(),
            stateCode: "MA"
        )
        await vm.start()
        await vm.send("a"); await vm.send("b"); await vm.send("c"); await vm.send("d")
        guard case .terminal = vm.phase else {
            Issue.record("Setup expected to reach terminal; got \(vm.phase)")
            return
        }
        let countBefore = vm.transcript.count

        await vm.send("more text after terminal")
        #expect(vm.transcript.count == countBefore, "Send on terminal should be a no-op")
    }

    @MainActor
    @Test func emptyInputIsIgnored() async {
        let vm = SNAPConversationViewModel(
            client: MockSNAPNetworkClient(),
            stateCode: "MA"
        )
        await vm.start()
        let countBefore = vm.transcript.count

        await vm.send("   ")
        #expect(vm.transcript.count == countBefore)
    }

    @MainActor
    @Test func networkErrorMovesToErrorPhase() async {
        struct FailingClient: SNAPNetworkClient {
            func startSession(state: String, language: String) async throws -> SNAPStartSessionResponse {
                throw SNAPNetworkError.unexpectedStatus(503)
            }
            func sendTurn(sessionId: String, userText: String) async throws -> SNAPTurnResult {
                throw SNAPNetworkError.unexpectedStatus(503)
            }
            func recoverSession(token: String) async throws -> SNAPStartSessionResponse {
                throw SNAPNetworkError.unexpectedStatus(503)
            }
        }
        let vm = SNAPConversationViewModel(
            client: FailingClient(),
            stateCode: "MA"
        )

        await vm.start()
        guard case .error = vm.phase else {
            Issue.record("Expected error phase, got \(vm.phase)")
            return
        }
    }
}

// MARK: - Router

struct SNAPRouterTests {
    @Test func screenerRouteFollowsConversationFlag() {
        let expected: SNAPRoute = SNAPFeatureFlag.isConversationEnabled
            ? .conversation
            : .application
        #expect(SNAPRouter.screenerRoute == expected)
    }

    @Test func orderedRoutesContainsScreenerOnce() {
        let routes = SNAPRouter.orderedRoutes
        let count = routes.filter { $0 == .conversation || $0 == .application }.count
        #expect(count == 1, "Exactly one screener route should appear, got \(count)")
    }

    @Test func orderedRoutesStartsWithEntry() {
        #expect(SNAPRouter.orderedRoutes.first == .entry)
    }

    @Test func orderedRoutesEndsWithConfirmation() {
        #expect(SNAPRouter.orderedRoutes.last == .confirmation)
    }
}

// MARK: - Analytics allowlist guardrail

struct SNAPAnalyticsConversationTests {
    @Test func conversationParametersHonorAllowlist() {
        let params = SNAPAnalytics.makeParameters(
            stepName: nil,
            stepIndex: nil,
            topic: "housing_cost"
        )
        #expect(params["topic"] as? String == "housing_cost")
        #expect(params.count == 1)
    }

    @Test func nonAllowlistedKeysAreFilteredOut() {
        // The make-parameters function only emits allowlisted keys.
        // This is a structural guard: if someone adds a non-allowlisted
        // key to makeParameters, the filter would drop it.
        let params = SNAPAnalytics.makeParameters(
            stepName: "next_steps",
            stepIndex: 5,
            topic: nil
        )
        for key in params.keys {
            #expect(SNAPAnalytics.allowedParameterKeys.contains(key))
        }
    }
}
