import CivicaDesignSystem
import SwiftUI

// Entry tile for Phantom Recert — shown on the Recert Companion
// dashboard when the next recert is within 60 days. Tapping pushes
// PhantomRecertFlowView onto the navigation stack.

struct PhantomRecertEntryView: View {
    @AppStorage(CivicaLanguage.defaultStorageKey)
    private var languageRaw: String = CivicaLanguage.english.rawValue

    let onStart: () -> Void

    private var language: CivicaLanguage {
        CivicaLanguage(rawValue: languageRaw) ?? .english
    }

    var body: some View {
        Button {
            RecertCompanionAnalytics.trackPhantomStarted()
            onStart()
        } label: {
            HStack(spacing: CivicaSpacing.md) {
                Image(systemName: "wand.and.stars")
                    .font(.system(size: 28))
                    .foregroundStyle(CivicaColors.pinePrimary)
                    .frame(width: 48, height: 48)
                    .background(
                        RoundedRectangle(cornerRadius: CivicaRadius.control, style: .continuous)
                            .fill(CivicaColors.pinePrimary.opacity(0.12))
                    )
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
                    Text(RecertCompanionStrings.phantomEntryTitle.value(in: language))
                        .font(CivicaTypography.sectionHeader)
                        .foregroundStyle(CivicaColors.ink)
                    Text(RecertCompanionStrings.phantomEntrySubtitle.value(in: language))
                        .font(CivicaTypography.footnoteStrong)
                        .foregroundStyle(CivicaColors.graphite)
                        .lineLimit(2)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: CivicaSpacing.sm)
                Image(systemName: "chevron.right")
                    .foregroundStyle(CivicaColors.graphite)
                    .accessibilityHidden(true)
            }
            .padding(CivicaSpacing.md)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(CivicaColors.surfacePrimary)
            .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card))
            .overlay(
                RoundedRectangle(cornerRadius: CivicaRadius.card)
                    .strokeBorder(CivicaColors.hairline, lineWidth: 1)
            )
            .accessibilityElement(children: .combine)
            .accessibilityLabel("\(RecertCompanionStrings.phantomEntryTitle.value(in: language)). \(RecertCompanionStrings.phantomEntrySubtitle.value(in: language))")
        }
        .buttonStyle(.plain)
    }
}
