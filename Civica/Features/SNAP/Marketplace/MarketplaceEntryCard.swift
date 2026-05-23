import CivicaDesignSystem
import SwiftUI

// Screen 1 of the student employer marketplace storyboard.
// Displayed inside SNAPConfirmationView after the official-site CTA.
// Uses IncomeOptionsCard from CivicaDesignSystem.
struct MarketplaceEntryCard: View {
    let state: MarketplaceState
    let onConnectTapped: () -> Void
    let onJobsTapped: () -> Void

    var body: some View {
        IncomeOptionsCard(
            state: incomeOptionsState,
            onCTA: isConnected ? onJobsTapped : onConnectTapped
        )
    }

    // MARK: - Private

    private var isConnected: Bool {
        state.canvasConnected && state.argyleConnected
    }

    private var incomeOptionsState: IncomeOptionsCard.State {
        if isConnected, let benefit = state.currentBenefitUSD {
            return .connected(benefitAmount: benefit, jobCount: state.jobs.count)
        }
        return .coldStart
    }
}

// ---------------------------------------------------------------------------
// Partial-benefit placeholder shown when benefit amount is not yet known.
// DR3-9: "$—" hero with reassurance copy.
// ---------------------------------------------------------------------------
struct PendingBenefitBanner: View {

    @AppStorage(CivicaLanguage.defaultStorageKey)
    private var languageRaw: String = CivicaLanguage.english.rawValue
    private var language: CivicaLanguage { CivicaLanguage(rawValue: languageRaw) ?? .english }

    var body: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
            Text("$—")
                .font(CivicaTypography.cardHero)
                .foregroundStyle(CivicaColors.ink)
                .monospacedDigit()
            Text(SNAPMarketplaceStrings.pendingBenefitReassurance.value(in: language))
                .font(CivicaTypography.body)
                .foregroundStyle(CivicaColors.graphite)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(CivicaSpacing.lg)
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

#Preview("Connected") {
    MarketplaceEntryCard(
        state: MarketplaceState(
            canvasConnected: true, argyleConnected: true,
            currentBenefitUSD: 292, incomeCap: 1580,
            jobs: [],
            confirmedJobID: nil, confirmedPaycheckDate: nil,
            obbbaHoursCompleted: 0, obbbaHoursRequired: 80,
            currentMonth: "May"
        ),
        onConnectTapped: {},
        onJobsTapped: {}
    )
    .padding()
    .background(CivicaColors.paper)
}

#Preview("Cold start") {
    MarketplaceEntryCard(state: .empty, onConnectTapped: {}, onJobsTapped: {})
        .padding()
        .background(CivicaColors.paper)
}

#Preview("Pending benefit") {
    PendingBenefitBanner()
        .padding()
        .background(CivicaColors.paper)
}
