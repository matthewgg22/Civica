import CivicaDesignSystem
import SwiftUI

// Recertification Companion dashboard.
//
// Composes four features (Phantom Recert, Expiration Calendar,
// Just-in-Time Reminders, Procedural Appeal) into a single home view.
// Surfaced from CivicaEntryView when RecertCompanionFeatureFlag is on,
// and from CivicaRootView when SNAPApplicationStatusStore.status is
// .recertDue.

struct RecertCompanionRoot: View {
    @AppStorage(CivicaLanguage.defaultStorageKey)
    private var languageRaw: String = CivicaLanguage.english.rawValue

    @EnvironmentObject private var statusStore: SNAPApplicationStatusStore
    @StateObject private var scheduleStore = RecertScheduleStore()

    /// USPS two-letter state code for the rules + appeal lookups.
    /// Defaults to MA — the current launch state. CA is configured
    /// but not yet surfaced from the application draft.
    let stateCode: String

    @State private var isEditingDate = false

    init(stateCode: String = "MA") {
        self.stateCode = stateCode
    }

    private var language: CivicaLanguage {
        CivicaLanguage(rawValue: languageRaw) ?? .english
    }

    /// Approval milestone, used as the anchor for the default recert
    /// date and for the appeal flow's "denial recency" check.
    private var approvedAt: Date? {
        statusStore.timestamp(for: .decisionApproved)
    }

    private var effectiveRecertDate: Date? {
        scheduleStore.effectiveDate(approvedAt: approvedAt)
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: CivicaSpacing.xl) {
                header
                recertDateCard

                // Phantom Recert entry tile — wired in Step 5.

                if let recert = effectiveRecertDate {
                    ExpirationCalendarView(
                        stateCode: stateCode,
                        nextRecertDate: recert,
                        onCaptureDocument: { _ in
                            // Wired in Step 7 to push the existing
                            // document camera flow for the tapped type.
                        }
                    )
                }

                // Reminders permission card — wired in Step 4.
                // Appeal CTA — wired in Step 6.

                Spacer(minLength: CivicaSpacing.xl)
            }
            .padding(CivicaSpacing.xl)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(CivicaColors.paper.ignoresSafeArea())
        .navigationTitle(RecertCompanionStrings.homeTitle.value(in: language))
        .navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $isEditingDate) {
            RecertScheduleEditView(store: scheduleStore, approvedAt: approvedAt)
        }
        .onAppear {
            RecertCompanionAnalytics.trackHomeViewed()
        }
    }

    // MARK: - Pieces

    private var header: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
            Text(RecertCompanionStrings.homeTitle.value(in: language))
                .font(CivicaTypography.pageTitle)
                .foregroundStyle(CivicaColors.ink)
                .fixedSize(horizontal: false, vertical: true)
                .accessibilityAddTraits(.isHeader)
            Text(RecertCompanionStrings.homeSubtitle.value(in: language))
                .font(CivicaTypography.body)
                .foregroundStyle(CivicaColors.graphite)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private var recertDateCard: some View {
        HStack(spacing: CivicaSpacing.md) {
            Image(systemName: "calendar")
                .font(.system(size: 24))
                .foregroundStyle(CivicaColors.brickPrimary)
                .frame(width: 44, height: 44)
                .background(
                    RoundedRectangle(cornerRadius: CivicaRadius.control, style: .continuous)
                        .fill(CivicaColors.brickPrimary.opacity(0.12))
                )
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
                Text(RecertCompanionStrings.recertDateLabel.value(in: language))
                    .font(CivicaTypography.footnoteStrong)
                    .foregroundStyle(CivicaColors.graphite)
                    .textCase(.uppercase)
                    .kerning(1.2)
                Text(recertDateDisplay)
                    .font(CivicaTypography.sectionHeader)
                    .foregroundStyle(CivicaColors.ink)
            }
            Spacer(minLength: CivicaSpacing.sm)
            Button(action: { isEditingDate = true }) {
                Text(RecertCompanionStrings.editDateAction.value(in: language))
                    .font(CivicaTypography.footnoteStrong)
                    .foregroundStyle(CivicaColors.brickPrimary)
            }
            .buttonStyle(.plain)
        }
        .padding(CivicaSpacing.md)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(CivicaColors.surfacePrimary)
        .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card))
        .overlay(
            RoundedRectangle(cornerRadius: CivicaRadius.card)
                .strokeBorder(CivicaColors.hairline, lineWidth: 1)
        )
    }

    private var recertDateDisplay: String {
        guard let date = effectiveRecertDate else {
            return RecertCompanionStrings.unknownDate.value(in: language)
        }
        let formatter = DateFormatter()
        formatter.dateStyle = .long
        formatter.timeStyle = .none
        return formatter.string(from: date)
    }
}

#if DEBUG
struct RecertCompanionRoot_Previews: PreviewProvider {
    static var previews: some View {
        NavigationStack {
            RecertCompanionRoot()
                .environmentObject(SNAPApplicationStatusStore())
        }
    }
}
#endif
