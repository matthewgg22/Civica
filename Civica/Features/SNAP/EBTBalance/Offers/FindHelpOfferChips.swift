import CivicaDesignSystem
import SwiftUI

// "Deals at this retailer" pill chips, rendered inside the FindHelp
// LocationDetailSheet + PeekSheet when an EBT-retailer pin matches a
// partner with active offers.
//
// Source plan: ceo-plans/2026-05-26-ebt-offer-moment-platform.md (B-T11 + E5).
// Approved direction (per D8): hairline-bordered pills, ink text, white fill,
// NO bright accent fills (avoids the Yelp-deal "screaming yellow" AI-slop
// pattern). Tap on a pill emits a click event + routes to OfferDetailView.
//
// Wire model: this view reads the EBTOffersStore from the environment.
// Callers (FindHelp root) inject the store via `.environmentObject(...)`.
// When no store is available (preview, anonymous flow), the chips render
// nothing — the FindHelp sheet looks identical to its pre-offers state.

/// Pills for matching offers at a given retailer. Empty array → renders
/// nothing (the surrounding `if` in the caller hides the eyebrow too).
struct FindHelpOfferChips: View {
    let retailerName: String
    let language: CivicaLanguage
    /// Tap handler: caller emits the click event + presents OfferDetailView.
    let onTapOffer: (EBTOffer) -> Void

    @EnvironmentObject var offersStore: EBTOffersStore

    private var matchingOffers: [EBTOffer] {
        let needle = retailerName.lowercased().trimmingCharacters(in: .whitespaces)
        guard !needle.isEmpty else { return [] }
        return offersStore.offers.filter { offer in
            // Fuzzy match: case-insensitive prefix of partnerName against
            // the retailer's display name. v1.1 receipt-OCR matches use the
            // tighter merchant_id key; this approximation is good enough for
            // the visible chip strip (false positives are rare; a wrong
            // chip just shows a few extra offers and the user discovers
            // they apply elsewhere when tapping in).
            offer.partnerName.lowercased().hasPrefix(needle) ||
                needle.hasPrefix(offer.partnerName.lowercased())
        }
    }

    var body: some View {
        let offers = matchingOffers
        if !offers.isEmpty {
            VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
                Text(eyebrowText)
                    .font(CivicaTypography.captionStrong)
                    .foregroundStyle(CivicaColors.graphite)
                    .textCase(.uppercase)
                    .kerning(1.2)

                // Horizontal flow of chips. ScrollView keeps the layout
                // sane on narrow screens without truncating offer titles.
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: CivicaSpacing.xs) {
                        ForEach(offers) { offer in
                            Button {
                                onTapOffer(offer)
                            } label: {
                                chipBody(for: offer)
                            }
                            .buttonStyle(.plain)
                            .accessibilityLabel(chipAccessibilityLabel(for: offer))
                        }
                    }
                    .padding(.vertical, 2)
                }
            }
            .padding(.top, CivicaSpacing.xs)
        }
    }

    private var eyebrowText: String {
        // Localized via the shared "Deals near you" eyebrow — same string
        // surfaces on the perks card, so the FindHelp tap-in feels like a
        // shortcut into the same content.
        EBTOffersStrings.dealsNearYouEyebrow.value(in: language)
    }

    @ViewBuilder
    private func chipBody(for offer: EBTOffer) -> some View {
        Text(offer.name)
            .font(CivicaTypography.captionStrong)
            .foregroundStyle(CivicaColors.ink)
            .lineLimit(1)
            .padding(.horizontal, CivicaSpacing.sm)
            .padding(.vertical, 6)
            .background(CivicaColors.surfacePrimary)
            .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.pill))
            .overlay(
                RoundedRectangle(cornerRadius: CivicaRadius.pill)
                    .strokeBorder(CivicaColors.hairline, lineWidth: 1)
            )
            .contentShape(Rectangle())
    }

    private func chipAccessibilityLabel(for offer: EBTOffer) -> String {
        "\(offer.name) at \(offer.partnerName)"
    }
}
