import CivicaDesignSystem
import SwiftUI

// DEPRECATED — use SNAPJobImpactView instead. See MarketplaceFlowView.swift for context.
// Screen 3 — Benefit impact detail for a selected job.
// DR3-3: BenefitImpactCard with 4-line math + FWS exclusion call-out.
// DR3-10: tabular nums handled by CivicaMoney inside BenefitImpactCard.
struct BenefitImpactView: View {
    let job: MarketplaceJob
    let onApply: () -> Void
    let onBack: () -> Void

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: CivicaSpacing.xl) {
                BenefitImpactCard(
                    jobType: dsCardJobType(job.type),
                    employerName: job.employerName,
                    grossJobIncome: job.monthlyAmountUSD,
                    fwsExcluded: job.type == .fws ? job.monthlyAmountUSD : 0,
                    countedIncome: job.type == .fws ? 0 : job.monthlyAmountUSD,
                    eidApplied: job.type == .fws ? 0 : roundDollar(job.monthlyAmountUSD * Decimal(string: "0.20")!),
                    benefitReduction: benefitReduction,
                    currentBenefit: job.currentBenefitUSD,
                    projectedBenefit: job.projectedBenefitUSD
                )

                if job.type == .platformGig {
                    gigVariabilityNote
                }

                applyButton
            }
            .padding(CivicaSpacing.lg)
        }
        .background(CivicaColors.paper)
        .navigationTitle(job.title)
        .navigationBarTitleDisplayMode(.inline)
    }

    // MARK: - Private

    // DR3-deferred-1: gig variability copy confirmed.
    private var gigVariabilityNote: some View {
        Text("\(job.employerName) income changes monthly. We'll recalculate when each paycheck lands.")
            .font(CivicaTypography.footnote)
            .foregroundStyle(CivicaColors.graphite)
            .padding(CivicaSpacing.md)
            .background(
                RoundedRectangle(cornerRadius: CivicaRadius.card, style: .continuous)
                    .fill(CivicaColors.surfacePrimary)
            )
    }

    private var applyButton: some View {
        Button(action: onApply) {
            Text("Apply via Handshake")
                .frame(maxWidth: .infinity)
        }
        .buttonStyle(CivicaPrimaryCTAButtonStyle())
        .accessibilityIdentifier("marketplace.benefit_impact.apply_button")
    }

    private var benefitReduction: Decimal {
        guard job.type != .fws else { return 0 }
        let net = job.monthlyAmountUSD * Decimal(string: "0.80")!
        return roundDollar(net * Decimal(string: "0.30")!)
    }

    private func roundDollar(_ v: Decimal) -> Decimal {
        var input = v; var output = Decimal()
        NSDecimalRound(&output, &input, 0, .plain)
        return output
    }

    private func dsCardJobType(_ t: MarketplaceJobType) -> BenefitImpactCard.JobType {
        switch t {
        case .fws: return .fws
        case .w2: return .w2
        case .platformGig: return .gig
        }
    }
}

#Preview("FWS — benefit unchanged") {
    NavigationStack {
        BenefitImpactView(
            job: MarketplaceJob(
                id: "1", title: "Library Assistant", employerName: "Campus Library",
                type: .fws, scheduleDescription: "12 hr/wk · $18/hr",
                monthlyAmountUSD: 864, pillText: "Work-study · doesn't count",
                handshakeJobURL: nil, fallbackCareerURL: nil,
                projectedBenefitUSD: 292, currentBenefitUSD: 292
            ),
            onApply: {}, onBack: {}
        )
    }
}

#Preview("W-2 — benefit reduces") {
    NavigationStack {
        BenefitImpactView(
            job: MarketplaceJob(
                id: "2", title: "Dining Services", employerName: "Campus Dining",
                type: .w2, scheduleDescription: "16 hr/wk · $17/hr",
                monthlyAmountUSD: 1_179, pillText: "Counts as income",
                handshakeJobURL: nil, fallbackCareerURL: nil,
                projectedBenefitUSD: 214, currentBenefitUSD: 292
            ),
            onApply: {}, onBack: {}
        )
    }
}
