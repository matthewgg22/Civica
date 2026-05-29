import CivicaDesignSystem
import SwiftUI

// EXPERIMENTAL SILOED MODULE: privacy notice gate shown before prototype intake.
//
// Section copy lives in `SNAPPrivacyNoticeStrings` rather than inline
// so the compliance regression tests can assert exact substrings
// (e.g. "saved on this device" must remain present, "session only"
// must remain absent) without scraping SwiftUI view bodies.
enum SNAPPrivacyNoticeStrings {
    static let beforeYouStart = "Before You Start"
    static let whatThisToolDoesTitle = "What this tool does"
    static let whatThisToolDoesBody = "This tool helps you prepare for SNAP. It does not submit an official application and does not decide eligibility."
    static let whatNotToEnterTitle = "What not to enter"
    static let whatNotToEnterBody = "Do not type or paste Social Security numbers, bank account numbers, or immigration document numbers anywhere in this app. The document scanner is fine for paystubs and IDs you'd bring to the agency — captured images are kept on this device until you delete them."
    static let howAnswersHandledTitle = "How your answers are handled"
    static let howAnswersHandledBody = "Your application answers are saved on this device so you can leave and come back. They are not submitted to the government by Civica. You can delete them at any time from the data privacy screen."
    static let officialSubmissionTitle = "Official submission"
    static let officialSubmissionBody = "To get benefits, you must submit through your official state SNAP process."
    static let eligibilityFootnote = "This screen does not determine eligibility or approval."
}

struct SNAPPrivacyNoticeView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL
    @ObservedObject var viewModel: SNAPApplicationViewModel
    @State private var continueToEligibility = false
    @State private var hasTrackedPrivacyView = false

    @AppStorage(CivicaLanguage.defaultStorageKey)
    private var languageRaw: String = CivicaLanguage.english.rawValue

    private var language: CivicaLanguage {
        CivicaLanguage(rawValue: languageRaw) ?? .english
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: CivicaSpacing.lg) {
                Text(SNAPPrivacyNoticeStrings.beforeYouStart)
                    .font(CivicaTypography.cardTitle)
                    .foregroundStyle(CivicaColors.ink)

                privacySection(
                    title: SNAPPrivacyNoticeStrings.whatThisToolDoesTitle,
                    body: SNAPPrivacyNoticeStrings.whatThisToolDoesBody
                )

                privacySection(
                    title: SNAPPrivacyNoticeStrings.whatNotToEnterTitle,
                    body: SNAPPrivacyNoticeStrings.whatNotToEnterBody
                )

                privacySection(
                    title: SNAPPrivacyNoticeStrings.howAnswersHandledTitle,
                    body: SNAPPrivacyNoticeStrings.howAnswersHandledBody
                )

                privacySection(
                    title: SNAPPrivacyNoticeStrings.officialSubmissionTitle,
                    body: SNAPPrivacyNoticeStrings.officialSubmissionBody
                )

                Text(SNAPPrivacyNoticeStrings.eligibilityFootnote)
                    .font(CivicaTypography.footnote)
                    .foregroundStyle(CivicaColors.graphite)

                VStack(spacing: CivicaSpacing.sm) {
                    Button(SNAPPrivacyNoticeNavStrings.continueToPrep.value(in: language)) {
                        viewModel.acceptedPrivacyNotice = true
                        continueToEligibility = true
                    }
                    .buttonStyle(CivicaPrimaryCTAButtonStyle())

                    if let officialURL {
                        Button(SNAPPrivacyNoticeNavStrings.goToOfficial.value(in: language)) {
                            openURL(officialURL)
                        }
                        .font(CivicaTypography.subheadStrong)
                        .foregroundStyle(CivicaColors.pinePrimary)
                        .buttonStyle(.plain)
                    }

                    Button(SNAPPrivacyNoticeNavStrings.goBack.value(in: language)) {
                        dismiss()
                    }
                    .buttonStyle(CivicaSecondaryCTAButtonStyle())
                }
                .padding(.top, CivicaSpacing.xs)
            }
            .padding(CivicaSpacing.lg)
        }
        .background(CivicaColors.amberSurface.ignoresSafeArea())
        .navigationTitle(SNAPPrivacyNoticeNavStrings.navTitle.value(in: language))
        .navigationBarTitleDisplayMode(.inline)
        .navigationDestination(isPresented: $continueToEligibility) {
            SNAPEligibilityIntroView(viewModel: viewModel)
                .navigationTitle(SNAPPrivacyNoticeNavStrings.checkWhatYouNeed.value(in: language))
                .navigationBarTitleDisplayMode(.inline)
        }
        .onAppear {
            guard !hasTrackedPrivacyView else { return }
            hasTrackedPrivacyView = true
            SNAPAnalytics.trackPrivacyNoticeViewed()
        }
    }

    private var officialURL: URL? {
        guard let resource = SNAPStateResources.resource(for: viewModel.application.state) else {
            return nil
        }
        return URL(string: resource.officialApplicationURL)
    }

    @ViewBuilder
    private func privacySection(title: String, body: String) -> some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
            Text(title)
                .font(CivicaTypography.sectionHeader)
                .foregroundStyle(CivicaColors.ink)
            Text(body)
                .font(.body)
                .foregroundStyle(CivicaColors.graphite)
                .fixedSize(horizontal: false, vertical: true)
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
    }
}
