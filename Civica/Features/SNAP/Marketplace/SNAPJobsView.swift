import SwiftUI

/// Screen 02 — Schedule-matched job list.
///
/// Shows the user's class schedule as a 7-column day strip, then lists
/// three matched jobs. FWS row is fully teal; income-counted rows show
/// ink benefit numbers. Amber appears only as a 5×5pt dot in the pill.
struct SNAPJobsView: View {
    @ObservedObject var vm: SNAPMarketplaceViewModel
    var onSelectJob: (SNAPMarketplaceJob) -> Void

    @AppStorage(CivicaLanguage.defaultStorageKey)
    private var languageRaw: String = CivicaLanguage.english.rawValue
    private var language: CivicaLanguage { CivicaLanguage(rawValue: languageRaw) ?? .english }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                scheduleStrip
                openHoursLine
                MHairline()
                incomeCapLine
                MHairline()
                jobRows
                MHairline()
                footer
            }
        }
        .background(Color.mktPaper.ignoresSafeArea())
        .navigationTitle(SNAPMarketplaceStrings.jobsNavTitle.value(in: language))
        .navigationBarTitleDisplayMode(.inline)
    }

    // MARK: Schedule strip (56pt, paper-2 background)

    private var scheduleStrip: some View {
        let days = ["M", "T", "W", "T", "F", "S", "S"]
        return HStack(spacing: 0) {
            ForEach(Array(days.enumerated()), id: \.offset) { idx, day in
                VStack(spacing: 6) {
                    Text(day)
                        .font(MFont.capsLabel)
                        .foregroundStyle(Color.mktGraphite)
                        .kerning(1.5)
                        .accessibilityHidden(true)
                    // Teal bar on class-block days; transparent otherwise
                    RoundedRectangle(cornerRadius: 1)
                        .fill(vm.schedule.classBlocks[idx] ? Color.mktTeal : Color.clear)
                        .frame(width: 18, height: 2)
                        .accessibilityHidden(true)
                }
                .frame(maxWidth: .infinity)
            }
        }
        .padding(.horizontal, 24)
        .frame(height: 56)
        .background(Color.mktPaper2)
        .accessibilityLabel("Class schedule: Tuesday and Thursday class blocks")
    }

    // MARK: Open hours

    private var openHoursLine: some View {
        Text(SNAPMarketplaceStrings.openHoursPrefix.value(in: language) + vm.schedule.openSummary)
            .font(MFont.meta)
            .foregroundStyle(Color.mktGraphite)
            .padding(.top, 12)
            .padding(.horizontal, 24)
            .padding(.bottom, 16)
    }

    // MARK: Income cap line

    private var incomeCapLine: some View {
        HStack(spacing: 10) {
            Text(SNAPMarketplaceStrings.incomeCapPrefix.value(in: language)
                 + "\(vm.incomeCap)"
                 + SNAPMarketplaceStrings.incomeCapSuffix.value(in: language))
                .font(MFont.bodySmallMedium)
                .foregroundStyle(Color.mktInk)
                .fixedSize(horizontal: false, vertical: true)
            InfoDotView(color: .mktTeal)
                .accessibilityLabel("Income cap information")
                .accessibilityHint("Tap to learn about the income limit before your benefit changes")
        }
        .padding(.horizontal, 24)
        .padding(.vertical, 16)
    }

    // MARK: Job rows

    private var jobRows: some View {
        VStack(spacing: 0) {
            ForEach(Array(vm.jobs.enumerated()), id: \.element.id) { idx, job in
                Button {
                    onSelectJob(job)
                } label: {
                    JobRowView(job: job)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("\(job.title), \(job.pillText), \(job.projectedBenefitLabel)")

                if idx < vm.jobs.count - 1 {
                    MHairline()
                }
            }
        }
    }

    // MARK: Footer

    private var footer: some View {
        HStack(spacing: 0) {
            Spacer()
            Button(SNAPMarketplaceStrings.showMore.value(in: language)) {}
                .font(MFont.bodySmallMedium)
                .foregroundStyle(Color.mktTeal)
                .padding(.vertical, 6)
                .padding(.horizontal, 4)
                .frame(minWidth: 44, minHeight: 44)
                .accessibilityLabel("Show more jobs")

            Rectangle()
                .fill(Color.mktGraphite.opacity(0.25))
                .frame(width: 1, height: 14)
                .padding(.horizontal, 12)

            Button(SNAPMarketplaceStrings.filter.value(in: language)) {}
                .font(MFont.bodySmallMedium)
                .foregroundStyle(Color.mktTeal)
                .padding(.vertical, 6)
                .padding(.horizontal, 4)
                .frame(minWidth: 44, minHeight: 44)
                .accessibilityLabel("Filter jobs")

            Spacer()
        }
        .padding(.top, 20)
        .padding(.bottom, 20)
    }
}

// MARK: - Info dot

private struct InfoDotView: View {
    var color: Color

    var body: some View {
        ZStack {
            Circle()
                .stroke(color, lineWidth: 1)
                .frame(width: 16, height: 16)
            Text("i")
                .font(.custom("HankenGrotesk-SemiBold", size: 10))
                .foregroundStyle(color)
        }
        .frame(width: 16, height: 16)
        .accessibilityHidden(true)
    }
}

// MARK: - Job row

private struct JobRowView: View {
    let job: SNAPMarketplaceJob

    var body: some View {
        HStack(alignment: .center, spacing: 12) {
            // Left ~52% — title + meta
            VStack(alignment: .leading, spacing: 4) {
                Text(job.title)
                    .font(MFont.listTitle)
                    .foregroundStyle(Color.mktInk)
                    .fixedSize(horizontal: false, vertical: true)

                let metaText = metaLabel
                if !metaText.isEmpty {
                    Text(metaText)
                        .font(MFont.meta)
                        .foregroundStyle(Color.mktGraphite)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            // Right — pill + benefit line
            VStack(alignment: .leading, spacing: 6) {
                PillView(job: job)
                Text(job.projectedBenefitLabel)
                    .font(MFont.bodySmallMedium)
                    .foregroundStyle(benefitColor)
                    .monospacedDigit()
                    .fixedSize(horizontal: false, vertical: true)
            }
            .fixedSize(horizontal: true, vertical: false)
        }
        .padding(.horizontal, 24)
        .frame(minHeight: 96)
    }

    private var metaLabel: String {
        switch job.classification {
        case .fws, .countedIncome:
            return "\(job.hours) hr/wk · $\(job.wage)/hr · \(job.schedule)"
        case .obbbaHours:
            return "Sign-up bonus $600"
        }
    }

    private var benefitColor: Color {
        switch job.projectedBenefitColor {
        case .teal: return .mktTeal
        case .ink:  return .mktInk
        }
    }
}

// MARK: - Pill

private struct PillView: View {
    let job: SNAPMarketplaceJob

    var body: some View {
        HStack(spacing: 5) {
            // Colored dot prefix (5×5pt)
            if job.pillDotColor != .none {
                Circle()
                    .fill(dotColor)
                    .frame(width: 5, height: 5)
                    .accessibilityHidden(true)
            }
            Text(job.pillText)
                .font(MFont.pill)
                .foregroundStyle(pillTextColor)
                .kerning(0.15)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 3)
        .background(Color.mktPaper2)
        .clipShape(Capsule())
    }

    private var pillTextColor: Color {
        switch job.pillColor {
        case .teal:     return .mktTeal
        case .graphite: return .mktGraphite
        }
    }

    private var dotColor: Color {
        switch job.pillDotColor {
        case .teal:     return .mktTeal
        case .amber:    return .mktAmber
        case .graphite: return .mktGraphite
        case .none:     return .clear
        }
    }
}

#if DEBUG
#Preview {
    NavigationStack {
        SNAPJobsView(
            vm: SNAPMarketplaceViewModel(),
            onSelectJob: { _ in }
        )
    }
}
#endif
