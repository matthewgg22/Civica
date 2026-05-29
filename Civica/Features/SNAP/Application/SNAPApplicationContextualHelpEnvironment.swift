import CivicaDesignSystem
import SwiftUI

// Environment-value wiring for the universal contextual-help marker on
// every CivicaQuestionScreen across the SNAP application flow. Per the
// "Monday v1 — Demo Ship Plan" (design doc dashboard-state-coverage
// 2026-05-29 D5 + T5 + T10), the marker is a *universal* affordance:
// it renders on every question across all 17+ application pages, and
// tapping it presents `SNAPApplicationContextualHelpSheet`.
//
// Architecture: a single environment value carries the
// `(title, language) -> Void` callback down the SwiftUI tree. The
// `SNAPApplicationContextualHelpHost` view sets the environment value,
// owns the `@State` for the sheet item, and renders the sheet itself.
// `CivicaQuestionScreen` reads the environment value as a fallback when
// no `onHelpRequested` closure is supplied — so callers that have
// already wired the closure keep working unchanged, and the orchestrator
// gets one-point integration for all 17+ pages.
//
// This is option A (cleanest) of three plans considered in the wiring
// task. Option B (common host wrapper without env value) would have
// required threading a binding through every sub-flow view; option C
// (per-callsite) would have meant editing 12 separate files. The
// orchestrator (`SNAPApplicationFlowOrchestratorView`) is the single
// common ancestor for every CivicaQuestionScreen invocation inside
// the SNAP application flow, so one host wrap covers the whole tree.

// MARK: - Identifiable sheet payload

/// Payload that drives the `.sheet(item:)` presentation. Carries the
/// question title + the language captured at tap time, so the sheet
/// can request the explainer in the user's active locale even if
/// language toggles mid-session.
struct SNAPApplicationContextualHelpRequest: Identifiable, Equatable {
    let id = UUID()
    let questionTitle: String
    let language: CivicaLanguage
}

// MARK: - Environment value

/// Closure-shaped environment value invoked when the user taps the
/// universal help marker on a `CivicaQuestionScreen`. Defaults to
/// `nil` so callers without the host installed (previews, isolated
/// recovery flows) get a no-op marker — the marker still renders
/// because universal coverage is the visible product thesis, but the
/// tap is silent until a host is in scope.
struct SNAPApplicationContextualHelpEnvironmentKey: EnvironmentKey {
    static let defaultValue: ((String, CivicaLanguage) -> Void)? = nil
}

extension EnvironmentValues {
    var snapApplicationContextualHelp: ((String, CivicaLanguage) -> Void)? {
        get { self[SNAPApplicationContextualHelpEnvironmentKey.self] }
        set { self[SNAPApplicationContextualHelpEnvironmentKey.self] = newValue }
    }
}

// MARK: - Host view

/// Wraps the SNAP application sub-flow tree with the contextual-help
/// environment value AND the sheet presentation. Use exactly once at
/// the root of the SNAP application flow (`SNAPApplicationFlowOrchestratorView`'s
/// `currentDestination`). All downstream `CivicaQuestionScreen` instances
/// then get the marker -> sheet wiring for free.
///
/// Why a host view instead of a pure modifier: the sheet needs `@State`
/// for the active request, and SwiftUI environment values can't carry
/// mutable state on their own. The host owns the state, exposes the
/// setter via the env value, and renders the sheet via `.sheet(item:)`.
struct SNAPApplicationContextualHelpHost<Content: View>: View {
    @State private var activeRequest: SNAPApplicationContextualHelpRequest?
    let content: () -> Content

    init(@ViewBuilder content: @escaping () -> Content) {
        self.content = content
    }

    var body: some View {
        content()
            .environment(
                \.snapApplicationContextualHelp,
                { title, language in
                    activeRequest = SNAPApplicationContextualHelpRequest(
                        questionTitle: title,
                        language: language
                    )
                }
            )
            .sheet(item: $activeRequest) { request in
                SNAPApplicationContextualHelpSheet(
                    questionTitle: request.questionTitle,
                    language: request.language
                )
            }
    }
}

// MARK: - View extension

extension View {
    /// Installs the SNAP application contextual-help wiring around a
    /// view subtree. The marker on every downstream
    /// `CivicaQuestionScreen` becomes tappable and presents
    /// `SNAPApplicationContextualHelpSheet` with the question's title
    /// and active language.
    func snapApplicationContextualHelpHost() -> some View {
        SNAPApplicationContextualHelpHost { self }
    }
}

#if DEBUG
// Preview demonstrating the full wiring: a CivicaQuestionScreen wrapped
// in the host. Tapping the questionmark.circle marker invokes the env
// closure, which sets activeRequest, which fires the sheet. Use the
// preview controls (or run on device) to see the loading -> error
// transition end-to-end. (The sheet swaps to the canonical error
// fallback per D6 because previews can't reach the live endpoint.)
struct SNAPApplicationContextualHelpHost_Previews: PreviewProvider {
    static var previews: some View {
        SNAPApplicationContextualHelpHost {
            CivicaQuestionScreen(
                progress: .init(current: 1, total: 3),
                title: "How many people live in your household?",
                helper: "Include anyone who shares groceries with you — partners, kids, roommates who eat together.",
                primaryActionTitle: "Continue",
                primaryActionEnabled: true,
                onPrimary: {},
                secondaryActionTitle: "I'm not sure",
                onSecondary: {},
                language: .english
            ) {
                Text("Affordance goes here")
                    .foregroundStyle(CivicaColors.graphite)
            }
        }
        .previewDisplayName("Host + marker tap")
    }
}
#endif
