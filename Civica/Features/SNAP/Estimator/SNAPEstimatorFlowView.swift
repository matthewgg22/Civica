import CivicaDesignSystem
import SwiftUI

// Glue between the pure SNAPBenefitEstimatorView and the Civica SNAP
// application flow. Keeps the estimator decoupled from the orchestrator
// — this wrapper owns the navigation so "Apply" routes into
// CivicaSNAPFlowView (the real intake) when tapped.
//
// IS-4 + UD-3 of the iOS audit (2026-05-29) added the warm
// soft-ineligibility card with three explicit next steps. This view
// owns the two new destinations the card calls into:
//   - Find Food → FindHelpRootView (pre-filtered to food assistance)
//   - Open the State Portal → CivicaSafariSheet on the apply-portal URL

// MARK: - AccessibilityElement = parent
struct SNAPEstimatorFlowView: View {
    let language: CivicaLanguage
    @State private var showsIntake = false
    @State private var showsFindHelp = false
    @State private var statePortalURL: URL?

    init(language: CivicaLanguage = .english) {
        self.language = language
    }

    var body: some View {
        SNAPBenefitEstimatorView(
            onApply: { showsIntake = true },
            onClose: nil,
            onFindHelp: { showsFindHelp = true },
            onOpenStatePortal: { statePortalURL = CivicaExternalLinks.applyPortal(for: nil) }
        )
        .navigationDestination(isPresented: $showsIntake) {
            CivicaSNAPFlowView(language: language)
        }
        .navigationDestination(isPresented: $showsFindHelp) {
            FindHelpRootView(
                initialFilter: FindHelpFilterState(
                    serviceType: .foodAssistance,
                    languageCode: nil
                )
            )
        }
        .sheet(item: $statePortalURL) { url in
            CivicaSafariSheet(url: url)
        }
    }
}
