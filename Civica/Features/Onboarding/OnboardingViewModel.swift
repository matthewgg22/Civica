import Foundation
import SwiftUI

// Onboarding state machine for the 5-screen first-run sequence
// (HANDOFF board 03). Completion is persisted to UserDefaults via
// @AppStorage so onboarding only runs once per device install.

@MainActor
final class OnboardingViewModel: ObservableObject {
    enum Step: Int, CaseIterable {
        case language    = 1
        case valueProp   = 2
        case howItWorks  = 3
        case consent     = 4
        case phone       = 5
    }

    @Published var currentStep: Step = .language
    @Published var language: CivicaLanguage = .english
    @Published var hasConsented: Bool = false
    @Published var phoneInput: String = ""
    @Published var phoneSubmissionState: PhoneSubmissionState = .idle

    enum PhoneSubmissionState: Equatable {
        case idle
        case validationError
        case sending
        case sent
        case skipped
    }

    // MARK: - Step transitions

    func advance() {
        guard let next = Step(rawValue: currentStep.rawValue + 1) else {
            return
        }
        currentStep = next
    }

    func goBack() {
        guard let prev = Step(rawValue: currentStep.rawValue - 1) else {
            return
        }
        currentStep = prev
    }

    /// Whether the language step's "continue" can fire. Always true once
    /// a language has been picked (default is English on first launch).
    var canAdvanceFromLanguage: Bool {
        true
    }

    /// Consent must be explicit; the consent screen doesn't auto-advance.
    var canAdvanceFromConsent: Bool {
        hasConsented
    }

    // MARK: - Phone validation
    //
    // Delegates to USPhoneFormatter so the onboarding capture screen
    // and the SNAP contact-flow capture screen render the same
    // "(555) 123-4567" progression — any future tweak (e.g. closing
    // the paren after the third digit) lives in one place.

    var sanitizedPhoneDigits: String {
        USPhoneFormatter.digits(phoneInput)
    }

    var isPhoneValid: Bool {
        USPhoneFormatter.isComplete(phoneInput)
    }

    /// Friendly phone formatting `(555) 555-5555` rebuilt from current input.
    var displayedPhone: String {
        USPhoneFormatter.format(phoneInput)
    }

    func submitPhone() async {
        guard isPhoneValid else {
            phoneSubmissionState = .validationError
            return
        }
        phoneSubmissionState = .sending
        // Phase D backend stub: real implementation calls
        // POST /snap/sessions/recover/request via SNAPNetworkClient.
        // Returning .sent without round-trip until that endpoint exists.
        try? await Task.sleep(nanoseconds: 350_000_000)
        phoneSubmissionState = .sent
    }

    func skipPhone() {
        phoneSubmissionState = .skipped
    }

    /// Called by the wrapping flow when the user has reached the end
    /// of onboarding. The completion store side-effect lives in
    /// `OnboardingFlowView.onCompleted` so this view model stays
    /// dependency-free.
    var isComplete: Bool {
        currentStep == .phone &&
            (phoneSubmissionState == .sent || phoneSubmissionState == .skipped)
    }
}
