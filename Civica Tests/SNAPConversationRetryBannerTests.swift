import Foundation
import Testing
@testable import Civica

// IS-3 — Retry banner: dismissible + navigator phone link.
// Audit pass: 2026-05-29, Pass 2.
//
// The @State bannerDismissed flag lives in SNAPConversationView and cannot be
// driven from here without ViewInspector. We test the ViewModel contract that
// drives banner visibility (a, b) and the pure URL/directory logic (c, d).

@Suite("SNAPConversationRetryBanner")
struct SNAPConversationRetryBannerTests {

    private struct AlwaysFailingClient: SNAPNetworkClient {
        func startSession(state: String, language: String) async throws -> SNAPStartSessionResponse {
            throw SNAPNetworkError.unexpectedStatus(503)
        }
        func sendTurn(sessionId: String, userText: String) async throws -> SNAPTurnResult {
            throw SNAPNetworkError.unexpectedStatus(503)
        }
        func recoverSession(token: String) async throws -> SNAPStartSessionResponse {
            throw SNAPNetworkError.unexpectedStatus(503)
        }
        func uploadDocument(
            sessionId: String,
            imageData: Data,
            mediaType: String,
            onDeviceQualityPassed: Bool
        ) async throws -> SNAPDocumentUploadResponse {
            throw SNAPNetworkError.unexpectedStatus(503)
        }
        func getDocumentStatus(documentId: String) async throws -> SNAPDocumentStatusResponse {
            throw SNAPNetworkError.unexpectedStatus(503)
        }
        func confirmDocument(
            documentId: String,
            corrections: [String: String]?
        ) async throws -> SNAPDocumentStatusResponse {
            throw SNAPNetworkError.unexpectedStatus(503)
        }
        func generateApplicationPDF(sessionId: String) async throws -> Data {
            throw SNAPNetworkError.unexpectedStatus(503)
        }
    }

    // MARK: - (a) Banner shows on error

    @MainActor
    @Test func viewModelEntersErrorPhaseOnNetworkFailure() async {
        let vm = SNAPConversationViewModel(client: AlwaysFailingClient(), stateCode: "CA")
        await vm.start()
        guard case .error(let message) = vm.phase else {
            Issue.record("Expected .error phase, got \(vm.phase)")
            return
        }
        #expect(!message.isEmpty, "Error phase must carry a non-empty user-facing message")
    }

    // MARK: - (b) Session-scoped dismiss — ViewModel contract
    //
    // The view resets bannerDismissed via:
    //   .onChange(of: viewModel.phase) { _, newPhase in
    //     if case .error = newPhase { bannerDismissed = false }
    //   }
    // We verify the ViewModel produces .error on each failed attempt, giving
    // onChange the signal it needs to re-show the banner after a retry.

    @MainActor
    @Test func errorPhaseIsProducedOnEachFailedAttempt() async {
        let vm = SNAPConversationViewModel(client: AlwaysFailingClient(), stateCode: "CA")
        await vm.start()
        guard case .error = vm.phase else {
            Issue.record("First attempt expected .error, got \(vm.phase)")
            return
        }
        vm.reset()
        await vm.start()
        guard case .error = vm.phase else {
            Issue.record("Second attempt expected .error, got \(vm.phase)")
            return
        }
    }

    // MARK: - (c) Phone link uses tel: scheme

    @Test func navigatorPhoneURLHasTelScheme() {
        let number = SNAPAgencyDirectory.helplineNumber(for: "CA")
        let digits = number.filter(\.isNumber)
        #expect(!digits.isEmpty, "CA helpline must have numeric digits")
        let url = URL(string: "tel:\(digits)")
        #expect(url != nil, "tel: URL must be constructable from CA helpline")
        #expect(url?.scheme == "tel")
    }

    @Test func navigatorPhoneURLAbsoluteStringContainsOnlyDigits() {
        let number = SNAPAgencyDirectory.helplineNumber(for: "CA")
        let digits = number.filter(\.isNumber)
        guard let url = URL(string: "tel:\(digits)") else {
            Issue.record("Could not construct tel: URL")
            return
        }
        let path = url.absoluteString.replacingOccurrences(of: "tel:", with: "")
        let allDigits = path.allSatisfy { $0.isNumber }
        #expect(allDigits, "tel: URL path must be digits only, got \(path)")
        #expect(path.count >= 10, "US phone number must have at least 10 digits, got \(path.count)")
    }

    // MARK: - (d) Navigator number resolves from agency directory

    @Test func helplineNumberMatchesKnownCANumber() {
        #expect(SNAPAgencyDirectory.helplineNumber(for: "CA") == "1-877-847-3663")
    }

    @Test func helplineNumberResolvesForLaunchState() {
        let number = SNAPAgencyDirectory.helplineNumber(for: SNAPAgencyDirectory.launchStateCode)
        #expect(!number.isEmpty, "Launch state must have a non-empty helpline number")
    }
}
