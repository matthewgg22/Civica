import Foundation

// Shared store for the signed-in applicant's active recertification.
//
// Both InterviewCoachEntryView and RecertCompanionRoot need the same
// activeRecert payload so they can construct PracticeSessionView with
// a real recertId + auth. This store fetches once (via refresh) and
// publishes the result to whichever consumer needs it.
//
// Pattern note: the store does NOT own a long-lived reference to
// CivicaEnrollmentAuth. Auth is passed into refresh(auth:language:)
// at call time so the store survives auth lifecycle changes cleanly
// (sign-in/out, token refresh, etc.). The localized error message
// requires a language at call time too.

@MainActor
final class RecertContextStore: ObservableObject {
    enum ActiveRecertState: Equatable {
        case loading
        case ready(ActiveRecertResponseDTO)
        case none           // signed-in applicant has no active recert
        case unauthenticated
        case failed(String)
    }

    @Published private(set) var state: ActiveRecertState = .loading

    /// Convenience accessor for the recertId on the .ready branch. Nil
    /// otherwise. Lets callers `if let id = recertContext.activeRecertId`
    /// without unwrapping the enum themselves.
    var activeRecertId: String? {
        if case .ready(let recert) = state { return recert.recertId }
        return nil
    }

    /// Re-fetch the active recert from the enrollment API. Idempotent —
    /// safe to call from multiple consumers' `.task(id:)` modifiers.
    func refresh(auth: CivicaEnrollmentAuth, language: CivicaLanguage) async {
        guard auth.state.isAuthenticated else {
            state = .unauthenticated
            return
        }
        state = .loading
        let client = auth.makeEnrollmentAPIClient()
        do {
            if let recert = try await client.fetchActiveRecert() {
                state = .ready(recert)
            } else {
                state = .none
            }
        } catch {
            state = .failed(language == .spanish
                ? "No se pudo verificar tu recertificación."
                : "Could not check your recertification.")
        }
    }
}
