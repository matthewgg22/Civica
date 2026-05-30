import CivicaDesignSystem
import SwiftUI

// Single-screen disclosure of how AI is used across the SNAP feature.
// Reached today from the AI badge on the Interview Coach entry tile;
// hand-rolled "About" entry points can also push this view directly.
//
// Layout mirrors SNAPPrivacyNoticeView: ScrollView + stacked
// surface-primary cards on a teal-wash background, brick accents.
// Copy lives in CivicaAITransparencyStrings so the compliance review
// can scan exact strings without parsing SwiftUI bodies.
struct CivicaAITransparencyView: View {
    @Environment(\.dismiss) private var dismiss

    @AppStorage(CivicaLanguage.defaultStorageKey)
    private var languageRaw: String = CivicaLanguage.english.rawValue

    private var language: CivicaLanguage {
        CivicaLanguage(rawValue: languageRaw) ?? .english
    }

    /// When presented as a sheet, callers can show the Close button
    /// instead of relying on a navigation chevron. Default false ==
    /// pushed via NavigationLink.
    var presentedAsSheet: Bool = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: CivicaSpacing.lg) {
                header

                CivicaAIBadge()

                Text(CivicaAITransparencyStrings.intro.value(in: language))
                    .font(CivicaTypography.body)
                    .foregroundStyle(CivicaColors.graphite)

                section(
                    title: CivicaAITransparencyStrings.useTitle.value(in: language),
                    items: [
                        (CivicaAITransparencyStrings.usePracticeTitle.value(in: language),
                         CivicaAITransparencyStrings.usePracticeBody.value(in: language)),
                        (CivicaAITransparencyStrings.useDocumentsTitle.value(in: language),
                         CivicaAITransparencyStrings.useDocumentsBody.value(in: language)),
                        (CivicaAITransparencyStrings.useVoiceTitle.value(in: language),
                         CivicaAITransparencyStrings.useVoiceBody.value(in: language)),
                        (CivicaAITransparencyStrings.useDraftsTitle.value(in: language),
                         CivicaAITransparencyStrings.useDraftsBody.value(in: language))
                    ]
                )

                section(
                    title: CivicaAITransparencyStrings.dataTitle.value(in: language),
                    bullets: [
                        CivicaAITransparencyStrings.dataOnDevice.value(in: language),
                        CivicaAITransparencyStrings.dataBackend.value(in: language),
                        CivicaAITransparencyStrings.dataNoTraining.value(in: language)
                    ]
                )

                section(
                    title: CivicaAITransparencyStrings.neverTitle.value(in: language),
                    items: [
                        (CivicaAITransparencyStrings.neverLegalTitle.value(in: language),
                         CivicaAITransparencyStrings.neverLegalBody.value(in: language)),
                        (CivicaAITransparencyStrings.neverEligibilityTitle.value(in: language),
                         CivicaAITransparencyStrings.neverEligibilityBody.value(in: language)),
                        (CivicaAITransparencyStrings.neverSubmissionTitle.value(in: language),
                         CivicaAITransparencyStrings.neverSubmissionBody.value(in: language))
                    ]
                )

                Spacer(minLength: CivicaSpacing.xl)
            }
            .padding(CivicaSpacing.lg)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(CivicaColors.amberSurface.ignoresSafeArea())
        .navigationTitle(CivicaAITransparencyStrings.navTitle.value(in: language))
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if presentedAsSheet {
                ToolbarItem(placement: .topBarTrailing) {
                    Button(CivicaAITransparencyStrings.closeButton.value(in: language)) {
                        dismiss()
                    }
                    .accessibilityLabel(CivicaAITransparencyStrings.closeButton.value(in: language))
                }
            }
        }
    }

    private var header: some View {
        Text(CivicaAITransparencyStrings.navTitle.value(in: language))
            .font(CivicaTypography.cardTitle)
            .foregroundStyle(CivicaColors.ink)
    }

    private func section(title: String, items: [(String, String)]) -> some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.md) {
            sectionHeader(title)
            VStack(alignment: .leading, spacing: CivicaSpacing.md) {
                ForEach(Array(items.enumerated()), id: \.offset) { _, item in
                    VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
                        Text(item.0)
                            .font(CivicaTypography.subheadStrong)
                            .foregroundStyle(CivicaColors.ink)
                        Text(item.1)
                            .font(.body)
                            .foregroundStyle(CivicaColors.graphite)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
            }
            .padding(CivicaSpacing.md)
            .frame(maxWidth: .infinity, alignment: .leading)
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

    private func section(title: String, bullets: [String]) -> some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.md) {
            sectionHeader(title)
            VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
                ForEach(Array(bullets.enumerated()), id: \.offset) { _, bullet in
                    HStack(alignment: .firstTextBaseline, spacing: CivicaSpacing.sm) {
                        Text("•")
                            .font(.body)
                            .foregroundStyle(CivicaColors.pinePrimary)
                            .accessibilityHidden(true)
                        Text(bullet)
                            .font(.body)
                            .foregroundStyle(CivicaColors.graphite)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
            }
            .padding(CivicaSpacing.md)
            .frame(maxWidth: .infinity, alignment: .leading)
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

    private func sectionHeader(_ title: String) -> some View {
        Text(title)
            .font(CivicaTypography.sectionHeader)
            .foregroundStyle(CivicaColors.ink)
    }
}

#Preview("Light") {
    NavigationStack {
        CivicaAITransparencyView()
    }
    .preferredColorScheme(.light)
}

#Preview("Dark — sheet") {
    NavigationStack {
        CivicaAITransparencyView(presentedAsSheet: true)
    }
    .preferredColorScheme(.dark)
}
