import CivicaDesignSystem
import SwiftUI

// HANDOFF board 24: "the waiting room."
//
// This is the most-abandoned phase, per the design canvas brief:
// the user has submitted to DTA Connect, and now they're stuck
// staring at silence until the state acts. The board prescribes a
// surface that:
//   • Tells them what's happening (not just what they did)
//   • Sets expectations on timing (7–30 days)
//   • Calls out expedited service if they qualify
//   • Surfaces document-upload / interview-prep CTAs the moment
//     the state requests something
//   • Doesn't fake activity ("we're working hard for you!") —
//     the brand voice doc rejects fabricated motion
//
// State transitions in / out of this view happen via the status
// store: WaitingRoomView is mounted while
// status.isPostSubmission is true.

struct SNAPWaitingRoomView: View {
    @ObservedObject var statusStore: SNAPApplicationStatusStore
    let language: CivicaLanguage
    let onAction: () -> Void

    /// Draft loaded from SNAPApplicationDraftStore on appear. Drives the
    /// WIC teaser gate inside SNAPSubmissionTimelineView (children
    /// under 5 → teaser shows). Optional because users who completed
    /// the screener via a path that bypassed the draft store will see
    /// the timeline without the teaser, which is the correct fallback.
    @State private var persistedDraft: SNAPApplicationDraft?

    /// Cached estimator result loaded from SNAPEstimatorResultStore on
    /// appear. Feeds the cost-of-delay countdown card; nil hides it.
    @State private var estimatorResult: SNAPEstimatorResultRecord?

    /// Hidden admin sheet — long-press the version footer to surface
    /// the PIN-gated upcoming-interview CSV export. Used by the
    /// Civica operator (founder) for manual concierge calls.
    @State private var showsAdminExport: Bool = false

    /// External link target (DTA Connect, MA WIC page) presented via
    /// CivicaSafariSheet. The waiting room owns this rather than
    /// pushing it to the root so the submission-timeline footer cards
    /// can route the user directly without bouncing through onAction.
    @State private var externalLink: URL?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: CivicaSpacing.xl) {
                header
                interviewNavigatorSection
                if currentStatusHasAction {
                    actionBanner
                }
                if showsSubmissionTimeline {
                    SNAPSubmissionTimelineView(
                        submittedAt: statusStore.timestamp(for: .submittedToState) ?? Date(),
                        language: language,
                        showsWICTeaser: persistedDraft?.household.hasMinorInHousehold == true,
                        stateCode: persistedDraft?.whereApplying.stateCode,
                        onOpenWICTeaser: {
                            externalLink = CivicaExternalLinks.wicInfoPage(for: persistedDraft?.whereApplying.stateCode)
                        },
                        onContactSupport: {
                            // v1: no in-app support inbox yet. Route
                            // to DTA Connect; v2 wires this to a
                            // Civica-side SMS thread per the brand
                            // voice doc's "real person responds" promise.
                            externalLink = CivicaExternalLinks.applyPortal(for: persistedDraft?.whereApplying.stateCode)
                        }
                    )
                } else {
                    whatsHappeningSection
                }
                timeline
                expeditedNoticeIfApplicable
                findHelpLinks
                versionFooter
            }
            .padding(CivicaSpacing.xl)
        }
        .background(CivicaColors.paper.ignoresSafeArea())
        .navigationTitle("Civica")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            persistedDraft = SNAPApplicationDraftStore().load()?.draft
            estimatorResult = SNAPEstimatorResultStore().load()
        }
        .sheet(item: $externalLink) { url in
            CivicaSafariSheet(url: url)
        }
        .sheet(isPresented: $showsAdminExport) {
            AdminInterviewExportView(language: language) {
                showsAdminExport = false
            }
        }
    }

    /// Tiny "Civica · v1" footer. The long-press gesture opens the
    /// founder-only admin export sheet; the gesture is intentionally
    /// undocumented and not exposed in any visible affordance.
    private var versionFooter: some View {
        Text("Civica · v1")
            .font(CivicaTypography.caption)
            .foregroundStyle(CivicaColors.muted)
            .frame(maxWidth: .infinity)
            .padding(.top, CivicaSpacing.lg)
            .contentShape(Rectangle())
            .onLongPressGesture(minimumDuration: 2.0) {
                showsAdminExport = true
            }
            .accessibilityHidden(true)
    }

    /// Render the dedicated "your application is in" timeline only on
    /// the first beat — status exactly .submittedToState with no state
    /// action yet. Once DTA asks for documents or schedules an
    /// interview, the action banner + standard whatsHappeningSection
    /// take over so the user isn't staring at a stale congratulations.
    private var showsSubmissionTimeline: Bool {
        statusStore.status == .submittedToState && !currentStatusHasAction
    }

    // MARK: - Sections

    private var header: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
            Text(SNAPStatusHomeStrings.waitingTitle.value(in: language))
                .font(CivicaTypography.pageTitle)
                .foregroundStyle(CivicaColors.ink)
        }
    }

    private var whatsHappeningSection: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
            Text(SNAPStatusHomeStrings.waitingBody(
                stateCode: persistedDraft?.whereApplying.stateCode,
                language: language
            ))
                .font(CivicaTypography.body)
                .foregroundStyle(CivicaColors.ink)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(CivicaSpacing.lg)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(CivicaColors.surfacePrimary)
        .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card))
        .overlay(
            RoundedRectangle(cornerRadius: CivicaRadius.card)
                .strokeBorder(CivicaColors.hairline, lineWidth: 1)
        )
    }

    @ViewBuilder
    private var interviewNavigatorSection: some View {
        if statusStore.status == .interviewScheduled {
            if let interviewDate = statusStore.interviewScheduledFor {
                if let estimatorResult {
                    InterviewCountdownCard(
                        interviewDate: interviewDate,
                        monthlyBenefit: estimatorResult.monthlyBenefit,
                        language: language
                    )
                }
            } else {
                InterviewDateCaptureCard(language: language) { newDate in
                    statusStore.setInterviewDate(newDate)
                    SNAPAnalytics.trackInterviewDateSet()
                }
            }
        }
    }

    @ViewBuilder
    private var actionBanner: some View {
        // Interview-scheduled status pushes the in-app coach instead
        // of opening the DTA Connect portal — coaching the user
        // through a 15-20 minute phone call is the highest-leverage
        // thing Civica can do post-submission.
        if statusStore.status == .interviewScheduled {
            NavigationLink {
                SNAPInterviewCoachView(
                    language: language,
                    interviewDate: statusStore.interviewScheduledFor,
                    onDismiss: {}
                )
            } label: {
                actionBannerLabel
            }
            .buttonStyle(.plain)
        } else {
            Button(action: onAction) {
                actionBannerLabel
            }
        }
    }

    private var actionBannerLabel: some View {
        HStack(spacing: CivicaSpacing.md) {
            Image(systemName: "exclamationmark.circle.fill")
                .foregroundStyle(CivicaColors.warningAmber)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 2) {
                Text(SNAPStatusHomeStrings.statusActionNeeded.value(in: language))
                    .font(CivicaTypography.captionStrong)
                    .foregroundStyle(CivicaColors.warningAmber)
                    .textCase(.uppercase)
                    .kerning(1.2)
                Text(actionTitle)
                    .font(CivicaTypography.subheadStrong)
                    .foregroundStyle(CivicaColors.ink)
            }
            Spacer()
            Image(systemName: "chevron.right")
                .foregroundStyle(CivicaColors.graphite)
        }
        .padding(CivicaSpacing.md)
        .background(CivicaColors.warningAmber.opacity(0.12))
        .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card))
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(SNAPStatusHomeStrings.statusActionNeeded.value(in: language)). \(actionTitle)")
    }

    private var timeline: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.md) {
            Text(timelineSectionTitle)
                .font(CivicaTypography.sectionHeader)
                .foregroundStyle(CivicaColors.ink)
            CivicaStatusTimeline(
                steps: SNAPStatusTimelineBuilder.steps(
                    for: statusStore.status,
                    milestones: statusStore.milestones,
                    language: language,
                    stateCode: persistedDraft?.whereApplying.stateCode
                )
            )
        }
    }

    @ViewBuilder
    private var expeditedNoticeIfApplicable: some View {
        SNAPExpeditedBanner(
            result: triageResult,
            draft: persistedDraft,
            language: language
        )
    }

    // MARK: - Status-driven copy

    private var timelineSectionTitle: String {
        switch language {
        case .english: return "Your application"
        case .spanish: return "Tu solicitud"
        }
    }

    private var currentStatusHasAction: Bool {
        switch statusStore.status {
        case .documentsRequested, .interviewScheduled, .recertDue:
            return true
        default:
            return false
        }
    }

    private var actionTitle: String {
        switch statusStore.status {
        case .documentsRequested:
            return SNAPStatusHomeStrings.actionUploadRequested.value(in: language)
        case .interviewScheduled:
            return SNAPStatusHomeStrings.actionPrepareInterview.value(in: language)
        case .recertDue:
            return SNAPStatusHomeStrings.actionRecert.value(in: language)
        default:
            return SNAPStatusHomeStrings.waitingTitle.value(in: language)
        }
    }

    // The waiting room is reached after the screener and orchestrator
    // are gone — there's no live @Published triageResult to subscribe
    // to. We evaluate from the loaded persistedDraft @State each
    // render. The heuristic is sync-fast; this is cheap.
    private var triageResult: ExpeditedTriageResult? {
        guard let draft = persistedDraft else { return nil }
        return evaluateTriageSynchronously(draft: draft)
    }

    // MARK: - FindHelp links

    /// Two map deep-links: food assistance for the immediate-need moment
    /// (every waiting-room user qualifies, regardless of state status),
    /// and SNAP application help when the state has asked for action
    /// (documents requested / interview scheduled). The "get help"
    /// affordance is gated on action-required states so users with a
    /// quiet waiting room aren't pushed toward a navigator they don't
    /// need yet.
    private var findHelpLinks: some View {
        VStack(spacing: CivicaSpacing.md) {
            NavigationLink {
                FindHelpRootView(
                    initialFilter: FindHelpFilterState(
                        serviceType: .foodAssistance,
                        languageCode: nil
                    )
                )
            } label: {
                findHelpCard(
                    icon: "fork.knife",
                    title: SNAPStatusHomeStrings.findHelpFoodLinkTitle.value(in: language),
                    body: SNAPStatusHomeStrings.findHelpFoodLinkSubtitle.value(in: language),
                    accent: CivicaColors.accentTeal
                )
            }
            .buttonStyle(.plain)

            if currentStatusHasAction {
                NavigationLink {
                    FindHelpRootView(
                        initialFilter: FindHelpFilterState(
                            serviceType: .snapApplicationHelp,
                            languageCode: nil
                        )
                    )
                } label: {
                    findHelpCard(
                        icon: "person.2.fill",
                        title: SNAPStatusHomeStrings.findHelpApplicationLinkTitle.value(in: language),
                        body: SNAPStatusHomeStrings.findHelpApplicationLinkSubtitle.value(in: language),
                        accent: CivicaColors.brickPrimary
                    )
                }
                .buttonStyle(.plain)
            }
        }
    }

    private func findHelpCard(icon: String, title: String, body: String, accent: Color) -> some View {
        HStack(alignment: .top, spacing: CivicaSpacing.md) {
            Image(systemName: icon)
                .font(.system(size: 20, weight: .semibold))
                .foregroundStyle(accent)
                .frame(width: 28, alignment: .leading)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
                Text(title)
                    .font(CivicaTypography.subheadStrong)
                    .foregroundStyle(CivicaColors.ink)
                Text(body)
                    .font(CivicaTypography.footnote)
                    .foregroundStyle(CivicaColors.graphite)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: CivicaSpacing.sm)
            Image(systemName: "chevron.right")
                .foregroundStyle(CivicaColors.graphite)
                .accessibilityHidden(true)
        }
        .padding(CivicaSpacing.lg)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(CivicaColors.surfacePrimary)
        .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card))
        .overlay(
            RoundedRectangle(cornerRadius: CivicaRadius.card)
                .strokeBorder(CivicaColors.hairline, lineWidth: 1)
        )
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(title). \(body)")
    }
}

#if DEBUG
struct SNAPWaitingRoomView_Previews: PreviewProvider {
    static var previews: some View {
        let store = SNAPApplicationStatusStore()
        store.advance(to: .submittedToState)
        return NavigationStack {
            SNAPWaitingRoomView(
                statusStore: store,
                language: .english,
                onAction: {}
            )
        }
    }
}
#endif
