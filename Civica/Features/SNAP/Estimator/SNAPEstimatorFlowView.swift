import CivicaDesignSystem
import SwiftUI

// Glue between the pure SNAPBenefitEstimatorView and the Civica SNAP
// application flow. Keeps the estimator decoupled from the orchestrator
// — this wrapper owns the navigation so "Apply" routes into
// CivicaSNAPFlowView (the real intake) when tapped.

// MARK: - AccessibilityElement = parent
struct SNAPEstimatorFlowView: View {
    let language: CivicaLanguage
    @State private var showsIntake = false

    init(language: CivicaLanguage = .english) {
        self.language = language
    }

    var body: some View {
        SNAPBenefitEstimatorView(
            onApply: { showsIntake = true },
            onClose: nil
        )
        .navigationDestination(isPresented: $showsIntake) {
            CivicaSNAPFlowView(language: language)
        }
    }
}
