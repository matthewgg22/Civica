import CivicaDesignSystem
import SwiftUI

// Phase 2 (Pending) of the three-phase main screen, from the May 2026
// design pack. Rendered by CivicaRootView.rootSurface when status
// is .submittedToState / .documentsRequested / .interviewScheduled
// / .interviewCompleted (i.e. isPostSubmission AND NOT a final
// decision).
//
// Replaces the slot previously held by SNAPWaitingRoomView for the
// vanilla post-submission path. The legacy view is preserved in the
// repo (unreferenced by routing after this PR) so it can be quickly
// re-instated if the new layout needs a rollback. Cleanup is a
// follow-up after a soak period.
//
// Wiring state (May 2026): the visual content matches the locked
// design pack. Backend integrations are partial — county name pulls
// from SNAPApplicationDraftStore, day-count from the status store's
// submission timestamp, and copy adapts to status. The action rows
// (documents requested, inbound messages) and the error-risk row
// gate on flags that default to false in production — wire them in
// when the corresponding data sources ship. Search this file for
// "TODO wiring" to find each integration point.

struct CivicaHomePhase2View: View {
    @ObservedObject var statusStore: SNAPApplicationStatusStore
    let language: CivicaLanguage
    let onOpenExternalPortal: () -> Void

    @EnvironmentObject private var enrollmentAuth: CivicaEnrollmentAuth

    /// Optional handler so a DEBUG `CivicaPhaseTab` can swap the
    /// rendered phase from outside this view. Production ignores.
    var onDebugPhaseChange: ((CivicaPhase) -> Void)? = nil

    // Error-risk binding (wired in this PR — see SNAPErrorRiskStore).
    // The override parameters below stay for previews / tests that
    // want to force a specific tier without hitting the network;
    // production reads from the live store.
    var showErrorRiskOverride: Bool? = nil
    var errorRiskHeadlineOverride: String? = nil
    var errorRiskBodyOverride: String? = nil

    @StateObject private var errorRiskStore = SNAPErrorRiskStore()

    /// Derived: prefer the explicit override, else the live store.
    private var showErrorRisk: Bool {
        showErrorRiskOverride ?? errorRiskStore.shouldSurface
    }
    private var errorRiskHeadline: String {
        errorRiskHeadlineOverride ?? errorRiskStore.headline(in: language)
    }
    private var errorRiskBody: String {
        errorRiskBodyOverride ?? errorRiskStore.body(in: language)
    }

    // Documents-requested binding (wired in this PR — see SNAPInboxStore).
    // Same override-or-store pattern the error-risk row uses: previews
    // and tests can force a count without hitting the network;
    // production reads from the live store.
    var pendingDocumentCountOverride: Int? = nil
    var documentsDueDateLabelOverride: String? = nil
    var documentsListSummaryOverride: String? = nil

    @StateObject private var inboxStore = SNAPInboxStore()

    /// IS-2 (audit 2026-05-29) — coordinated sync-degraded banner.
    /// Listens to store-load outcomes + `NWPathMonitor`; surfaces a
    /// single dismissible banner when 2+ stores fail in a row or the
    /// network path goes unsatisfied. Per-row hides stay intact.
    @StateObject private var syncBanner = CivicaSyncBannerCoordinator()

    private var pendingDocumentCount: Int {
        pendingDocumentCountOverride ?? inboxStore.unresolvedCount
    }
    private var documentsDueDateLabel: String {
        documentsDueDateLabelOverride ?? inboxStore.relativeDueLabel(in: language)
    }
    private var documentsListSummary: String {
        documentsListSummaryOverride ?? inboxStore.summary(in: language)
    }

    // Interview appointment (IA-1). The scheduled date already lives on
    // the status store (interviewScheduledFor, captured on the waiting
    // room) — no new plumbing. Override slot is for previews/tests.
    var nextAppointmentOverride: Date? = nil
    private var nextAppointment: Date? {
        nextAppointmentOverride ?? statusStore.interviewScheduledFor
    }

    // MARK: - HIDDEN UNTIL BACKEND
    //
    // Messages-inbox slot — intentionally NOT bound in this PR. The
    // gateway today stores doc requests + free-form navigator prompts
    // in one `missing_item_requests` stream (read via /me/inbox); that
    // stream is already surfaced above as the documents-requested row.
    // A distinct applicant-facing messages channel (1:1 conversations,
    // unread state, separate model, separate endpoint) doesn't exist
    // yet. When it does, add a `SNAPMessagesInboxStore` and bind these
    // slots the same way the error-risk + documents-requested rows
    // are bound. Ledger: docs/runbooks/wiring-todo.md (audit IS-7).
    var unreadMessageCount: Int = 0
    var mostRecentMessageSender: String = ""
    var mostRecentMessageRelative: String = ""

    @State private var presentingWhatHappensNext: Bool = false

    // IS-8 (audit 2026-05-29): true on first render, flipped false at
    // the end of the parallel `.task` below. While true AND the
    // conditional-row band would otherwise be empty, three shimmered
    // skeleton rows render in the band's slot so the screen never
    // shows a blank gap between the primary CTA and the hairline
    // while inbox / error-risk fetches resolve.
    @State private var isFirstPaintLoading: Bool = true

    private var county: String {
        // Best-effort: read the county name from the persisted draft
        // when present. Falls back to a neutral phrase when the draft
        // doesn't carry county metadata — the design tolerates this.
        let draftCounty = SNAPApplicationDraftStore().load()?.draft.whereApplying.county
        return draftCounty?.trimmingCharacters(in: .whitespaces).isEmpty == false
            ? draftCounty!
            : CivicaPhase2Strings.fallbackCounty.value(in: language)
    }

    private var daysSinceSubmission: Int? {
        // Earliest of the post-submission timestamps gives a stable
        // anchor even as the case advances through interview states.
        let timestamps: [Date?] = [
            statusStore.timestamp(for: .submittedToState),
            statusStore.timestamp(for: .documentsRequested),
            statusStore.timestamp(for: .interviewScheduled),
            statusStore.timestamp(for: .interviewCompleted),
        ]
        guard let earliest = timestamps.compactMap({ $0 }).min() else { return nil }
        let days = Calendar.current.dateComponents([.day], from: earliest, to: Date()).day ?? 0
        return max(0, days)
    }

    // MARK: - Interview appointment card (IA-1)

    /// Inline appointment block, rendered above the timeline only when
    /// status == .interviewScheduled and a date is known. Surface goes
    /// warning-amber (process-attention) inside 48h, neutral otherwise.
    /// Channel hint ("By phone") and Add-to-Calendar are deferred — the
    /// former has no backend field yet, the latter needs an Info.plist
    /// calendar-usage key (kept out of feature PRs per branch hygiene).
    @ViewBuilder
    private var appointmentCard: some View {
        if statusStore.status == .interviewScheduled, let appt = nextAppointment {
            let isUrgent = appt.timeIntervalSinceNow <= 48 * 3600
            let accent = isUrgent ? CivicaColors.warningAmber : CivicaColors.pinePrimary
            HStack(alignment: .top, spacing: CivicaSpacing.md) {
                Image(systemName: "calendar")
                    .imageScale(.large)
                    .font(.body)
                    .foregroundStyle(accent)
                    .frame(width: 22, alignment: .leading)
                    .padding(.top, 1)
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 2) {
                    Text(appointmentPrimaryLine(appt))
                        .font(CivicaTypography.subheadStrong)
                        .foregroundStyle(CivicaColors.ink)
                        .fixedSize(horizontal: false, vertical: true)
                    if let relative = appointmentRelativeLine(appt) {
                        Text(relative)
                            .font(CivicaTypography.footnote)
                            .foregroundStyle(CivicaColors.graphite)
                    }
                }
                Spacer(minLength: 0)
            }
            .padding(CivicaSpacing.md)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(isUrgent ? CivicaColors.statusWarningSurface : CivicaColors.surfaceSecondary)
            .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.control))
            .accessibilityElement(children: .combine)
        }
    }

    /// "Interview · Wed Jun 12 · 2:30 PM" — locale-aware date + time.
    private func appointmentPrimaryLine(_ date: Date) -> String {
        let locale = Locale(identifier: language == .spanish ? "es" : "en")
        let dateFormatter = DateFormatter()
        dateFormatter.locale = locale
        dateFormatter.setLocalizedDateFormatFromTemplate("EEE MMM d")
        let timeFormatter = DateFormatter()
        timeFormatter.locale = locale
        timeFormatter.timeStyle = .short
        timeFormatter.dateStyle = .none
        let label = CivicaPhase2Strings.timelineInterview.value(in: language)
        return "\(label) · \(dateFormatter.string(from: date)) · \(timeFormatter.string(from: date))"
    }

    /// "Today" / "Tomorrow" / "In N days" — nil when the date is past
    /// (a stale .interviewScheduled state shouldn't show a misleading
    /// countdown; the date+time line still renders).
    private func appointmentRelativeLine(_ date: Date) -> String? {
        let calendar = Calendar.current
        let days = calendar.dateComponents(
            [.day],
            from: calendar.startOfDay(for: Date()),
            to: calendar.startOfDay(for: date)
        ).day ?? 0
        if days < 0 { return nil }
        if days == 0 { return CivicaPhase2Strings.appointmentToday.value(in: language) }
        if days == 1 { return CivicaPhase2Strings.appointmentTomorrow.value(in: language) }
        return CivicaPhase2Strings.appointmentInDays(days: days, language: language)
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: CivicaSpacing.lg) {
                // IS-2 (audit 2026-05-29): coordinated sync-degraded
                // banner sits above the phase tab so it's the first
                // thing the user sees when remote data is failing.
                CivicaSyncBanner(coordinator: syncBanner, language: language)

                phaseTab

                statusPill
                headline

                // IA-1 (audit 2026-05-29): when an interview is scheduled,
                // surface the date+time above the timeline. Previously the
                // body copy said "a caseworker will call at the scheduled
                // time" but the time was nowhere on screen — the #1 question
                // at this moment. A missed interview is a denied case.
                appointmentCard

                CivicaPhaseTimeline(
                    current: currentMilestone,
                    labels: [
                        CivicaPhase2Strings.timelineSubmitted.value(in: language),
                        CivicaPhase2Strings.timelineInReview.value(in: language),
                        CivicaPhase2Strings.timelineInterview.value(in: language),
                        CivicaPhase2Strings.timelineDecision.value(in: language),
                    ]
                )

                whatCountyIsDoing

                primaryCTA

                // JR-1 (audit 2026-05-29): "What I can do today" — a
                // small, status-aware checklist that gives the user
                // something concrete to do during the otherwise-opaque
                // county-review stretch. Suppressed on
                // `.interviewCompleted` so the pre-decision quiet stretch
                // doesn't feel cluttered.
                if statusStore.status.isPostSubmission
                    && statusStore.status != .interviewCompleted {
                    SNAPDailyChecklistCard(
                        status: statusStore.status,
                        language: language
                    )
                }

                // IA-2 (audit 2026-05-29): documents-requested renders ABOVE
                // error-risk. Documents-requested is concrete and finite
                // ("upload these 2 paystubs"); error-risk is a probabilistic
                // prediction. Actionable + finite outranks probabilistic +
                // open-ended in the post-CTA priority stack.
                if pendingDocumentCount > 0 {
                    CivicaActionRow(
                        icon: "doc.text",
                        primary: CivicaPhase2Strings
                            .documentsRequestedHeadline(count: pendingDocumentCount, language: language),
                        secondary: documentsSecondary,
                        action: onOpenExternalPortal
                    )
                }

                if showErrorRisk {
                    errorRiskRow
                }

                if unreadMessageCount > 0 {
                    CivicaActionRow(
                        icon: "envelope",
                        primary: CivicaPhase2Strings
                            .unreadMessagesHeadline(count: unreadMessageCount, language: language),
                        secondary: messagesSecondary,
                        action: onOpenExternalPortal
                    )
                }

                // IS-8 (audit 2026-05-29): first-paint skeleton fills
                // the conditional-row band while the parallel `.task`
                // fetches inbox + error-risk. Renders only when the
                // band would otherwise be empty so we don't double up
                // with real rows once they resolve.
                if isFirstPaintLoading
                    && pendingDocumentCount == 0
                    && !showErrorRisk
                    && unreadMessageCount == 0 {
                    VStack(spacing: CivicaSpacing.lg) {
                        CivicaSkeletonRow(height: 56)
                        CivicaSkeletonRow(height: 56)
                        CivicaSkeletonRow(height: 56)
                    }
                }

                hairline

                secondaryRows

                Spacer(minLength: CivicaSpacing.xl)
                privacyFooterLink
            }
            .padding(CivicaSpacing.xl)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(CivicaColors.paper.ignoresSafeArea())
        .navigationTitle("Civica")
        .navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $presentingWhatHappensNext) {
            SNAPWhatHappensNextSheet(
                statusStore: statusStore,
                language: language,
                onMessageNavigator: {
                    presentingWhatHappensNext = false
                    onOpenExternalPortal()
                }
            )
        }
        .task {
            // Bind the live enrollment client + fetch error-risk +
            // inbox in parallel. Silent fail per store — the home
            // view hides each row independently on any error.
            guard enrollmentAuth.state.isAuthenticated else {
                isFirstPaintLoading = false
                return
            }
            let client = enrollmentAuth.makeEnrollmentAPIClient()
            errorRiskStore.bind(client: client)
            inboxStore.bind(client: client)
            async let errorRisk: Void = errorRiskStore.load()
            async let inbox: Void = inboxStore.load()
            _ = await (errorRisk, inbox)
            isFirstPaintLoading = false

            // IS-2 (audit 2026-05-29): after both stores settle, feed
            // each outcome into the sync banner coordinator. Per-row
            // hides above already silenced individual rows; this is
            // the cross-store signal that decides whether the
            // coordinated banner surfaces.
            registerSyncOutcome(failed: errorRiskStore.lastLoadFailed)
            registerSyncOutcome(failed: inboxStore.lastLoadFailed)
        }
    }

    private func registerSyncOutcome(failed: Bool) {
        if failed {
            syncBanner.registerStoreFailure()
        } else {
            syncBanner.registerStoreSuccess()
        }
    }

    // MARK: - Phase tab

    /// Production: locked journey indicator (.enroll ✓ + .pending
    /// current + .enrolled locked). DEBUG with an injected change
    /// handler: free toggle for engineers / QA.
    @ViewBuilder
    private var phaseTab: some View {
        // Demo-only visibility. See CivicaEntryView.phaseTab for the
        // rationale; same gating across all three phase homes.
        if let onDebugPhaseChange {
            CivicaPhaseTab(current: .pending, onChange: onDebugPhaseChange)
        }
    }

    // MARK: - Status pill + headline

    private var statusPill: some View {
        HStack(spacing: CivicaSpacing.sm) {
            Circle()
                .fill(CivicaColors.pinePrimary)
                .frame(width: 7, height: 7)
            Text(statusPillText)
                .font(CivicaTypography.footnoteStrong)
                .foregroundStyle(CivicaColors.pinePrimaryPressed)
        }
        .padding(.horizontal, CivicaSpacing.md)
        .padding(.vertical, 5)
        .background(
            Capsule()
                .fill(CivicaColors.pineSurface)
        )
        .accessibilityElement(children: .combine)
    }

    private var statusPillText: String {
        let label: String = {
            switch statusStore.status {
            case .submittedToState:    return CivicaPhase2Strings.pillSubmitted.value(in: language)
            case .documentsRequested:  return CivicaPhase2Strings.pillDocumentsRequested.value(in: language)
            case .interviewScheduled:  return CivicaPhase2Strings.pillInterviewScheduled.value(in: language)
            case .interviewCompleted:  return CivicaPhase2Strings.pillInterviewCompleted.value(in: language)
            default:                   return CivicaPhase2Strings.pillSubmitted.value(in: language)
            }
        }()
        guard let days = daysSinceSubmission, days > 0 else { return label }
        return "\(label) · \(CivicaPhase2Strings.dayN(count: days, language: language))"
    }

    private var headline: some View {
        Text(CivicaPhase2Strings.headline(county: county, language: language))
            .font(CivicaTypography.pageTitle)
            .foregroundStyle(CivicaColors.ink)
            .fixedSize(horizontal: false, vertical: true)
            .accessibilityAddTraits(.isHeader)
    }

    // MARK: - "What county is doing" prose (status-conditioned)

    private var whatCountyIsDoing: some View {
        Text(whatCountyIsDoingText)
            .font(CivicaTypography.body)
            .foregroundStyle(CivicaColors.graphite)
            .fixedSize(horizontal: false, vertical: true)
    }

    private var whatCountyIsDoingText: String {
        switch statusStore.status {
        case .submittedToState:
            return CivicaPhase2Strings.bodySubmitted.value(in: language)
        case .documentsRequested:
            return CivicaPhase2Strings.bodyDocumentsRequested.value(in: language)
        case .interviewScheduled:
            return CivicaPhase2Strings.bodyInterviewScheduled.value(in: language)
        case .interviewCompleted:
            return CivicaPhase2Strings.bodyInterviewCompleted.value(in: language)
        default:
            return CivicaPhase2Strings.bodySubmitted.value(in: language)
        }
    }

    private var currentMilestone: CivicaPhaseTimeline.Milestone {
        switch statusStore.status {
        case .submittedToState, .documentsRequested:
            return .inReview
        case .interviewScheduled:
            return .interview
        case .interviewCompleted:
            return .decision
        default:
            return .inReview
        }
    }

    // MARK: - Primary CTA

    @ViewBuilder
    private var primaryCTA: some View {
        // JR-3 (audit 2026-05-29): the .interviewScheduled sub-state
        // escalates the primary CTA from the generic "What Happens
        // Next" sheet onto a NavigationLink that pushes the in-app
        // SNAPInterviewCoachView. The coach lowers activation energy
        // for the call (the highest-attrition moment in the SNAP
        // application). Other Phase 2 sub-states keep the existing
        // sheet flow. The routing rule is pinned by
        // `phase2PrimaryCTAPushesInterviewCoach` on SNAPApplicationStatus.
        if statusStore.status.phase2PrimaryCTAPushesInterviewCoach {
            NavigationLink {
                SNAPInterviewCoachView(
                    language: language,
                    interviewDate: statusStore.interviewScheduledFor,
                    onDismiss: {}
                )
            } label: {
                primaryCTALabel
            }
            .buttonStyle(.plain)
            .accessibilityLabel(primaryCTAText)
        } else {
            Button {
                presentingWhatHappensNext = true
            } label: {
                primaryCTALabel
            }
            .buttonStyle(.plain)
            .accessibilityLabel(primaryCTAText)
        }
    }

    private var primaryCTALabel: some View {
        HStack {
            Text(primaryCTAText)
                .font(CivicaTypography.subheadStrong)
                .foregroundStyle(CivicaColors.onPrimaryText)
            Spacer(minLength: 0)
            Image(systemName: "arrow.right")
                .foregroundStyle(CivicaColors.onPrimaryText)
        }
        .padding(.horizontal, CivicaSpacing.lg)
        .frame(maxWidth: .infinity, minHeight: 50)
        .background(
            RoundedRectangle(cornerRadius: CivicaRadius.control)
                .fill(CivicaColors.pinePrimary)
        )
    }

    private var primaryCTAText: String {
        // Interview-scheduled is a meaningful sub-state — escalate
        // the CTA accordingly so the user lands on the right
        // preparation surface.
        if statusStore.status == .interviewScheduled {
            return CivicaPhase2Strings.primaryCTAPrepareInterview.value(in: language)
        }
        return CivicaPhase2Strings.primaryCTAWhatNext.value(in: language)
    }

    // MARK: - Error-risk row (warning surface)

    private var errorRiskRow: some View {
        Button(action: onOpenExternalPortal) {
            HStack(alignment: .top, spacing: CivicaSpacing.md) {
                Image(systemName: "exclamationmark.triangle")
                    .imageScale(.large)
                    .font(.body)
                    .foregroundStyle(CivicaColors.warningAmber)
                    .accessibilityHidden(true)
                    .padding(.top, 1)
                VStack(alignment: .leading, spacing: 2) {
                    Text(errorRiskHeadline)
                        .font(CivicaTypography.subheadStrong)
                        .foregroundStyle(CivicaColors.ink)
                        .multilineTextAlignment(.leading)
                    Text(errorRiskBody)
                        .font(CivicaTypography.footnote)
                        .foregroundStyle(CivicaColors.graphite)
                        .multilineTextAlignment(.leading)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: CivicaSpacing.sm)
                Image(systemName: "chevron.right")
                    .imageScale(.large)
                    .font(.body)
                    .foregroundStyle(CivicaColors.graphite)
                    .accessibilityHidden(true)
                    .padding(.top, 4)
            }
            .padding(.vertical, CivicaSpacing.md)
            .padding(.horizontal, CivicaSpacing.md)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(CivicaColors.statusWarningSurface)
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
    }

    // MARK: - Action row labels

    private var documentsSecondary: String? {
        let parts = [documentsDueDateLabel, documentsListSummary]
            .filter { !$0.isEmpty }
        return parts.isEmpty ? nil : parts.joined(separator: " · ")
    }

    private var messagesSecondary: String? {
        let parts = [mostRecentMessageSender, mostRecentMessageRelative]
            .filter { !$0.isEmpty }
        return parts.isEmpty ? nil : parts.joined(separator: " · ")
    }

    // MARK: - Secondary rows + footer

    private var hairline: some View {
        Rectangle()
            .fill(CivicaColors.hairline)
            .frame(height: 1)
            .padding(.vertical, CivicaSpacing.xs)
    }

    private var secondaryRows: some View {
        VStack(alignment: .leading, spacing: 0) {
            NavigationLink {
                FindHelpRootView()
            } label: {
                secondaryRowLabel(
                    icon: "fork.knife",
                    eyebrow: CivicaPhase2Strings.findHelpEyebrow.value(in: language),
                    link: CivicaPhase2Strings.findHelpLink.value(in: language)
                )
            }
            .buttonStyle(.plain)
            Rectangle()
                .fill(CivicaColors.hairline)
                .frame(height: 1)
            Button(action: onOpenExternalPortal) {
                secondaryRowLabel(
                    icon: "bubble.left",
                    eyebrow: CivicaPhase2Strings.navigatorEyebrow.value(in: language),
                    link: CivicaPhase2Strings.navigatorLink.value(in: language)
                )
            }
            .buttonStyle(.plain)
        }
    }

    private func secondaryRowLabel(icon: String, eyebrow: String, link: String) -> some View {
        HStack(spacing: CivicaSpacing.md) {
            Image(systemName: icon)
                .imageScale(.large)
                .font(.body)
                .foregroundStyle(CivicaColors.ink)
                .frame(width: 32, alignment: .leading)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 1) {
                Text(eyebrow)
                    .font(CivicaTypography.footnoteStrong)
                    .foregroundStyle(CivicaColors.graphite)
                Text(link)
                    .font(CivicaTypography.sectionHeader)
                    .foregroundStyle(CivicaColors.ink)
            }
            Spacer(minLength: CivicaSpacing.sm)
            Image(systemName: "chevron.right")
                .foregroundStyle(CivicaColors.graphite)
                .accessibilityHidden(true)
        }
        .padding(.vertical, CivicaSpacing.md)
        .padding(.horizontal, CivicaSpacing.xs)
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(eyebrow). \(link)")
    }

    private var privacyFooterLink: some View {
        NavigationLink {
            SNAPDataPrivacyView(language: language)
        } label: {
            HStack(spacing: CivicaSpacing.sm) {
                Image(systemName: "lock.shield")
                    .foregroundStyle(CivicaColors.graphite)
                    .accessibilityHidden(true)
                Text(CivicaEntryStrings.privacyLink.value(in: language))
                    .font(CivicaTypography.footnoteStrong)
                    .foregroundStyle(CivicaColors.graphite)
                    .underline()
                Text(CivicaEntryStrings.publicBenefitTag.value(in: language))
                    .font(CivicaTypography.footnoteStrong)
                    .foregroundStyle(CivicaColors.graphite.opacity(0.6))
                Spacer(minLength: 0)
            }
            .padding(.vertical, CivicaSpacing.sm)
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Strings

enum CivicaPhase2Strings {
    static let fallbackCounty = CivicaText("your county", es: "tu condado")

    // Status pills
    static let pillSubmitted = CivicaText("Submitted", es: "Enviada")
    static let pillDocumentsRequested = CivicaText("Documents requested", es: "Documentos solicitados")
    static let pillInterviewScheduled = CivicaText("Interview scheduled", es: "Entrevista programada")
    static let pillInterviewCompleted = CivicaText("Interview complete", es: "Entrevista completa")

    static func dayN(count: Int, language: CivicaLanguage) -> String {
        switch language {
        case .english: return "Day \(count) of ~10"
        case .spanish: return "Día \(count) de ~10"
        }
    }

    // Timeline labels
    static let timelineSubmitted = CivicaText("Submitted", es: "Enviada")
    static let timelineInReview  = CivicaText("In review", es: "En revisión")
    static let timelineInterview = CivicaText("Interview", es: "Entrevista")
    static let timelineDecision  = CivicaText("Decision", es: "Decisión")

    // Interview appointment card (IA-1). Label reuses timelineInterview
    // ("Interview" / "Entrevista"). Relative-time phrases below:
    static let appointmentToday    = CivicaText("Today", es: "Hoy")
    static let appointmentTomorrow = CivicaText("Tomorrow", es: "Mañana")
    static func appointmentInDays(days: Int, language: CivicaLanguage) -> String {
        switch language {
        case .english: return "In \(days) days"
        case .spanish: return "En \(days) días"
        }
    }

    // Headline
    static func headline(county: String, language: CivicaLanguage) -> String {
        switch language {
        case .english: return "Your application is with \(county)."
        case .spanish: return "Tu solicitud está con \(county)."
        }
    }

    // What the county is doing now
    static let bodySubmitted = CivicaText(
        "A caseworker is reviewing your documents. If everything's clear, they'll call to schedule a 15-minute interview within the next few days.",
        es: "Un trabajador social está revisando tus documentos. Si todo está claro, te llamarán para programar una entrevista de 15 minutos en los próximos días."
    )
    static let bodyDocumentsRequested = CivicaText(
        "The county needs more documents before they can continue. Upload them so a caseworker can pick the review back up.",
        es: "El condado necesita más documentos antes de continuar. Súbelos para que un trabajador social pueda continuar con la revisión."
    )
    static let bodyInterviewScheduled = CivicaText(
        "Your eligibility interview is on the calendar. A caseworker will call at the scheduled time to verify your application.",
        es: "Tu entrevista de elegibilidad está agendada. Un trabajador social te llamará a la hora programada para verificar tu solicitud."
    )
    static let bodyInterviewCompleted = CivicaText(
        "The interview is done. The county will mail a written decision — usually within 30 days of when you applied.",
        es: "La entrevista está completa. El condado enviará por correo una decisión escrita — usualmente dentro de los 30 días desde que aplicaste."
    )

    // CTA
    static let primaryCTAWhatNext = CivicaText(
        "How to prepare for what's next",
        es: "Cómo prepararte para lo que sigue"
    )
    static let primaryCTAPrepareInterview = CivicaText(
        "Prepare for your interview",
        es: "Prepárate para tu entrevista"
    )

    // Action rows
    // JR-2 (audit 2026-05-29): reframe the headline from a count-led
    // demand ("2 documents requested") to routine-step framing
    // ("A routine step — 2 documents to upload"). A document request
    // mid-review reads as "my case is failing" without normalization;
    // leading with "a routine step" defuses that anxiety spike.
    //
    // The count stays in the headline (the WHAT), and the live
    // due-date + filename summary stays in `documentsSecondary` (the
    // WHEN + WHICH) — see line 374. This deliberately preserves the
    // dynamic secondary the audit's literal sample dropped; the
    // normalization lands in the headline instead so no live data is
    // lost. The em-dash construction mirrors `bodyInterviewCompleted`
    // and carries no second-person pronoun, sidestepping tú/usted.
    static func documentsRequestedHeadline(count: Int, language: CivicaLanguage) -> String {
        switch language {
        case .english:
            return count == 1
                ? "A routine step — 1 document to upload"
                : "A routine step — \(count) documents to upload"
        case .spanish:
            return count == 1
                ? "Un paso de rutina — 1 documento por subir"
                : "Un paso de rutina — \(count) documentos por subir"
        }
    }
    static func unreadMessagesHeadline(count: Int, language: CivicaLanguage) -> String {
        switch language {
        case .english:
            return count == 1 ? "1 new message" : "\(count) new messages"
        case .spanish:
            return count == 1 ? "1 mensaje nuevo" : "\(count) mensajes nuevos"
        }
    }

    // Secondary rows
    static let findHelpEyebrow = CivicaText("Need food while you wait?", es: "¿Necesitas comida mientras esperas?")
    static let findHelpLink    = CivicaText("Find help nearby", es: "Encuentra ayuda cerca")
    // UD-6 (audit 2026-05-29): row link renamed from "Message a navigator"
    // → "Open the state portal". Civica does not yet have a real human-
    // navigator channel wired (per docs/plans/real-navigator-handoff-2026-Q3.md
    // when that plan lands); honest copy describes the actual destination
    // and avoids the trust break that fires the moment the user taps.
    static let navigatorEyebrow = CivicaText("Have a question?", es: "¿Tienes una pregunta?")
    static let navigatorLink    = CivicaText("Open the state portal", es: "Abrir el portal estatal")
}

#if DEBUG
struct CivicaHomePhase2View_Previews: PreviewProvider {
    static var previews: some View {
        let store = SNAPApplicationStatusStore()
        return NavigationStack {
            CivicaHomePhase2View(
                statusStore: store,
                language: .english,
                onOpenExternalPortal: {}
            )
            .environmentObject(CivicaEnrollmentAuth())
        }
    }
}
#endif
