import CivicaDesignSystem
import SwiftUI

// "Saved by Civica" lifetime savings tally — the trust-asset surface of
// the offer-moment platform.
//
// Source plan: ceo-plans/2026-05-26-ebt-offer-moment-platform.md (E1, D4, D5).
// Approved mockup: ~/.gstack/projects/matthewgg22-Civica/designs/
//                  ebt-offer-platform-20260526/approved-tally-and-distress-swap.html
//                  (device--tall section).
//
// Design contract (per DESIGN.md §1.1 government-grade trust):
//   - surfacePrimary white card · hairline border · 8pt radius
//   - "SAVED BY CIVICA" caption-strong eyebrow with 1.2 kerning
//   - Amber numerals (positive-outcome color on light surface, NOT yellow)
//   - "Self-reported" 13pt graphite qualifier co-present — DESIGN.md §10.2
//     honesty about uncertainty. The whole reason the surface reads
//     government-grade vs consumer-fintech is this disclaimer.
//   - 15pt Medium graphite subtext "Since you joined in {month}"
//   - NO badge. NO confetti. NO animation on value change (a11y reduce-motion).
//   - Empty state ($0.00) is calm — "Redeem your first deal to start saving"
//
// A11y:
//   - VoiceOver label: "Saved by Civica forty-seven dollars and fifty cents,
//     self-reported, since you joined in March"
//   - Dynamic Type: amount + Self-reported reflow vertically at XL+
//   - Reduce Motion: value-change does NOT animate-count-up; new value
//     renders directly via `.animation(nil)` envelope

struct SavedByCivicaCard: View {
    let totalSavingsCents: Int
    let tallyLastUpdated: Date?
    let language: CivicaLanguage

    @Environment(\.sizeCategory) private var sizeCategory
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private var isLargeType: Bool {
        sizeCategory >= .accessibilityMedium
    }

    private var hasRedemptions: Bool { totalSavingsCents > 0 }

    var body: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
            eyebrow

            amountRow

            subtext
        }
        .padding(CivicaSpacing.lg)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: CivicaRadius.card)
                .fill(CivicaColors.surfacePrimary)
        )
        .overlay(
            RoundedRectangle(cornerRadius: CivicaRadius.card)
                .strokeBorder(CivicaColors.hairline, lineWidth: 1)
        )
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(accessibilityLabel)
        .transaction { txn in
            // Reduce-Motion respect: the amount renders immediately on
            // change instead of animating from the previous value. Per
            // DESIGN.md §7.3 + the design D5 "no animate-count-up" rule.
            if reduceMotion { txn.animation = nil }
        }
    }

    // MARK: - Subviews

    private var eyebrow: some View {
        Text(EBTOffersStrings.savedByCivicaEyebrow.value(in: language))
            .font(CivicaTypography.captionStrong)
            .foregroundStyle(CivicaColors.graphite)
            .textCase(.uppercase)
            .kerning(1.2)
            .padding(.horizontal, CivicaSpacing.xs)
    }

    @ViewBuilder
    private var amountRow: some View {
        // Layout: side-by-side on standard type; stacked at XL+ to keep
        // both the amount and "Self-reported" readable per the
        // Dynamic Type contract.
        if isLargeType {
            VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
                amountText
                selfReportedBadge
            }
        } else {
            HStack(alignment: .lastTextBaseline, spacing: CivicaSpacing.sm) {
                amountText
                selfReportedBadge
            }
        }
    }

    private var amountText: some View {
        Text(formattedAmount)
            .font(amountFont)
            .foregroundStyle(hasRedemptions ? CivicaColors.amberPrimary : CivicaColors.graphite)
            .monospacedDigit()
    }

    private var amountFont: Font {
        // 28pt SemiBold per mockup. Falls back to the standard pageTitle
        // token when CivicaTypography exposes it; using .system here keeps
        // this card compatible if the design-system module hasn't added a
        // display-28 yet.
        .system(size: 28, weight: .semibold, design: .default)
    }

    private var selfReportedBadge: some View {
        Text(EBTOffersStrings.savedSelfReported.value(in: language))
            .font(CivicaTypography.footnote)
            .foregroundStyle(CivicaColors.graphite)
    }

    @ViewBuilder
    private var subtext: some View {
        if hasRedemptions {
            Text(subtextString)
                .font(CivicaTypography.subhead)
                .foregroundStyle(CivicaColors.graphite)
        } else {
            // Empty state — calm copy, no apology, no shame.
            Text(EBTOffersStrings.savedEmptyStateSubtext.value(in: language))
                .font(CivicaTypography.subhead)
                .foregroundStyle(CivicaColors.graphite)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    // MARK: - Formatting

    private var formattedAmount: String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = "USD"
        let locale: Locale = language == .spanish ? Locale(identifier: "es_US") : Locale(identifier: "en_US")
        formatter.locale = locale
        formatter.maximumFractionDigits = 2
        formatter.minimumFractionDigits = 2
        let dollars = Decimal(totalSavingsCents) / Decimal(100)
        return formatter.string(from: dollars as NSDecimalNumber) ?? "$0.00"
    }

    /// "Since you joined in {Month}". When the tally has never been updated
    /// (tallyLastUpdated == nil), the empty-state branch above takes over and
    /// this subtext is never rendered.
    private var subtextString: String {
        let prefix = EBTOffersStrings.savedSinceYouJoined.value(in: language)
        guard let date = tallyLastUpdated else { return prefix }
        let monthFormatter = DateFormatter()
        monthFormatter.locale = language == .spanish ? Locale(identifier: "es") : Locale(identifier: "en")
        monthFormatter.dateFormat = "MMMM"
        return "\(prefix) \(monthFormatter.string(from: date))"
    }

    private var accessibilityLabel: String {
        let amount = formattedAmount
        let selfReported = EBTOffersStrings.savedSelfReported.value(in: language)
        let eyebrowText = EBTOffersStrings.savedByCivicaEyebrow.value(in: language)
        if hasRedemptions {
            return "\(eyebrowText). \(amount), \(selfReported). \(subtextString)"
        }
        let empty = EBTOffersStrings.savedEmptyStateSubtext.value(in: language)
        return "\(eyebrowText). \(amount). \(empty)"
    }
}

#if DEBUG
struct SavedByCivicaCard_Previews: PreviewProvider {
    static var previews: some View {
        VStack(spacing: 16) {
            SavedByCivicaCard(
                totalSavingsCents: 4750,
                tallyLastUpdated: Calendar.current.date(byAdding: .month, value: -2, to: Date()),
                language: .english
            )
            SavedByCivicaCard(
                totalSavingsCents: 0,
                tallyLastUpdated: nil,
                language: .english
            )
            SavedByCivicaCard(
                totalSavingsCents: 12300,
                tallyLastUpdated: Date(),
                language: .spanish
            )
        }
        .padding()
        .background(CivicaColors.paper)
        .previewLayout(.sizeThatFits)
    }
}
#endif
