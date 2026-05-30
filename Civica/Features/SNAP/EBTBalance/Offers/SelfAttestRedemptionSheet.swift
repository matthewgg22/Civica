import CivicaDesignSystem
import SwiftUI

// Self-attest redemption sheet — "Did you redeem this offer? How much did you save?"
//
// Source plan: ceo-plans/2026-05-26-ebt-offer-moment-platform.md (E2-T1).
// Approved mockup direction: 28pt SemiBold ink amount input, pinePrimary
// CTA, anti-inflation cap disclaimer co-present, NO celebration animation
// (reduce-motion + government-grade posture per DESIGN.md §1.1).
//
// Replaces EBTRedeemConfirmSheet (preset-grid pattern) with the
// design-spec'd single-amount-entry flow. v1 = self-attest only;
// VisionKit OCR ships in v1.1 behind a feature flag.
//
// Cap (server-truth source of truth via /me/redemptions; UI caps in
// parallel for fast feedback): savings_cents <= offer.expectedSavingsCents.
// "(self-reported)" badge per Apple App Store mitigation framing (F6).
//
// Wire contract:
//   onConfirm(savingsCents) is called when the user taps "Yes, I redeemed".
//   The caller (dashboard) writes to offersStore.redeem(offerId:savingsCents:)
//   which hits POST /me/redemptions through the atomic UPSERT stored fn.

struct SelfAttestRedemptionSheet: View {
    let offer: EBTOffer
    let language: CivicaLanguage
    let onConfirm: (Int) -> Void

    @Environment(\.dismiss) private var dismiss
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var amountDollars: String = ""
    @FocusState private var amountFocused: Bool

    /// Server-side cap (anti-inflation) sourced from the offer's
    /// expected_savings_cents. UI rejects beyond-cap values immediately
    /// so the gateway never has to clamp.
    private var capDollars: Int {
        max(0, offer.expectedSavingsCents / 100)
    }

    /// Cents the user has currently typed. nil = invalid / empty.
    private var typedCents: Int? {
        guard let dollars = Int(amountDollars), dollars > 0 else { return nil }
        return dollars * 100
    }

    /// True iff the typed amount is greater than the cap — surfaces the
    /// cap-trim warning inline.
    private var exceedsCap: Bool {
        guard let cents = typedCents else { return false }
        return cents > offer.expectedSavingsCents
    }

    /// What we'd send to the gateway (clamped). nil when typedCents is nil.
    private var sendableCents: Int? {
        guard let cents = typedCents else { return nil }
        return min(cents, offer.expectedSavingsCents)
    }

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: CivicaSpacing.xl) {
                headerBlock

                amountInput

                capDisclaimer

                Spacer()

                actionRow
            }
            .padding(CivicaSpacing.xl)
            .background(CivicaColors.paper.ignoresSafeArea())
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(action: dismissSheet) {
                        Text(EBTOffersStrings.selfAttestNotNowCTA.value(in: language))
                            .foregroundStyle(CivicaColors.graphite)
                    }
                }
            }
            .onAppear { amountFocused = true }
            .transaction { txn in
                if reduceMotion { txn.animation = nil }
            }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }

    // MARK: - Subviews

    private var headerBlock: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
            Text(EBTOffersStrings.selfAttestTitle.value(in: language))
                .font(CivicaTypography.cardTitle)
                .foregroundStyle(CivicaColors.ink)

            // Partner / offer line — 15pt graphite per design spec.
            HStack(spacing: 4) {
                Text(offer.partnerName)
                Text("·")
                Text(offer.name)
            }
            .font(CivicaTypography.subhead)
            .foregroundStyle(CivicaColors.graphite)
            .lineLimit(2)
        }
    }

    private var amountInput: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
            Text(EBTOffersStrings.selfAttestAmountLabel.value(in: language))
                .font(CivicaTypography.subheadStrong)
                .foregroundStyle(CivicaColors.ink)

            HStack(alignment: .firstTextBaseline, spacing: CivicaSpacing.sm) {
                Text("$")
                    .font(CivicaTypography.pageTitle)
                    .foregroundStyle(CivicaColors.graphite)

                TextField("0", text: $amountDollars)
                    .keyboardType(.numberPad)
                    .font(CivicaTypography.pageTitle)
                    .foregroundStyle(CivicaColors.ink)
                    .focused($amountFocused)
                    .accessibilityLabel(EBTOffersStrings.selfAttestAmountLabel.value(in: language))
            }
            .padding(CivicaSpacing.md)
            .background(CivicaColors.surfacePrimary)
            .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card))
            .overlay(
                RoundedRectangle(cornerRadius: CivicaRadius.card)
                    .strokeBorder(
                        amountFocused ? CivicaColors.pinePrimary : CivicaColors.hairline,
                        lineWidth: 1
                    )
            )
        }
    }

    /// "Up to $7.50 (the offer's max)" — co-present anti-inflation cap.
    /// When typedCents exceeds the cap, swap to a warning copy that names
    /// the trimmed amount.
    private var capDisclaimer: some View {
        let prefix = EBTOffersStrings.selfAttestCapPrefix.value(in: language)
        let suffix = EBTOffersStrings.selfAttestCapSuffix.value(in: language)
        let capFormatted = formatCap()

        return Group {
            if exceedsCap {
                Text(EBTOffersStrings.selfAttestCappedNotice.value(in: language))
                    .font(CivicaTypography.footnote)
                    .foregroundStyle(CivicaColors.warningAmber)
            } else {
                Text("\(prefix) \(capFormatted) \(suffix)")
                    .font(CivicaTypography.footnote)
                    .foregroundStyle(CivicaColors.graphite)
            }
        }
    }

    private var actionRow: some View {
        VStack(spacing: CivicaSpacing.sm) {
            Button(action: submit) {
                Text(EBTOffersStrings.selfAttestYesCTA.value(in: language))
                    .font(CivicaTypography.subheadStrong)
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, CivicaSpacing.md)
                    .background(
                        canSubmit
                            ? CivicaColors.pinePrimary
                            : CivicaColors.pinePrimary.opacity(0.45)
                    )
                    .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card))
            }
            .disabled(!canSubmit)
            .buttonStyle(.plain)
        }
    }

    private var canSubmit: Bool {
        sendableCents != nil
    }

    private func submit() {
        guard let cents = sendableCents else { return }
        onConfirm(cents)
        dismiss()
    }

    private func dismissSheet() {
        dismiss()
    }

    private func formatCap() -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = "USD"
        formatter.locale = language == .spanish ? Locale(identifier: "es_US") : Locale(identifier: "en_US")
        let dollars = Decimal(offer.expectedSavingsCents) / Decimal(100)
        return formatter.string(from: dollars as NSDecimalNumber) ?? "$\(capDollars).00"
    }
}

#if DEBUG
struct SelfAttestRedemptionSheet_Previews: PreviewProvider {
    static var previews: some View {
        let sample = EBTOffer(
            offerId: "abc",
            name: "15% off prepared meals",
            partnerName: "Whole Foods",
            category: "groceries",
            description: nil,
            countyFipsList: ["06037"],
            expectedSavingsCents: 750,
            startAt: nil,
            endAt: nil,
            tier: .top,
            stateCode: "CA",
            categoryTags: [],
            merchantId: nil,
            validUntil: Date().addingTimeInterval(300),
            score: 0.85
        )
        return Color.clear
            .sheet(isPresented: .constant(true)) {
                SelfAttestRedemptionSheet(offer: sample, language: .english) { _ in }
            }
    }
}
#endif
