import SwiftUI

/// Line-itemized benefit impact breakdown for a job offer.
///
/// When FWS applies, shows the 7 CFR 273.9(c)(3) exclusion line instead of
/// the earned-income deduction stack. All dollar amounts use CivicaMoney so
/// tabular-nums and VoiceOver are handled automatically.
public struct BenefitImpactCard: View {

    public enum JobType {
        case fws
        case w2
        case gig
    }

    public struct LineItem: Identifiable {
        public let id = UUID()
        public let label: String
        public let amount: Decimal
        public let isSubtraction: Bool
        public let citation: String?

        public init(label: String, amount: Decimal, isSubtraction: Bool = false, citation: String? = nil) {
            self.label = label
            self.amount = amount
            self.isSubtraction = isSubtraction
            self.citation = citation
        }
    }

    public let jobType: JobType
    public let employerName: String
    public let grossJobIncome: Decimal
    public let fwsExcluded: Decimal
    public let countedIncome: Decimal
    public let eidApplied: Decimal
    public let benefitReduction: Decimal
    public let currentBenefit: Decimal
    public let projectedBenefit: Decimal

    public init(
        jobType: JobType,
        employerName: String,
        grossJobIncome: Decimal,
        fwsExcluded: Decimal,
        countedIncome: Decimal,
        eidApplied: Decimal,
        benefitReduction: Decimal,
        currentBenefit: Decimal,
        projectedBenefit: Decimal
    ) {
        self.jobType = jobType
        self.employerName = employerName
        self.grossJobIncome = grossJobIncome
        self.fwsExcluded = fwsExcluded
        self.countedIncome = countedIncome
        self.eidApplied = eidApplied
        self.benefitReduction = benefitReduction
        self.currentBenefit = currentBenefit
        self.projectedBenefit = projectedBenefit
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            header

            Divider()
                .padding(.vertical, CivicaSpacing.md)

            mathLines

            Divider()
                .padding(.vertical, CivicaSpacing.md)

            resultRow
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

    // MARK: - Private

    private var header: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
            Text("Benefit impact")
                .font(CivicaTypography.support)
                .foregroundStyle(CivicaColors.graphite)
                .textCase(.uppercase)
                .kerning(1.2)
            Text(employerName)
                .font(CivicaTypography.subheadStrong)
                .foregroundStyle(CivicaColors.ink)
        }
    }

    @ViewBuilder
    private var mathLines: some View {
        if jobType == .fws {
            mathRow(
                label: "Job income",
                amount: grossJobIncome,
                color: CivicaColors.ink
            )
            mathRow(
                label: "Excluded — 7 CFR 273.9(c)(3)",
                amount: -fwsExcluded,
                color: CivicaColors.accentTeal,
                note: "Federal Work-Study earnings don't count as SNAP income"
            )
            mathRow(
                label: "Counted income",
                amount: 0,
                color: CivicaColors.ink
            )
        } else {
            mathRow(
                label: "Job income",
                amount: grossJobIncome,
                color: CivicaColors.ink
            )
            mathRow(
                label: "20% earned-income deduction",
                amount: -eidApplied,
                color: CivicaColors.accentTeal,
                note: "7 CFR 273.9(d)(1)"
            )
            mathRow(
                label: "Counted income",
                amount: countedIncome,
                color: CivicaColors.ink
            )
            mathRow(
                label: "30% benefit reduction",
                amount: -benefitReduction,
                color: CivicaColors.warningAmber,
                note: "7 CFR 273.10(e)(1)(i)"
            )
        }
    }

    private func mathRow(
        label: String,
        amount: Decimal,
        color: Color,
        note: String? = nil
    ) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack {
                Text(label)
                    .font(CivicaTypography.footnote)
                    .foregroundStyle(CivicaColors.graphite)
                    .frame(maxWidth: .infinity, alignment: .leading)
                CivicaMoney(amount: abs(amount), font: CivicaTypography.footnote)
                    .foregroundStyle(color)
            }
            if let note {
                Text(note)
                    .font(CivicaTypography.caption)
                    .foregroundStyle(CivicaColors.graphite.opacity(0.7))
            }
        }
        .padding(.bottom, CivicaSpacing.xs)
    }

    private var resultRow: some View {
        HStack(alignment: .firstTextBaseline) {
            VStack(alignment: .leading, spacing: 2) {
                Text("Your benefit")
                    .font(CivicaTypography.support)
                    .foregroundStyle(CivicaColors.graphite)
                HStack(alignment: .firstTextBaseline, spacing: CivicaSpacing.sm) {
                    CivicaMoney(amount: currentBenefit, denominator: "mo", font: CivicaTypography.body)
                        .foregroundStyle(CivicaColors.graphite)
                        .strikethrough(color: CivicaColors.graphite.opacity(0.6))
                    Image(systemName: "arrow.right")
                        .imageScale(.large)
                        .font(.body)
                        .foregroundStyle(CivicaColors.graphite)
                    CivicaMoney(amount: projectedBenefit, denominator: "mo", font: CivicaTypography.cardHero)
                        .foregroundStyle(projectedBenefit < currentBenefit ? CivicaColors.warningAmber : CivicaColors.ink)
                }
            }
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(
                "Your benefit changes from \(currentBenefit.formatted(.currency(code: "USD"))) to \(projectedBenefit.formatted(.currency(code: "USD"))) per month"
            )
        }
    }
}

#Preview("FWS — benefit unchanged") {
    BenefitImpactCard(
        jobType: .fws,
        employerName: "Library Assistant",
        grossJobIncome: 864,
        fwsExcluded: 864,
        countedIncome: 0,
        eidApplied: 0,
        benefitReduction: 0,
        currentBenefit: 292,
        projectedBenefit: 292
    )
    .padding()
    .background(CivicaColors.paper)
}

#Preview("W-2 — benefit reduces") {
    BenefitImpactCard(
        jobType: .w2,
        employerName: "Dining Services",
        grossJobIncome: 1_179,
        fwsExcluded: 0,
        countedIncome: 943,
        eidApplied: 236,
        benefitReduction: 78,
        currentBenefit: 292,
        projectedBenefit: 214
    )
    .padding()
    .background(CivicaColors.paper)
}
