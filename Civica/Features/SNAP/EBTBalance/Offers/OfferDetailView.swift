import CivicaDesignSystem
import MapKit
import SwiftUI

// OfferDetailView — destination for:
//   - EBTPushDeepLink.perkOffer(id) tap from the lock-screen push
//   - Perks card row tap on the EBT Balance dashboard
//   - FindHelp pin chip tap on the FindHelp map (B-T11)
//
// Source plan: ceo-plans/2026-05-26-ebt-offer-moment-platform.md (B-T10b).
//
// Design contract (per "iOS Design Specifications · Surface 6"):
//   - 28pt SemiBold ink offer name
//   - 17pt Regular graphite description
//   - amberPrimary "Up to $X.XX estimated savings" + 13pt graphite
//     "Estimate · partner-reported" disclaimer (DESIGN.md §10.2)
//   - Map view with retailer pin (when lat/lng is available; for v1 the
//     catalog rows don't carry lat/lng yet — the map is a placeholder
//     until the catalog is enriched. We render an inline "open in Maps"
//     row instead.)
//   - 15pt Medium graphite "Through {date}" — factual through-date per
//     DESIGN.md §10.3 no urgency
//   - pinePrimary "Get directions" CTA (only when retailer location known)
//   - Text link "I redeemed this" → opens SelfAttestRedemptionSheet
//
// Event emission: a single .impression event fires on appear (handled by
// the caller via OfferEventEmitter — this view stays presentation-only so
// it can be unit-tested without a network dependency). On the "Get
// directions" tap the caller emits .click.

struct OfferDetailView: View {
    let offer: EBTOffer
    let language: CivicaLanguage
    /// Called when the user taps "Get directions" — caller emits a click
    /// event + opens Maps. nil = hides the CTA (no retailer location yet).
    var onTapDirections: (() -> Void)?
    /// Called when the user taps "I redeemed this" — caller presents the
    /// SelfAttestRedemptionSheet.
    var onTapRedeemed: () -> Void

    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: CivicaSpacing.xl) {
                headerBlock

                estimatedSavingsBlock

                if let through = throughDateString() {
                    Text(through)
                        .font(CivicaTypography.subhead)
                        .foregroundStyle(CivicaColors.graphite)
                }

                if let description = offer.description, !description.isEmpty {
                    Text(description)
                        .font(CivicaTypography.body)
                        .foregroundStyle(CivicaColors.ink)
                        .fixedSize(horizontal: false, vertical: true)
                }

                actionRow

                redeemedTextLink
            }
            .padding(CivicaSpacing.xl)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(CivicaColors.paper.ignoresSafeArea())
        .navigationTitle(offer.partnerName)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button(action: { dismiss() }) {
                    Image(systemName: "chevron.left")
                        .foregroundStyle(CivicaColors.ink)
                }
            }
        }
    }

    // MARK: - Subviews

    private var headerBlock: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
            Text(offer.name)
                .font(.system(size: 28, weight: .semibold))
                .foregroundStyle(CivicaColors.ink)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private var estimatedSavingsBlock: some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack(alignment: .firstTextBaseline, spacing: 6) {
                Text(EBTOffersStrings.estimatedSavingsLabel.value(in: language))
                    .font(CivicaTypography.subheadStrong)
                    .foregroundStyle(CivicaColors.ink)
                Text("·")
                    .font(CivicaTypography.subhead)
                    .foregroundStyle(CivicaColors.graphite)
                Text(formattedSavings)
                    .font(CivicaTypography.subheadStrong)
                    .foregroundStyle(CivicaColors.amberPrimary)
            }
            Text(EBTOffersStrings.estimatedSavingsDisclaimer.value(in: language))
                .font(CivicaTypography.footnote)
                .foregroundStyle(CivicaColors.graphite)
        }
    }

    @ViewBuilder
    private var actionRow: some View {
        if let onTapDirections {
            Button(action: onTapDirections) {
                Text(EBTOffersStrings.offerGetDirectionsCTA.value(in: language))
                    .font(CivicaTypography.subheadStrong)
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, CivicaSpacing.md)
                    .background(CivicaColors.pinePrimary)
                    .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card))
            }
            .buttonStyle(.plain)
            .accessibilityHint("Opens the partner's location in Maps")
        }
    }

    private var redeemedTextLink: some View {
        Button(action: onTapRedeemed) {
            Text(EBTOffersStrings.offerIRedeemedThisCTA.value(in: language))
                .font(CivicaTypography.subhead)
                .foregroundStyle(CivicaColors.pinePrimary)
                .underline()
        }
        .buttonStyle(.plain)
        .padding(.top, CivicaSpacing.sm)
        .accessibilityHint("Records that you used this deal")
    }

    // MARK: - Formatting

    private var formattedSavings: String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = "USD"
        formatter.locale = language == .spanish ? Locale(identifier: "es_US") : Locale(identifier: "en_US")
        let dollars = Decimal(offer.expectedSavingsCents) / Decimal(100)
        return formatter.string(from: dollars as NSDecimalNumber) ?? "$0.00"
    }

    private func throughDateString() -> String? {
        guard let endAt = offer.endAt else { return nil }
        let prefix = EBTOffersStrings.offerThroughDatePrefix.value(in: language)
        let formatter = DateFormatter()
        formatter.locale = language == .spanish ? Locale(identifier: "es") : Locale(identifier: "en")
        formatter.dateStyle = .medium
        formatter.timeStyle = .none
        return "\(prefix) \(formatter.string(from: endAt))"
    }
}

#if DEBUG
struct OfferDetailView_Previews: PreviewProvider {
    static var previews: some View {
        let sample = EBTOffer(
            offerId: "abc",
            name: "15% off prepared meals",
            partnerName: "Whole Foods",
            category: "groceries",
            description: "Save on chef-prepared meals at Whole Foods. Show your CalFresh card at checkout — discount applies automatically.",
            countyFipsList: ["06037"],
            expectedSavingsCents: 750,
            startAt: nil,
            endAt: Calendar.current.date(byAdding: .day, value: 5, to: Date()),
            tier: .top,
            stateCode: "CA",
            categoryTags: ["groceries"],
            merchantId: "wholefoods_94110",
            validUntil: Date().addingTimeInterval(300),
            score: 0.85
        )
        return NavigationStack {
            OfferDetailView(
                offer: sample,
                language: .english,
                onTapDirections: {},
                onTapRedeemed: {}
            )
        }
    }
}
#endif
