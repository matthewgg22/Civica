import CivicaDesignSystem
import SwiftUI

// Screen 2 — Jobs that fit your schedule.
// DR3-1: FWS → W-2 → gig sort order.
// DR3-4: ◆/○/∶ leading glyphs.
// DR3-11: framing copy below income cap line.
struct JobMatchListView: View {
    let state: MarketplaceState
    let incomeCap: Decimal
    let onSelectJob: (MarketplaceJob) -> Void
    let onShowMore: () -> Void
    let onFilter: () -> Void

    var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                scheduleStrip
                openHoursLine
                hairline
                incomeCapLine
                hairline
                framingCopy
                hairline

                let sorted = state.jobs.sortedByBenefitRank()
                ForEach(Array(sorted.enumerated()), id: \.element.id) { idx, job in
                    JobMatchRow(
                        title: job.title,
                        meta: job.scheduleDescription,
                        type: dsJobType(job.type),
                        pillText: job.pillText,
                        benefitText: benefitText(job),
                        benefitAmount: job.projectedBenefitUSD,
                        onTap: { onSelectJob(job) }
                    )
                    if idx < sorted.count - 1 { hairline }
                }

                hairline
                footer
            }
        }
        .background(CivicaColors.paper)
        .navigationTitle("Jobs for you")
        .navigationBarTitleDisplayMode(.inline)
    }

    // MARK: - Private

    private var scheduleStrip: some View {
        let days = ["M", "T", "W", "T", "F", "S", "S"]
        // Class days shown as teal pip; pulled from Canvas schedule in production.
        // Fixture: Tue + Thu blocked.
        let classOn = [false, true, false, true, false, false, false]
        return HStack(spacing: 0) {
            ForEach(0..<7, id: \.self) { i in
                VStack(spacing: 6) {
                    Text(days[i])
                        .font(CivicaTypography.support)
                        .foregroundStyle(CivicaColors.graphite)
                        .textCase(.uppercase)
                        .kerning(1.2)
                    Capsule()
                        .fill(classOn[i] ? CivicaColors.accentTeal : Color.clear)
                        .frame(width: 18, height: 2)
                }
                .frame(maxWidth: .infinity)
            }
        }
        .frame(height: 56)
        .padding(.horizontal, CivicaSpacing.xl)
        .background(CivicaColors.surfacePrimary)
    }

    private var openHoursLine: some View {
        Text("Open hours: M/W/F afternoons, T/Th evenings, weekends")
            .font(CivicaTypography.footnote)
            .foregroundStyle(CivicaColors.graphite)
            .padding(.horizontal, CivicaSpacing.xl)
            .padding(.vertical, CivicaSpacing.md)
            .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var incomeCapLine: some View {
        HStack(spacing: CivicaSpacing.sm) {
            CivicaMoney(amount: incomeCap, denominator: "mo", font: CivicaTypography.body)
                .foregroundStyle(CivicaColors.ink)
            Text("before benefit changes")
                .font(CivicaTypography.body)
                .foregroundStyle(CivicaColors.ink)
            // Info dot
            ZStack {
                Circle()
                    .strokeBorder(CivicaColors.accentTeal, lineWidth: 1)
                    .frame(width: 16, height: 16)
                Text("i")
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(CivicaColors.accentTeal)
            }
            Spacer()
        }
        .padding(.horizontal, CivicaSpacing.xl)
        .padding(.vertical, CivicaSpacing.md)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Income cap: \(incomeCap.formatted(.currency(code: "USD"))) per month before benefit changes")
    }

    private var framingCopy: some View {
        Text("We rank jobs by what's best for your income, not what's best for employers.")
            .font(CivicaTypography.footnote)
            .foregroundStyle(CivicaColors.graphite)
            .padding(.horizontal, CivicaSpacing.xl)
            .padding(.vertical, CivicaSpacing.sm)
            .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var footer: some View {
        HStack(spacing: CivicaSpacing.xl) {
            Button("Show more", action: onShowMore)
                .font(CivicaTypography.body)
                .foregroundStyle(CivicaColors.accentTeal)
            Rectangle()
                .fill(CivicaColors.hairline)
                .frame(width: 1, height: 14)
            Button("Filter", action: onFilter)
                .font(CivicaTypography.body)
                .foregroundStyle(CivicaColors.accentTeal)
        }
        .padding(CivicaSpacing.xl)
        .frame(maxWidth: .infinity)
    }

    private var hairline: some View {
        Rectangle()
            .fill(CivicaColors.hairline)
            .frame(height: 1)
    }

    private func dsJobType(_ type: MarketplaceJobType) -> JobMatchRow.JobType {
        switch type {
        case .fws: return .fws
        case .w2: return .w2
        case .platformGig: return .gig
        }
    }

    private func benefitText(_ job: MarketplaceJob) -> String {
        switch job.type {
        case .fws:
            return "Benefit stays \(job.currentBenefitUSD.formatted(.currency(code: "USD").precision(.fractionLength(0))))"
        case .w2:
            return "Benefit becomes \(job.projectedBenefitUSD.formatted(.currency(code: "USD").precision(.fractionLength(0))))"
        case .platformGig:
            return "Benefit varies"
        }
    }
}

#Preview {
    NavigationStack {
        JobMatchListView(
            state: MarketplaceState(
                canvasConnected: true,
                argyleConnected: true,
                currentBenefitUSD: 292,
                jobs: [
                    MarketplaceJob(
                        id: "1", title: "Library Assistant", employerName: "Campus Library",
                        type: .fws, scheduleDescription: "12 hr/wk · $18/hr · M/W/F afternoons",
                        monthlyAmountUSD: 864, pillText: "Work-study · doesn't count",
                        handshakeJobURL: nil, fallbackCareerURL: nil,
                        projectedBenefitUSD: 292, currentBenefitUSD: 292
                    ),
                    MarketplaceJob(
                        id: "2", title: "Dining Services", employerName: "Campus Dining",
                        type: .w2, scheduleDescription: "16 hr/wk · $17/hr · T/Th evenings",
                        monthlyAmountUSD: 1_179, pillText: "Counts as income",
                        handshakeJobURL: nil, fallbackCareerURL: nil,
                        projectedBenefitUSD: 214, currentBenefitUSD: 292
                    ),
                    MarketplaceJob(
                        id: "3", title: "DoorDash · flexible hours", employerName: "DoorDash",
                        type: .platformGig, scheduleDescription: "Sign-up bonus $600",
                        monthlyAmountUSD: 800, pillText: "Counts as OBBBA hours",
                        handshakeJobURL: nil, fallbackCareerURL: nil,
                        projectedBenefitUSD: 210, currentBenefitUSD: 292
                    ),
                ],
                confirmedJobID: nil, confirmedPaycheckDate: nil,
                obbbaHoursCompleted: 0, obbbaHoursRequired: 80, currentMonth: "May"
            ),
            incomeCap: 1_580,
            onSelectJob: { _ in },
            onShowMore: {},
            onFilter: {}
        )
    }
}
