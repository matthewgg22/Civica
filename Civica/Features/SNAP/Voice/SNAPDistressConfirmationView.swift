import CivicaDesignSystem
import SwiftUI

// OBBBA Q5 compliance: distress-prompt confirmation gate.
// Presented as a sheet when the voice-intake LLM detects emotional
// distress or crisis signals above the confidence threshold. Surfaces
// crisis resources (988 / 211) before the applicant continues.
//
// The caller is responsible for dismissing by setting pendingDistress = nil
// via onContinue, or posting .snapVoiceDistressPause and clearing the state
// via onPause.

@available(iOS 26.0, *)
struct SNAPDistressConfirmationView: View {
    let onContinue: () -> Void
    let onPause: () -> Void

    @AppStorage(CivicaLanguage.defaultStorageKey)
    private var languageRaw: String = CivicaLanguage.english.rawValue

    private var language: CivicaLanguage {
        CivicaLanguage(rawValue: languageRaw) ?? .english
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: CivicaSpacing.xl) {

                // MARK: Header icon + title
                VStack(alignment: .leading, spacing: CivicaSpacing.md) {
                    Image(systemName: "heart.text.square.fill")
                        .imageScale(.large)
                        .font(.body)
                        .foregroundColor(CivicaColors.warningAmber)

                    Text(SNAPVoiceStrings.distressSheetTitle.value(in: language))
                        .font(CivicaTypography.cardTitle)
                        .foregroundColor(CivicaColors.ink)
                        .accessibilityAddTraits(.isHeader)

                    Text(SNAPVoiceStrings.distressSheetBody.value(in: language))
                        .font(CivicaTypography.body)
                        .foregroundColor(CivicaColors.graphite)
                }

                // MARK: Crisis resources card
                VStack(alignment: .leading, spacing: 0) {
                    crisisRow(
                        title: SNAPVoiceStrings.distressHotline988.value(in: language),
                        subtitle: SNAPVoiceStrings.distressHotline988Sub.value(in: language),
                        url: URL(string: "tel:988")!,
                        accessibilityLabel: "Call 988 Suicide and Crisis Lifeline",
                        isLast: false
                    )

                    Divider()
                        .background(CivicaColors.hairline)

                    crisisRow(
                        title: SNAPVoiceStrings.distressHotline211.value(in: language),
                        subtitle: SNAPVoiceStrings.distressHotline211Sub.value(in: language),
                        url: URL(string: "tel:211")!,
                        accessibilityLabel: "Call 211 for social services",
                        isLast: true
                    )
                }
                .background(CivicaColors.surfacePrimary)
                .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: CivicaRadius.card, style: .continuous)
                        .stroke(CivicaColors.hairline, lineWidth: 1)
                )

                // MARK: Action buttons
                VStack(spacing: CivicaSpacing.md) {
                    Button(SNAPVoiceStrings.distressContinue.value(in: language)) {
                        onContinue()
                    }
                    .buttonStyle(CivicaPrimaryCTAButtonStyle())
                    .frame(maxWidth: .infinity)

                    Button(SNAPVoiceStrings.distressPause.value(in: language)) {
                        onPause()
                    }
                    .font(CivicaTypography.subhead)
                    .foregroundColor(CivicaColors.pinePrimary)
                    .frame(maxWidth: .infinity, minHeight: 44)
                }
            }
            .padding(CivicaSpacing.xl)
        }
        .background(CivicaColors.paper.ignoresSafeArea())
    }

    // MARK: - Subviews

    @ViewBuilder
    private func crisisRow(
        title: String,
        subtitle: String,
        url: URL,
        accessibilityLabel: String,
        isLast: Bool
    ) -> some View {
        HStack(spacing: CivicaSpacing.md) {
            VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
                Text(title)
                    .font(CivicaTypography.subheadStrong)
                    .foregroundColor(CivicaColors.ink)
                Text(subtitle)
                    .font(CivicaTypography.footnote)
                    .foregroundColor(CivicaColors.graphite)
            }
            Spacer(minLength: 0)
            Link(destination: url) {
                Image(systemName: "phone.fill")
                    .imageScale(.large)
                    .font(.body)
                    .foregroundColor(CivicaColors.pinePrimary)
                    .frame(width: 44, height: 44)
            }
            .accessibilityLabel(accessibilityLabel)
        }
        .padding(.horizontal, CivicaSpacing.lg)
        .padding(.vertical, CivicaSpacing.md)
    }
}

// MARK: - Preview

@available(iOS 26.0, *)
#Preview {
    SNAPDistressConfirmationView(
        onContinue: {},
        onPause: {}
    )
    .presentationDetents([.medium, .large])
}
