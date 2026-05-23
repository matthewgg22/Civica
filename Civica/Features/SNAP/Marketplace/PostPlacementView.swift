import CivicaDesignSystem
import SwiftUI

// DEPRECATED — use SNAPPlacementUpdateView instead.
// See MarketplaceFlowView.swift for context.
// Screen 5 — Post-placement update (paycheck confirmed via Argyle).
// DR3-5: combined accessibilityLabel on before→after benefit row.
// DR3-7: cliff event amber banner + navigator outreach status.
// DR3-deferred-3: navigator status row shown inline after cliff banner.
struct PostPlacementView: View {
    let state: MarketplaceState
    let confirmedJob: MarketplaceJob
    let confirmedPaycheckDate: Date
    let previousBenefitUSD: Decimal
    let onReportProblem: () -> Void
    let onSeeBreakdown: () -> Void

    // Set when POST /navigator/outreach has been called successfully.
    var navigatorOutreachScheduled: Bool = false

    @AppStorage(CivicaLanguage.defaultStorageKey)
    private var languageRaw: String = CivicaLanguage.english.rawValue
    private var language: CivicaLanguage { CivicaLanguage(rawValue: languageRaw) ?? .english }

    var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                hero
                hairline.padding(.vertical, 0)
                benefitBeforeAfter
                hairline.padding(.vertical, 0)

                if isCliffEvent {
                    cliffBanner
                    hairline.padding(.vertical, 0)
                }

                if state.obbbaHoursRequired > 0 {
                    obbbaSection
                    hairline.padding(.vertical, 0)
                }

                actions
            }
        }
        .background(CivicaColors.paper)
        .navigationTitle(SNAPMarketplaceStrings.updateNavTitle.value(in: language))
        .navigationBarTitleDisplayMode(.inline)
    }

    // MARK: - Private

    private var isCliffEvent: Bool {
        confirmedJob.projectedBenefitUSD == 0 && previousBenefitUSD > 0
    }

    private var hero: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
            Text(SNAPMarketplaceStrings.paycheckConfirmedPrefix.value(in: language) + confirmedPaycheckDate.formatted(.dateTime.month(.wide).day()))
                .font(CivicaTypography.support)
                .foregroundStyle(CivicaColors.graphite)
                .textCase(.uppercase)
                .kerning(1.2)
            HStack(alignment: .firstTextBaseline, spacing: CivicaSpacing.xs) {
                Text(confirmedJob.employerName)
                    .font(CivicaTypography.subheadStrong)
                    .foregroundStyle(CivicaColors.ink)
                Text("· ")
                    .foregroundStyle(CivicaColors.graphite)
                CivicaMoney(amount: confirmedJob.monthlyAmountUSD, font: CivicaTypography.subheadStrong)
                    .foregroundStyle(CivicaColors.ink)
                Text(SNAPMarketplaceStrings.firstPaycheck.value(in: language))
                    .font(CivicaTypography.body)
                    .foregroundStyle(CivicaColors.graphite)
            }
            Text(SNAPMarketplaceStrings.confirmedViaArgyle.value(in: language))
                .font(CivicaTypography.body)
                .foregroundStyle(CivicaColors.graphite)
        }
        .padding(.horizontal, CivicaSpacing.xl)
        .padding(.vertical, CivicaSpacing.lg)
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    // DR3-5: VoiceOver reads as single element "Your monthly benefit went from $X to $Y"
    private var benefitBeforeAfter: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.md) {
            Text(SNAPMarketplaceStrings.yourBenefitEstimateLabel.value(in: language))
                .font(CivicaTypography.support)
                .foregroundStyle(CivicaColors.graphite)
                .textCase(.uppercase)
                .kerning(1.2)

            HStack(alignment: .firstTextBaseline, spacing: CivicaSpacing.lg) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(SNAPMarketplaceStrings.wasLabel.value(in: language))
                        .font(CivicaTypography.support)
                        .foregroundStyle(CivicaColors.graphite)
                        .textCase(.uppercase)
                        .kerning(1.2)
                    CivicaMoney(amount: previousBenefitUSD, denominator: "mo", font: CivicaTypography.body)
                        .foregroundStyle(CivicaColors.graphite)
                        .strikethrough(color: CivicaColors.graphite.opacity(0.6))
                }
                Image(systemName: "arrow.right")
                    .foregroundStyle(CivicaColors.graphite)
                    .font(.system(size: 14))
                VStack(alignment: .leading, spacing: 2) {
                    Text(SNAPMarketplaceStrings.nowLabel.value(in: language))
                        .font(CivicaTypography.support)
                        .foregroundStyle(CivicaColors.graphite)
                        .textCase(.uppercase)
                        .kerning(1.2)
                    CivicaMoney(amount: confirmedJob.projectedBenefitUSD, denominator: "mo", font: CivicaTypography.cardHero)
                        .foregroundStyle(CivicaColors.ink)
                }
            }
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("Your monthly benefit went from \(previousBenefitUSD.formatted(.currency(code: "USD"))) to \(confirmedJob.projectedBenefitUSD.formatted(.currency(code: "USD")))")

            Text(SNAPMarketplaceStrings.countyNotified.value(in: language))
                .font(CivicaTypography.body)
                .foregroundStyle(CivicaColors.amberPrimary)
        }
        .padding(.horizontal, CivicaSpacing.xl)
        .padding(.vertical, CivicaSpacing.lg)
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    // DR3-7: cliff event amber banner
    private var cliffBanner: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
            HStack(spacing: CivicaSpacing.sm) {
                Image(systemName: "exclamationmark.triangle.fill")
                    .foregroundStyle(CivicaColors.warningAmber)
                Text(SNAPMarketplaceStrings.incomeExceedsLimit.value(in: language))
                    .font(CivicaTypography.subheadStrong)
                    .foregroundStyle(CivicaColors.warningAmber)
            }
            Text(SNAPMarketplaceStrings.navigatorReviewingCase.value(in: language))
                .font(CivicaTypography.body)
                .foregroundStyle(CivicaColors.graphite)
                .fixedSize(horizontal: false, vertical: true)

            // DR3-deferred-3: navigator outreach inline status
            if navigatorOutreachScheduled {
                HStack(spacing: CivicaSpacing.sm) {
                    Image(systemName: "checkmark.circle")
                        .foregroundStyle(CivicaColors.amberPrimary)
                        .font(.system(size: 14))
                    Text(SNAPMarketplaceStrings.navigatorOutreachScheduled.value(in: language))
                        .font(CivicaTypography.footnote)
                        .foregroundStyle(CivicaColors.graphite)
                }
            }
        }
        .padding(CivicaSpacing.lg)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(CivicaColors.warningAmber.opacity(0.08))
        .accessibilityIdentifier("marketplace.post_placement.cliff_banner")
    }

    private var obbbaSection: some View {
        OBBBAProgressBar(
            hoursCompleted: state.obbbaHoursCompleted,
            hoursRequired: state.obbbaHoursRequired,
            month: state.currentMonth
        )
        .padding(.horizontal, CivicaSpacing.xl)
        .padding(.vertical, CivicaSpacing.lg)
    }

    private var actions: some View {
        VStack(spacing: CivicaSpacing.md) {
            Button(action: onSeeBreakdown) {
                Text(SNAPMarketplaceStrings.seeFullBenefitBreakdown.value(in: language))
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(CivicaSecondaryCTAButtonStyle())
            .accessibilityIdentifier("marketplace.post_placement.see_breakdown")

            Button(action: onReportProblem) {
                Text(SNAPMarketplaceStrings.reportAProblem.value(in: language))
                    .font(CivicaTypography.body)
                    .foregroundStyle(CivicaColors.amberPrimary)
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("marketplace.post_placement.report_problem")
        }
        .padding(.horizontal, CivicaSpacing.xl)
        .padding(.vertical, CivicaSpacing.lg)
    }

    private var hairline: some View {
        Rectangle()
            .fill(CivicaColors.hairline)
            .frame(height: 1)
    }
}

#Preview("Standard — W-2") {
    NavigationStack {
        PostPlacementView(
            state: MarketplaceState(
                canvasConnected: true, argyleConnected: true,
                currentBenefitUSD: 214, incomeCap: 1580,
                jobs: [], confirmedJobID: "2",
                confirmedPaycheckDate: Date(),
                obbbaHoursCompleted: 32, obbbaHoursRequired: 80,
                currentMonth: "May"
            ),
            confirmedJob: MarketplaceJob(
                id: "2", title: "Dining Services", employerName: "Dining Services",
                type: .w2, scheduleDescription: "16 hr/wk",
                monthlyAmountUSD: 612, pillText: "Counts as income",
                handshakeJobURL: nil, fallbackCareerURL: nil,
                projectedBenefitUSD: 214, currentBenefitUSD: 292
            ),
            confirmedPaycheckDate: Date(),
            previousBenefitUSD: 292,
            onReportProblem: {}, onSeeBreakdown: {}
        )
    }
}

#Preview("Cliff event") {
    NavigationStack {
        PostPlacementView(
            state: .empty,
            confirmedJob: MarketplaceJob(
                id: "3", title: "Full-Time Role", employerName: "Tech Corp",
                type: .w2, scheduleDescription: "40 hr/wk",
                monthlyAmountUSD: 3_200, pillText: "Counts as income",
                handshakeJobURL: nil, fallbackCareerURL: nil,
                projectedBenefitUSD: 0, currentBenefitUSD: 292
            ),
            confirmedPaycheckDate: Date(),
            previousBenefitUSD: 292,
            onReportProblem: {}, onSeeBreakdown: {},
            navigatorOutreachScheduled: true
        )
    }
}
