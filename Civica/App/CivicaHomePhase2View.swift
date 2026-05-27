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

    private var pendingDocumentCount: Int {
        pendingDocumentCountOverride ?? inboxStore.unresolvedCount
    }
    private var documentsDueDateLabel: String {
        documentsDueDateLabelOverride ?? inboxStore.relativeDueLabel(in: language)
    }
    private var documentsListSummary: String {
        documentsListSummaryOverride ?? inboxStore.summary(in: language)
    }

    // Messages-inbox slot — intentionally NOT bound in this PR. The
    // gateway today stores doc requests + free-form navigator prompts
    // in one `missing_item_requests` stream (read via /me/inbox); that
    // stream is already surfaced above as the documents-requested row.
    // A distinct applicant-facing messages channel (1:1 conversations,
    // unread state, separate model, separate endpoint) doesn't exist
    // yet. When it does, add a `SNAPMessagesInboxStore` and bind these
    // slots the same way the error-risk + documents-requested rows
    // are bound.
    var unreadMessageCount: Int = 0
    var mostRecentMessageSender: String = ""
    var mostRecentMessageRelative: String = ""

    @State private var presentingWhatHappensNext: Bool = false

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

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: CivicaSpacing.lg) {
                phaseTab

                statusPill
                headline
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

                if showErrorRisk {
                    errorRiskRow
                }

                if pendingDocumentCount > 0 {
                    CivicaActionRow(
                        icon: "doc.text",
                        primary: CivicaPhase2Strings
                            .documentsRequestedHeadline(count: pendingDocumentCount, language: language),
                        secondary: documentsSecondary,
                        action: onOpenExternalPortal
                    )
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
            guard enrollmentAuth.state.isAuthenticated else { return }
            let client = enrollmentAuth.makeEnrollmentAPIClient()
            errorRiskStore.bind(client: client)
            inboxStore.bind(client: client)
            async let errorRisk: Void = errorRiskStore.load()
            async let inbox: Void = inboxStore.load()
            _ = await (errorRisk, inbox)
        }
    }

    // MARK: - Phase tab

    /// Production: locked journey indicator (.enroll ✓ + .pending
    /// current + .enrolled locked). DEBUG with an injected change
    /// handler: free toggle for engineers / QA.
    @ViewBuilder
    private var phaseTab: some View {
        #if DEBUG
        if let onDebugPhaseChange {
            CivicaPhaseTab(current: .pending, onChange: onDebugPhaseChange)
        } else {
            CivicaPhaseTab(lockedJourneyAt: .pending)
        }
        #else
        CivicaPhaseTab(lockedJourneyAt: .pending)
        #endif
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

    private var primaryCTA: some View {
        Button {
            presentingWhatHappensNext = true
        } label: {
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
        .buttonStyle(.plain)
        .accessibilityLabel(primaryCTAText)
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
                    .font(.system(size: 17))
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
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(CivicaColors.graphite)
                    .accessibilityHidden(true)
                    .padding(.top, 4)
            }
            .padding(.vertical, CivicaSpacing.md)
            .padding(.horizontal, CivicaSpacing.md)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(CivicaColors.statusWarningSurface)
            .overlay(alignment: .leading) {
                Rectangle()
                    .fill(CivicaColors.warningAmber)
                    .frame(width: 3)
            }
            .overlay(
                Rectangle()
                    .stroke(CivicaColors.warningAmber.opacity(0.22), lineWidth: 1)
            )
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
                .font(.system(size: 22))
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
    static func documentsRequestedHeadline(count: Int, language: CivicaLanguage) -> String {
        switch language {
        case .english:
            return count == 1 ? "1 document requested" : "\(count) documents requested"
        case .spanish:
            return count == 1 ? "1 documento solicitado" : "\(count) documentos solicitados"
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
    static let navigatorEyebrow = CivicaText("Have a question?", es: "¿Tienes una pregunta?")
    static let navigatorLink    = CivicaText("Message a navigator", es: "Mensajea un asesor")
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
