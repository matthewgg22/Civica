import SwiftUI

/// Screen 03 — Benefit impact calculator.
///
/// Calculator-style breakdown of how taking a job affects SNAP.
/// Uses real U+2212 minus sign. FWS exclusion cited by federal rule.
/// Leads to the Apply modal (Screen 04) or "Save for later".
struct SNAPJobImpactView: View {
    @ObservedObject var vm: SNAPMarketplaceViewModel
    let job: SNAPMarketplaceJob
    var onApply: () -> Void
    var onSaveForLater: () -> Void

    @AppStorage(CivicaLanguage.defaultStorageKey)
    private var languageRaw: String = CivicaLanguage.english.rawValue
    private var language: CivicaLanguage { CivicaLanguage(rawValue: languageRaw) ?? .english }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                heroBlock
                MHairline()
                calculatorSection
                togetherSection
                footnoteBlock
                actionsSection
                Spacer(minLength: 32)
            }
        }
        .accessibilityIdentifier("marketplace.benefit_impact")
        .background(Color.civicaPaper.ignoresSafeArea())
        .navigationTitle(job.title)
        .navigationBarTitleDisplayMode(.inline)
    }

    // MARK: Hero

    private var heroBlock: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(job.title + SNAPMarketplaceStrings.campusSuffix.value(in: language))
                .font(MFont.heroHeadline)
                .foregroundStyle(Color.civicaInk)
                .fixedSize(horizontal: false, vertical: true)

            Text("\(job.hours)"
                 + SNAPMarketplaceStrings.hrPerWk.value(in: language)
                 + "\(job.wage)"
                 + SNAPMarketplaceStrings.hrRate.value(in: language)
                 + job.schedule
                 + SNAPMarketplaceStrings.plusWeekends.value(in: language))
                .font(MFont.meta)
                .foregroundStyle(Color.civicaGraphite)
        }
        .padding(.horizontal, 24)
        .padding(.top, 12)
        .padding(.bottom, 16)
    }

    // MARK: Calculator section

    private var calculatorSection: some View {
        VStack(alignment: .leading, spacing: 0) {
            MCapsLabel(text: "If you take this job")
                .padding(.top, 20)
                .padding(.bottom, 14)

            VStack(spacing: 10) {
                CalcRow(label: "Job income (gross)",
                        amount: "+$1,179")
                CalcRow(label: "Earned income deduction",
                        qualifier: "(20%)",
                        amount: "\u{2212}$236")   // U+2212 minus
                CalcRow(label: "Counted income added",
                        amount: "+$943")
                CalcRow(label: "Reduces benefit by",
                        qualifier: "(30%)",
                        amount: "\u{2212}$78")    // U+2212 minus
            }

            // Sum rule line — 1.5pt ink
            Rectangle()
                .fill(Color.civicaInk)
                .frame(height: 1.5)
                .padding(.horizontal, 24)
                .padding(.top, 14)
                .padding(.bottom, 12)

            // Total row (strong variant)
            CalcRow(label: "Your new monthly benefit",
                    amount: "$214",
                    isTotal: true)

            // FWS exclusion citation — italic
            Text(SNAPMarketplaceStrings.fwsExclusion.value(in: language))
                .font(MFont.fwsCitation)
                .foregroundStyle(Color.civicaGraphite)
                .lineSpacing(13 * 0.5)  // line-height 1.5
                .fixedSize(horizontal: false, vertical: true)
                .padding(.horizontal, 24)
                .padding(.top, 14)
                .accessibilityLabel("FWS earnings would be zero in this calculation — they are excluded by federal rule 7 CFR 273.9(c)(3).")
        }
    }

    // MARK: Together section

    private var togetherSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            MCapsLabel(text: "Together (job + benefit)")
                .padding(.top, 20)

            // "$1,393/month total income — $315 more than benefit alone."
            // "$1,393/month" is 600 weight + tabular-nums within a 500 teal line
            Group {
                Text(SNAPMarketplaceStrings.demoTotalIncome.value(in: language))
                    .font(.custom("HankenGrotesk-SemiBold", size: 17))
                    .monospacedDigit()
                + Text(SNAPMarketplaceStrings.totalIncomeSuffix.value(in: language))
                    .font(MFont.bodySmallMedium)
            }
            .foregroundStyle(Color.civicaTeal)
            .lineSpacing(17 * 0.4)
            .fixedSize(horizontal: false, vertical: true)
            .padding(.horizontal, 24)
            .accessibilityLabel("$1,393 per month total income — $315 more than benefit alone.")
        }
    }

    // MARK: Footnote

    private var footnoteBlock: some View {
        Text(SNAPMarketplaceStrings.footnoteEstimate.value(in: language))
            .font(MFont.meta)
            .foregroundStyle(Color.civicaGraphite)
            .lineSpacing(13 * 0.5)
            .fixedSize(horizontal: false, vertical: true)
            .padding(.horizontal, 24)
            .padding(.top, 16)
    }

    // MARK: Actions

    private var actionsSection: some View {
        VStack(spacing: 10) {
            MBrickButton(label: "Apply through Handshake") {
                onApply()
            }
            .accessibilityLabel("Apply through Handshake")
            .accessibilityIdentifier("marketplace.benefit_impact.apply_button")

            MTealOutlineButton(label: "Save for later") {
                onSaveForLater()
            }
            .accessibilityLabel("Save for later")
        }
        .padding(.top, 20)
        .padding(.bottom, 16)
    }
}

// MARK: - Calc Row

private struct CalcRow: View {
    let label: String
    var qualifier: String? = nil
    let amount: String
    var isTotal: Bool = false

    var body: some View {
        HStack(alignment: .lastTextBaseline, spacing: 16) {
            // Label (+ optional inline qualifier in graphite)
            HStack(alignment: .lastTextBaseline, spacing: 6) {
                Text(label)
                    .font(isTotal ? MFont.calcTotalLabel : MFont.calcRowLabel)
                    .foregroundStyle(Color.civicaInk)

                if let q = qualifier {
                    Text(q)
                        .font(isTotal ? MFont.calcTotalLabel : MFont.calcRowLabel)
                        .foregroundStyle(Color.civicaGraphite)
                }
            }
            .fixedSize(horizontal: false, vertical: true)

            Spacer(minLength: 8)

            // Amount — tabular numerals, right-aligned, no wrap
            Text(amount)
                .font(isTotal ? MFont.calcTotalAmount : MFont.calcRowAmount)
                .foregroundStyle(Color.civicaInk)
                .monospacedDigit()
                .lineLimit(1)
                .accessibilityLabel(amount.replacingOccurrences(of: "\u{2212}", with: "minus "))
        }
        .padding(.horizontal, 24)
        .frame(minHeight: 28)
    }
}

#if DEBUG
#Preview {
    let vm = SNAPMarketplaceViewModel()
    return NavigationStack {
        SNAPJobImpactView(
            vm: vm,
            job: vm.jobs[1],
            onApply: {},
            onSaveForLater: {}
        )
    }
}
#endif
