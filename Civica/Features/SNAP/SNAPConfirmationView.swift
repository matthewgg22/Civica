import CivicaDesignSystem
import SwiftUI

// EXPERIMENTAL SILOED MODULE: next-steps screen for official handoff guidance.
struct SNAPConfirmationView: View {
    @Environment(\.openURL) private var openURL
    @ObservedObject var viewModel: SNAPApplicationViewModel
    let onClose: () -> Void

    @AppStorage(CivicaLanguage.defaultStorageKey)
    private var languageRaw: String = CivicaLanguage.english.rawValue

    @State private var showingMarketplace = false
    @State private var marketplaceState = MarketplaceState.empty

    private var language: CivicaLanguage {
        CivicaLanguage(rawValue: languageRaw) ?? .english
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: CivicaSpacing.lg) {
                Text(SNAPConfirmationStrings.title.value(in: language))
                    .font(CivicaTypography.cardTitle)
                    .foregroundStyle(CivicaColors.ink)

                Text(SNAPConfirmationStrings.subtitle.value(in: language))
                    .font(.body)
                    .foregroundStyle(CivicaColors.graphite)
                    .fixedSize(horizontal: false, vertical: true)

                VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
                    Text(SNAPConfirmationStrings.stateSelectedLabel.value(in: language))
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

                Button(SNAPConfirmationStrings.openOfficialSite.value(in: language)) {
                    guard let officialURL else { return }
                    openURL(officialURL)
                }
                .buttonStyle(CivicaPrimaryCTAButtonStyle())
                .disabled(officialURL == nil)

                if officialURL == nil {
                    Text(SNAPConfirmationStrings.officialLinkComingSoon.value(in: language))
                        .font(CivicaTypography.footnote)
                        .foregroundStyle(CivicaColors.graphite)
                }

                MarketplaceEntryCard(
                    state: marketplaceState,
                    onConnectTapped: { showingMarketplace = true },
                    onJobsTapped: { showingMarketplace = true }
                )

                Button(SNAPConfirmationStrings.reviewDraftAgain.value(in: language)) {
                    viewModel.currentStep = .review
                }
                .buttonStyle(CivicaSecondaryCTAButtonStyle())

                Text(SNAPConfirmationStrings.doesNotSubmit.value(in: language))
                    .font(CivicaTypography.footnote)
                    .foregroundStyle(CivicaColors.warningAmber)
            }
            .padding(CivicaSpacing.lg)
        }
        .background(CivicaColors.amberSurface.ignoresSafeArea())
        .navigationTitle(SNAPConfirmationStrings.title.value(in: language))
        .navigationBarTitleDisplayMode(.inline)
        .onAppear {
            viewModel.markNextStepsViewed()
        }
        .sheet(isPresented: $showingMarketplace) {
            MarketplaceFlowView(state: marketplaceState)
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
        guard !code.isEmpty else {
            return SNAPConfirmationStrings.notProvided.value(in: language)
        }
        if let resource = SNAPStateResources.resource(for: code) {
            return "\(resource.displayName) (\(resource.stateCode))"
        }
        return code
    }
}
