import CivicaDesignSystem
import SwiftUI

/// Applicant-facing screen for logging and reviewing monthly SNAP work hours.
///
/// Surfaces the §10102 80-hour/month requirement, shows progress, and lets
/// applicants add sessions with optional pay-stub attachment. The written
/// notice required by 7 CFR 273.7(g) is shown as a one-time banner at the
/// top of the screen.
struct WorkHoursLogView: View {

    let packetId: String
    let apiClient: (any EnrollmentAPIClient)?

    init(
        packetId: String = "",
        apiClient: (any EnrollmentAPIClient)? = nil
    ) {
        self.packetId = packetId
        self.apiClient = apiClient
    }

    @AppStorage(CivicaLanguage.defaultStorageKey)
    private var languageRaw: String = CivicaLanguage.english.rawValue

    private var language: CivicaLanguage {
        CivicaLanguage(rawValue: languageRaw) ?? .english
    }

    @State private var response: WorkHoursResponse?
    @State private var isLoading = false
    @State private var loadError: String?
    @State private var showAddSheet = false
    @State private var entryToDelete: WorkHourLogEntry?
    @State private var noticeAcknowledged = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: CivicaSpacing.xxl) {
                if !noticeAcknowledged {
                    writtenNotice
                }

                if isLoading {
                    loadingPlaceholder
                } else if let error = loadError {
                    errorView(error)
                } else if let response {
                    progressSection(response.monthly_summary)
                    sessionsSection(response.entries, summary: response.monthly_summary)
                }

                Spacer(minLength: CivicaSpacing.xl)
            }
            .padding(CivicaSpacing.xl)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(CivicaColors.paper.ignoresSafeArea())
        .navigationTitle(WorkHoursStrings.pageTitle.value(in: language))
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Button {
                    showAddSheet = true
                } label: {
                    Image(systemName: "plus")
                        .foregroundStyle(CivicaColors.pinePrimary)
                }
            }
        }
        .sheet(isPresented: $showAddSheet) {
            AddWorkSessionSheet(packetId: packetId, apiClient: apiClient) { _ in
                Task { await loadHours() }
            }
        }
        .task { await loadHours() }
    }

    // MARK: - 7 CFR 273.7(g) written notice

    private var writtenNotice: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.md) {
            Text(WorkHoursStrings.noticeTitle.value(in: language))
                .font(CivicaTypography.subheadStrong)
                .foregroundStyle(CivicaColors.ink)

            Text(WorkHoursStrings.noticeBody.value(in: language))
                .font(CivicaTypography.body)
                .foregroundStyle(CivicaColors.ink)
                .fixedSize(horizontal: false, vertical: true)

            Text(WorkHoursStrings.noticeConsequence.value(in: language))
                .font(CivicaTypography.footnote)
                .foregroundStyle(CivicaColors.graphite)
                .fixedSize(horizontal: false, vertical: true)

            Button {
                withAnimation { noticeAcknowledged = true }
            } label: {
                Text(WorkHoursStrings.noticeAcknowledge.value(in: language))
                    .font(CivicaTypography.subheadStrong)
                    .foregroundStyle(CivicaColors.onPrimaryText)
                    .frame(maxWidth: .infinity)
                    .frame(minHeight: 44)
            }
            .background(CivicaColors.pinePrimary)
            .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.control, style: .continuous))
        }
        .padding(CivicaSpacing.lg)
        .background(CivicaColors.pinePrimary.opacity(0.06))
        .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: CivicaRadius.card, style: .continuous)
                .stroke(CivicaColors.pinePrimary.opacity(0.25), lineWidth: 1)
        )
    }

    // MARK: - Progress section

    private func progressSection(_ summary: WorkHoursMonthlySummary) -> some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.md) {
            HStack {
                Text(WorkHoursStrings.monthlyProgressHeader.value(in: language))
                    .font(CivicaTypography.sectionHeader)
                    .foregroundStyle(CivicaColors.ink)
                Spacer()
                statusChip(summary)
            }

            // Progress bar
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    RoundedRectangle(cornerRadius: 4, style: .continuous)
                        .fill(CivicaColors.hairline)
                        .frame(height: 8)
                    RoundedRectangle(cornerRadius: 4, style: .continuous)
                        .fill(progressColor(summary))
                        .frame(width: geo.size.width * summary.progressFraction, height: 8)
                }
            }
            .frame(height: 8)

            HStack {
                Text("\(formatted(summary.total_hours)) \(WorkHoursStrings.hoursOf.value(in: language))")
                    .font(CivicaTypography.footnote)
                    .foregroundStyle(CivicaColors.graphite)
                Spacer()
                Text("\(formatted(summary.target_hours)) hrs")
                    .font(CivicaTypography.footnote)
                    .foregroundStyle(CivicaColors.graphite)
            }
        }
        .padding(CivicaSpacing.lg)
        .background(CivicaColors.surfacePrimary)
        .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: CivicaRadius.card, style: .continuous)
                .stroke(CivicaColors.hairline, lineWidth: 1)
        )
    }

    private func statusChip(_ summary: WorkHoursMonthlySummary) -> some View {
        let (label, color): (String, Color) = {
            if summary.is_complete {
                return (WorkHoursStrings.statusComplete.value(in: language), CivicaColors.pinePrimary)
            } else if summary.is_on_track {
                return (WorkHoursStrings.statusOnTrack.value(in: language), CivicaColors.pinePrimary)
            } else {
                return (WorkHoursStrings.statusAtRisk.value(in: language), CivicaColors.warningAmber)
            }
        }()
        return Text(label)
            .font(CivicaTypography.caption)
            .foregroundStyle(color)
            .padding(.horizontal, CivicaSpacing.sm)
            .padding(.vertical, 4)
            .background(color.opacity(0.1))
            .clipShape(Capsule())
    }

    private func progressColor(_ summary: WorkHoursMonthlySummary) -> Color {
        if summary.is_complete { return CivicaColors.pinePrimary }
        if summary.is_on_track { return CivicaColors.pinePrimary }
        return .orange
    }

    // MARK: - Sessions section

    private func sessionsSection(_ entries: [WorkHourLogEntry], summary: WorkHoursMonthlySummary) -> some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.md) {
            Text(WorkHoursStrings.sessionsThisMonth.value(in: language))
                .font(CivicaTypography.sectionHeader)
                .foregroundStyle(CivicaColors.ink)

            if entries.isEmpty {
                emptyState
            } else {
                ForEach(entries) { entry in
                    sessionRow(entry)
                }
            }

            logButton
        }
    }

    private var emptyState: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
            Text(WorkHoursStrings.noSessionsYet.value(in: language))
                .font(CivicaTypography.subheadStrong)
                .foregroundStyle(CivicaColors.ink)
            Text(WorkHoursStrings.noSessionsSubtitle.value(in: language))
                .font(CivicaTypography.body)
                .foregroundStyle(CivicaColors.graphite)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(CivicaSpacing.lg)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(CivicaColors.surfacePrimary)
        .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: CivicaRadius.card, style: .continuous)
                .stroke(CivicaColors.hairline, lineWidth: 1)
        )
    }

    private func sessionRow(_ entry: WorkHourLogEntry) -> some View {
        HStack(alignment: .top) {
            VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
                Text(formattedDate(entry.work_date))
                    .font(CivicaTypography.subheadStrong)
                    .foregroundStyle(CivicaColors.ink)

                Text(activityLabel(entry.activityType))
                    .font(CivicaTypography.body)
                    .foregroundStyle(CivicaColors.graphite)

                if let employer = entry.employer_name, !employer.isEmpty {
                    Text(employer)
                        .font(CivicaTypography.footnote)
                        .foregroundStyle(CivicaColors.graphite)
                }

                if entry.document_id != nil {
                    Text(WorkHoursStrings.documentBadge.value(in: language))
                        .font(CivicaTypography.caption)
                        .foregroundStyle(CivicaColors.pinePrimary)
                        .padding(.horizontal, CivicaSpacing.sm)
                        .padding(.vertical, 2)
                        .background(CivicaColors.pinePrimary.opacity(0.1))
                        .clipShape(Capsule())
                }
            }

            Spacer()

            Text("\(formatted(entry.hours)) hrs")
                .font(CivicaTypography.subheadStrong)
                .foregroundStyle(CivicaColors.ink)
        }
        .padding(CivicaSpacing.lg)
        .background(CivicaColors.surfacePrimary)
        .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: CivicaRadius.card, style: .continuous)
                .stroke(CivicaColors.hairline, lineWidth: 1)
        )
        .swipeActions(edge: .trailing, allowsFullSwipe: false) {
            Button(role: .destructive) {
                Task { await deleteEntry(entry) }
            } label: {
                Label("Delete", systemImage: "trash")
            }
        }
    }

    private var logButton: some View {
        Button {
            showAddSheet = true
        } label: {
            Text(WorkHoursStrings.addSession.value(in: language))
                .font(CivicaTypography.subheadStrong)
                .foregroundStyle(CivicaColors.onPrimaryText)
                .frame(maxWidth: .infinity)
                .frame(minHeight: 56)
        }
        .background(CivicaColors.pinePrimary)
        .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.control, style: .continuous))
    }

    // MARK: - Loading / error states

    private var loadingPlaceholder: some View {
        ProgressView()
            .frame(maxWidth: .infinity)
            .padding(CivicaSpacing.xxl)
    }

    private func errorView(_ message: String) -> some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.md) {
            Text(WorkHoursStrings.loadingError.value(in: language))
                .font(CivicaTypography.body)
                .foregroundStyle(CivicaColors.ink)
            Button(WorkHoursStrings.retryButton.value(in: language)) {
                Task { await loadHours() }
            }
            .font(CivicaTypography.subheadStrong)
            .foregroundStyle(CivicaColors.pinePrimary)
        }
        .padding(CivicaSpacing.lg)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(CivicaColors.brickAccent.opacity(0.06))
        .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card, style: .continuous))
    }

    // MARK: - Actions

    private func loadHours() async {
        guard let api = apiClient else { return }
        isLoading = true
        loadError = nil
        defer { isLoading = false }
        do {
            response = try await api.fetchWorkHours(packetId: packetId, month: nil)
        } catch {
            loadError = error.localizedDescription
        }
    }

    private func deleteEntry(_ entry: WorkHourLogEntry) async {
        guard let api = apiClient else { return }
        do {
            try await api.deleteWorkHoursEntry(packetId: packetId, logId: entry.log_id)
            await loadHours()
        } catch {
            loadError = error.localizedDescription
        }
    }

    // MARK: - Formatting helpers

    private func formatted(_ hours: Double) -> String {
        hours.truncatingRemainder(dividingBy: 1) == 0
            ? String(Int(hours))
            : String(format: "%.1f", hours)
    }

    private func formattedDate(_ dateStr: String) -> String {
        let fmt = DateFormatter()
        fmt.dateFormat = "yyyy-MM-dd"
        guard let date = fmt.date(from: dateStr) else { return dateStr }
        let display = DateFormatter()
        display.dateStyle = .medium
        display.timeStyle = .none
        return display.string(from: date)
    }

    private func activityLabel(_ type: WorkActivityType) -> String {
        language == .spanish ? type.displayLabelES : type.displayLabel
    }
}

// MARK: - Preview

#if DEBUG
#Preview("Empty state") {
    NavigationStack {
        WorkHoursLogView()
    }
}

#Preview("With mock client") {
    NavigationStack {
        WorkHoursLogView(
            packetId: "mock-packet-123",
            apiClient: MockEnrollmentAPIClient()
        )
    }
}

#Preview("Spanish") {
    NavigationStack {
        WorkHoursLogView(
            packetId: "mock-packet-123",
            apiClient: MockEnrollmentAPIClient()
        )
    }
    .onAppear {
        UserDefaults.standard.set(CivicaLanguage.spanish.rawValue,
                                  forKey: CivicaLanguage.defaultStorageKey)
    }
}
#endif
