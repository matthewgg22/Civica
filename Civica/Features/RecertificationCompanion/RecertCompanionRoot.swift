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
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    /// USPS two-letter state code for the rules + appeal lookups.
    /// Defaults to CA — the current launch state (2026-05-13 switch
    /// from MA). MA is still configured for the back-cohort tests
    /// but new flows surface CA by default.
    let stateCode: String

    @State private var isEditingDate = false
    @State private var presentingPhantom = false
    @State private var presentingAppeal = false
    @State private var presentingInterviewCoach = false
    @State private var capturingDocument: SNAPDocumentType?

    /// Phantom Recert is offered when the next recert is within 60
    /// days. Outside that window the user gets the calendar but no
    /// "start dry run" CTA — staying that long ahead of the actual
    /// recert flow is noise.
    static let phantomEligibleWindowDays = 60

    init(stateCode: String = "CA") {
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

                if isOverdue {
                    overdueBanner
                }

                StatusSummaryCard(
                    daysUntilRecert: daysUntilRecert,
                    actionsNeeded: actionsNeededCount,
                    language: language,
                    onPrimaryAction: handleStatusSummaryAction
                )

                if effectiveRecertDate == nil {
                    noRecertDatePlaceholder
                } else {
                    recertDateCard
                }

                if let recert = effectiveRecertDate {
                    ExpirationCalendarView(
                        stateCode: stateCode,
                        nextRecertDate: recert,
                        onCaptureDocument: { type in
                            capturingDocument = type
                        }
                    )
                }

                if shouldOfferPhantom || shouldShowInterviewCoachInline {
                    Text(RecertCompanionStrings.practiceSectionHeader.value(in: language))
                        .font(CivicaTypography.sectionHeader)
                        .foregroundStyle(CivicaColors.ink)
                        .accessibilityAddTraits(.isHeader)
                }

                if shouldOfferPhantom {
                    PhantomRecertEntryView(onStart: {
                        presentingPhantom = true
                    })
                }

                if shouldShowInterviewCoachInline {
                    interviewCoachEntryTile
                }

                if statusStore.status == .decisionDenied {
                    appealEntryTile
                }

                // Permission affordance lives at the bottom as a dismissible
                // hint — design review D3 moved it out of the hero slot.
                // Only surface when notifications haven't been decided yet.
                RecertNotificationPermissionView()

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
        .sheet(item: $capturingDocument) { type in
            SNAPDocumentCameraView(
                onCaptured: { image, _ in
                    SNAPCapturedDocumentStore.save(image, as: type)
                    capturingDocument = nil
                    Task { await reconcileReminders() }
                },
                onCancel: {
                    capturingDocument = nil
                }
            )
        }
        .navigationDestination(isPresented: $presentingPhantom) {
            if let recert = effectiveRecertDate {
                PhantomRecertFlowView(
                    language: language,
                    stateCode: stateCode,
                    nextRecertDate: recert
                )
            }
        }
        .navigationDestination(isPresented: $presentingAppeal) {
            AppealEntryView(stateCode: stateCode)
        }
        .navigationDestination(isPresented: $presentingInterviewCoach) {
            PracticeSessionView()
        }
        .onAppear {
            RecertCompanionAnalytics.trackHomeViewed()
            Task { await reconcileReminders() }
        }
    }

    private var appealEntryTile: some View {
        Button(action: { presentingAppeal = true }) {
            HStack(spacing: CivicaSpacing.md) {
                Image(systemName: "scale.3d")
                    .font(.system(size: 28))
                    .foregroundStyle(CivicaColors.pinePrimary)
                    .frame(width: 48, height: 48)
                    .background(
                        RoundedRectangle(cornerRadius: CivicaRadius.control, style: .continuous)
                            .fill(CivicaColors.pinePrimary.opacity(0.12))
                    )
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
                    Text(RecertCompanionStrings.appealEntryTitle.value(in: language))
                        .font(CivicaTypography.sectionHeader)
                        .foregroundStyle(CivicaColors.ink)
                    Text(RecertCompanionStrings.appealEntrySubtitle.value(in: language))
                        .font(CivicaTypography.footnoteStrong)
                        .foregroundStyle(CivicaColors.graphite)
                        .lineLimit(2)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: CivicaSpacing.sm)
                Image(systemName: "chevron.right")
                    .foregroundStyle(CivicaColors.graphite)
                    .accessibilityHidden(true)
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
        .buttonStyle(.plain)
    }

    private var interviewCoachEntryTile: some View {
        HStack(spacing: CivicaSpacing.md) {
            Image(systemName: "person.wave.2.fill")
                .font(.system(size: 28))
                .foregroundStyle(CivicaColors.pinePrimary)
                .frame(width: 48, height: 48)
                .background(
                    RoundedRectangle(cornerRadius: CivicaRadius.control, style: .continuous)
                        .fill(CivicaColors.pinePrimary.opacity(0.12))
                )
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
                Text(RecertCompanionStrings.interviewCoachEntryTitle.value(in: language))
                    .font(CivicaTypography.sectionHeader)
                    .foregroundStyle(CivicaColors.ink)
                Text(RecertCompanionStrings.interviewCoachEntrySubtitle.value(in: language))
                    .font(CivicaTypography.footnoteStrong)
                    .foregroundStyle(CivicaColors.graphite)
                    .lineLimit(2)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: CivicaSpacing.sm)
            Button(action: { presentingInterviewCoach = true }) {
                Text(RecertCompanionStrings.interviewCoachEntryCTA.value(in: language))
                    .font(CivicaTypography.footnoteStrong)
                    .foregroundStyle(CivicaColors.paper)
                    .padding(.horizontal, CivicaSpacing.md)
                    .frame(minWidth: 44, minHeight: 44)
                    .background(
                        RoundedRectangle(cornerRadius: CivicaRadius.control, style: .continuous)
                            .fill(CivicaColors.pinePrimary)
                    )
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

    private var shouldOfferPhantom: Bool {
        guard let recert = effectiveRecertDate else { return false }
        let daysUntil = Calendar.current.dateComponents([.day], from: Date(), to: recert).day ?? Int.max
        return daysUntil >= 0 && daysUntil <= Self.phantomEligibleWindowDays
    }

    /// We keep the inline interview-coach tile visible whenever the
    /// recert is on the horizon. Hidden when overdue — the user
    /// doesn't need rehearsal copy when the date has already passed;
    /// the hero CTA routes them to a navigator instead.
    private var shouldShowInterviewCoachInline: Bool {
        !isOverdue
    }

    /// Negative when overdue. Nil when no recert date is set.
    var daysUntilRecert: Int? {
        guard let recert = effectiveRecertDate else { return nil }
        return Calendar.current.dateComponents([.day], from: Date(), to: recert).day
    }

    var isOverdue: Bool {
        if let d = daysUntilRecert, d < 0 { return true }
        return false
    }

    /// Count of upcoming actions on the ExpirationCalendar. Computed
    /// the same way the calendar view does it, but de-duplicated into
    /// a single integer for the StatusSummaryCard. Returns 0 when no
    /// recert is scheduled — we can't forecast without a target date.
    var actionsNeededCount: Int {
        guard let recert = effectiveRecertDate else { return 0 }
        let vault = Dictionary(uniqueKeysWithValues:
            SNAPDocumentVaultReader.allCaptured().map { ($0.type, $0.capturedAt) }
        )
        let forecast = DocumentExpirationPredictor.forecast(.init(
            today: Date(),
            nextRecertDate: recert,
            vault: vault,
            stateCode: stateCode
        ))
        return forecast.documentsNeedingReplacement
    }

    private func handleStatusSummaryAction() {
        let card = StatusSummaryCard(
            daysUntilRecert: daysUntilRecert,
            actionsNeeded: actionsNeededCount,
            language: language,
            onPrimaryAction: {}
        )
        switch card.primaryActionKind {
        case .contactNavigator:
            // SMS link — best-effort. Falls through if Messages isn't
            // available (e.g. iPad without cellular). The navigator
            // outreach number is configured per-county; for now we
            // route to a generic CDSS info line until the per-user
            // navigator phone is wired through the enrollment API.
            if let url = URL(string: "sms:&body=I%20need%20help%20with%20my%20CalFresh%20recertification") {
                #if canImport(UIKit)
                UIApplication.shared.open(url)
                #endif
            }
        case .startPhantom:
            presentingPhantom = true
        case .viewCalendar:
            // Calendar is already on this screen — the tap is a no-op
            // beyond the implicit "look down." A future iteration can
            // scroll-to-anchor; for v1 the visual feedback of the
            // pressed button is enough.
            break
        }
    }

    private var overdueBanner: some View {
        let days = max(1, -(daysUntilRecert ?? 0))
        let body: String = days == 1
            ? RecertCompanionStrings.overdueBannerBodySingular.value(in: language)
            : String(
                format: RecertCompanionStrings.overdueBannerBody.value(in: language),
                days
            )
        return HStack(alignment: .top, spacing: CivicaSpacing.sm) {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundStyle(CivicaColors.warningAmber)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
                Text(RecertCompanionStrings.overdueBannerTitle.value(in: language))
                    .font(CivicaTypography.footnoteStrong)
                    .foregroundStyle(CivicaColors.ink)
                Text(body)
                    .font(CivicaTypography.footnoteStrong)
                    .foregroundStyle(CivicaColors.graphite)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(CivicaSpacing.md)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(CivicaColors.warningAmber.opacity(0.12))
        .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card))
        .overlay(
            RoundedRectangle(cornerRadius: CivicaRadius.card)
                .strokeBorder(CivicaColors.warningAmber.opacity(0.4), lineWidth: 1)
        )
        .accessibilityElement(children: .combine)
    }

    /// Rendered in place of the recertDateCard when no date has been
    /// captured yet. Design review D4 — the empty state should
    /// communicate "we're waiting on your enrollment" rather than
    /// leaving the user staring at "Date not set."
    private var noRecertDatePlaceholder: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
            Text(RecertCompanionStrings.noDateTitle.value(in: language))
                .font(CivicaTypography.sectionHeader)
                .foregroundStyle(CivicaColors.ink)
                .fixedSize(horizontal: false, vertical: true)
            Text(RecertCompanionStrings.noDateBody.value(in: language))
                .font(CivicaTypography.footnoteStrong)
                .foregroundStyle(CivicaColors.graphite)
                .fixedSize(horizontal: false, vertical: true)
            Button(action: { isEditingDate = true }) {
                Text(RecertCompanionStrings.noDateExplainerLink.value(in: language))
                    .font(CivicaTypography.footnoteStrong)
                    .foregroundStyle(CivicaColors.pinePrimary)
                    .underline()
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

    /// Build a fresh forecast and reconcile the system's pending
    /// reminder requests against it. Idempotent — safe to call from
    /// every onAppear.
    private func reconcileReminders() async {
        guard let recert = effectiveRecertDate else { return }
        let vault = Dictionary(uniqueKeysWithValues:
            SNAPDocumentVaultReader.allCaptured().map { ($0.type, $0.capturedAt) }
        )
        let forecast = DocumentExpirationPredictor.forecast(.init(
            today: Date(),
            nextRecertDate: recert,
            vault: vault,
            stateCode: stateCode
        ))
        let planned = DocumentReminderScheduler.plan(
            forecast: forecast,
            language: language
        )
        await RecertNotificationService.shared.reconcile(planned: planned)
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

    /// At accessibility Dynamic Type sizes, the trailing Edit button
    /// pushes the date text into truncation. Switch to a vertical
    /// layout so both fields keep their full width.
    @ViewBuilder
    private var recertDateCard: some View {
        if dynamicTypeSize >= .accessibility1 {
            recertDateCardVertical
        } else {
            recertDateCardHorizontal
        }
    }

    private var recertDateCardVertical: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
            Image(systemName: "calendar")
                .font(.system(size: 24))
                .foregroundStyle(CivicaColors.pinePrimary)
                .frame(width: 44, height: 44)
                .background(
                    RoundedRectangle(cornerRadius: CivicaRadius.control, style: .continuous)
                        .fill(CivicaColors.pinePrimary.opacity(0.12))
                )
                .accessibilityHidden(true)
            Text(RecertCompanionStrings.recertDateLabel.value(in: language))
                .font(CivicaTypography.footnoteStrong)
                .foregroundStyle(CivicaColors.graphite)
                .textCase(.uppercase)
                .kerning(1.2)
            Text(recertDateDisplay)
                .font(CivicaTypography.sectionHeader)
                .foregroundStyle(CivicaColors.ink)
                .fixedSize(horizontal: false, vertical: true)
            Button(action: { isEditingDate = true }) {
                Text(RecertCompanionStrings.editDateAction.value(in: language))
                    .font(CivicaTypography.footnoteStrong)
                    .foregroundStyle(CivicaColors.pinePrimary)
                    .frame(minHeight: 44)
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

    private var recertDateCardHorizontal: some View {
        HStack(spacing: CivicaSpacing.md) {
            Image(systemName: "calendar")
                .font(.system(size: 24))
                .foregroundStyle(CivicaColors.pinePrimary)
                .frame(width: 44, height: 44)
                .background(
                    RoundedRectangle(cornerRadius: CivicaRadius.control, style: .continuous)
                        .fill(CivicaColors.pinePrimary.opacity(0.12))
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
                    .foregroundStyle(CivicaColors.pinePrimary)
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

#Preview("xxxLarge") {
    NavigationStack {
        RecertCompanionRoot()
            .environmentObject(SNAPApplicationStatusStore())
    }
    .dynamicTypeSize(.xxxLarge)
}

#Preview("accessibility1") {
    NavigationStack {
        RecertCompanionRoot()
            .environmentObject(SNAPApplicationStatusStore())
    }
    .dynamicTypeSize(.accessibility1)
}
#endif
