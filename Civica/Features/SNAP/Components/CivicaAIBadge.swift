import CivicaDesignSystem
import SwiftUI

// Small, quiet pill that marks a surface as AI-assisted. Apple Privacy
// Nutrition Label tone — brick at low opacity, no gradients, no
// animation. Use sparingly: one per surface, anchored to the existing
// visual hierarchy.
//
// Two modes:
//   • Passive — text-only label ("AI-powered").
//   • Tappable — supply `infoAction` to add an `info.circle` leading
//     glyph; the whole pill becomes a button. Reserve this for the
//     entry-tile placement that links to CivicaAITransparencyView so
//     the rest of the badges stay non-interactive markers.
//
// Bilingual via CivicaAIBadgeStrings (see CivicaAIBadgeStrings.swift).
struct CivicaAIBadge: View {
    let infoAction: (() -> Void)?

    @AppStorage(CivicaLanguage.defaultStorageKey)
    private var languageRaw: String = CivicaLanguage.english.rawValue

    private var language: CivicaLanguage {
        CivicaLanguage(rawValue: languageRaw) ?? .english
    }

    init(infoAction: (() -> Void)? = nil) {
        self.infoAction = infoAction
    }

    var body: some View {
        if let infoAction {
            Button(action: infoAction) {
                pill
            }
            .buttonStyle(.plain)
            .accessibilityLabel(CivicaAIBadgeStrings.accessibilityLabel.value(in: language))
            .accessibilityHint(CivicaAIBadgeStrings.accessibilityHintTappable.value(in: language))
        } else {
            pill
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(CivicaAIBadgeStrings.accessibilityLabel.value(in: language))
        }
    }

    private var pill: some View {
        HStack(spacing: 4) {
            if infoAction != nil {
                Image(systemName: "info.circle")
                    .font(.caption2)
                    .accessibilityHidden(true)
            }
            Text(CivicaAIBadgeStrings.label.value(in: language))
                .font(CivicaTypography.caption)
        }
        .foregroundStyle(CivicaColors.pinePrimary)
        .padding(.horizontal, CivicaSpacing.sm)
        .padding(.vertical, 3)
        .background(
            Capsule(style: .continuous)
                .fill(CivicaColors.pinePrimary.opacity(0.10))
        )
        .overlay(
            Capsule(style: .continuous)
                .stroke(CivicaColors.pinePrimary.opacity(0.18), lineWidth: 0.5)
        )
    }
}

#Preview("Light — passive") {
    CivicaAIBadge()
        .padding()
        .background(CivicaColors.paper)
        .preferredColorScheme(.light)
}

#Preview("Light — tappable") {
    CivicaAIBadge(infoAction: {})
        .padding()
        .background(CivicaColors.paper)
        .preferredColorScheme(.light)
}

#Preview("Dark — tappable") {
    CivicaAIBadge(infoAction: {})
        .padding()
        .background(CivicaColors.paper)
        .preferredColorScheme(.dark)
}
