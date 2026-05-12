import CivicaDesignSystem
import SwiftUI

// HANDOFF MobileCrossProgramBoard, v1 scope.
//
// The full 3-screen WIC handoff (discover → reuse → consent) is
// HANDOFF decision #7's v2 — Civica doesn't have the agency
// integration to actually submit a WIC application yet. What we
// can ship now is the discover beat: when a SNAP applicant's
// household has a child under 5, mention WIC. Tap routes to the
// MA WIC page in an in-app Safari sheet.
//
// Brand-voice rule from the board: "The biggest unrealized product
// unlock — using what we already know to apply for the next
// program." The teaser names what we know about the user (you
// have a kid in your household) and what that opens up ($48/mo of
// food vouchers for kids under 5). No marketing chrome.

struct SNAPCrossProgramTeaserView: View {
    let draft: SNAPApplicationDraft?
    let language: CivicaLanguage

    @State private var externalLink: URL?

    /// True when the teaser has something to say given the draft.
    /// Currently fires only on the WIC eligibility cue (household
    /// has minors). When future cross-program teasers ship (EITC,
    /// LIHEAP, etc.) this expands.
    static func shouldRender(for draft: SNAPApplicationDraft?) -> Bool {
        guard let draft else { return false }
        return draft.household.hasMinorInHousehold == true
    }

    var body: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.md) {
            Text(SNAPCrossProgramTeaserStrings.heading.value(in: language))
                .font(CivicaTypography.sectionHeader)
                .foregroundStyle(CivicaColors.ink)

            wicCard
        }
        .sheet(item: $externalLink) { url in
            CivicaSafariSheet(url: url)
        }
    }

    private var wicCard: some View {
        Button {
            externalLink = CivicaExternalLinks.maWICInfo
        } label: {
            HStack(alignment: .top, spacing: CivicaSpacing.md) {
                Image(systemName: "leaf.circle.fill")
                    .font(.system(size: 28))
                    .foregroundStyle(CivicaColors.accentTeal)
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
                    Text(SNAPCrossProgramTeaserStrings.wicTitle.value(in: language))
                        .font(CivicaTypography.subheadStrong)
                        .foregroundStyle(CivicaColors.ink)
                    Text(SNAPCrossProgramTeaserStrings.wicBody.value(in: language))
                        .font(CivicaTypography.body)
                        .foregroundStyle(CivicaColors.ink)
                        .fixedSize(horizontal: false, vertical: true)
                    Text(SNAPCrossProgramTeaserStrings.wicSeparateBenefit.value(in: language))
                        .font(CivicaTypography.footnote)
                        .foregroundStyle(CivicaColors.graphite)
                        .fixedSize(horizontal: false, vertical: true)
                        .padding(.top, 2)
                }
                Image(systemName: "chevron.right")
                    .foregroundStyle(CivicaColors.graphite)
                    .accessibilityHidden(true)
            }
            .padding(CivicaSpacing.lg)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(CivicaColors.surfacePrimary)
            .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card))
            .overlay(
                RoundedRectangle(cornerRadius: CivicaRadius.card)
                    .strokeBorder(CivicaColors.hairline, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
        .accessibilityLabel(
            "\(SNAPCrossProgramTeaserStrings.wicTitle.value(in: language)). " +
            "\(SNAPCrossProgramTeaserStrings.wicBody.value(in: language))"
        )
    }
}

// MARK: - Strings

enum SNAPCrossProgramTeaserStrings {
    static let heading = CivicaText(
        "You may also qualify for",
        es: "También podrías calificar para"
    )
    static let wicTitle = CivicaText(
        "WIC — for pregnant or postpartum people and children under 5",
        es: "WIC — para personas embarazadas o posparto y niños menores de 5"
    )
    static let wicBody = CivicaText(
        "WIC may provide healthy foods, nutrition education, breastfeeding support, and referrals. Benefits vary. Check with your local WIC agency.",
        es: "WIC puede ofrecer alimentos saludables, educación sobre nutrición, apoyo para la lactancia y referencias. Los beneficios varían. Consulta con tu agencia local de WIC."
    )
    static let wicSeparateBenefit = CivicaText(
        "WIC and SNAP are separate — getting WIC does not change your SNAP.",
        es: "WIC y SNAP son separados — recibir WIC no cambia tu SNAP."
    )
}
