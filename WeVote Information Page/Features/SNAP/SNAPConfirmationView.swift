import CivicaDesignSystem
import SwiftUI

// EXPERIMENTAL SILOED MODULE: next-steps screen for official handoff guidance.
struct SNAPConfirmationView: View {
    @Environment(\.openURL) private var openURL
    @ObservedObject var viewModel: SNAPApplicationViewModel
    let onClose: () -> Void

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: CivicaSpacing.lg) {
                Text("Your SNAP draft is ready")
                    .font(.title3.weight(.semibold))
                    .foregroundStyle(CivicaColors.ink)

                Text("You can use this information to complete your official application through your state’s benefits website.")
                    .font(.body)
                    .foregroundStyle(CivicaColors.graphite)
                    .fixedSize(horizontal: false, vertical: true)

                VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
                    Text("State selected")
                        .font(CivicaTypography.subheadStrong)
                        .foregroundStyle(CivicaColors.ink)
                    Text(selectedStateLabel)
                        .font(.body)
                        .foregroundStyle(CivicaColors.graphite)
                }
                .padding(CivicaSpacing.md)
                .background(
                    RoundedRectangle(cornerRadius: CivicaRadius.card, style: .continuous)
                        .fill(CivicaColors.surfacePrimary)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: CivicaRadius.card, style: .continuous)
                        .stroke(CivicaColors.hairline, lineWidth: 1)
                )

                Button("Open official state SNAP website") {
                    guard let officialURL else { return }
                    openURL(officialURL)
                }
                .buttonStyle(CivicaPrimaryCTAButtonStyle())
                .disabled(officialURL == nil)

                if officialURL == nil {
                    Text("Official state link coming soon.")
                        .font(CivicaTypography.footnote)
                        .foregroundStyle(CivicaColors.graphite)
                }

                Button("Review my draft again") {
                    viewModel.currentStep = .review
                }
                .buttonStyle(CivicaSecondaryCTAButtonStyle())

                Text("This assistant does not submit your application.")
                    .font(CivicaTypography.footnote)
                    .foregroundStyle(CivicaColors.warningAmber)
            }
            .padding(CivicaSpacing.lg)
        }
        .background(CivicaColors.tealSurface.ignoresSafeArea())
        .onAppear {
            viewModel.markNextStepsViewed()
        }
    }

    private var officialURL: URL? {
        guard let resource = SNAPStateResources.resource(for: viewModel.application.state) else { return nil }
        return URL(string: resource.officialApplicationURL)
    }

    private var selectedStateLabel: String {
        let code = (viewModel.application.state ?? "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .uppercased()
        guard !code.isEmpty else { return "Not provided" }
        if let resource = SNAPStateResources.resource(for: code) {
            return "\(resource.displayName) (\(resource.stateCode))"
        }
        return code
    }
}
