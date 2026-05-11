import CivicaDesignSystem
import SwiftUI

// HANDOFF board 12: returning user home.
//
// What the user sees when they reopen Civica with an in-progress
// SNAP application. The previous SNAPEntryView (a single "Apply for
// SNAP" tile) is the surface for first-time users. This view is for
// the second-or-later launch, where their session already has state
// the user needs to resume from.
//
// The view stays compact: a status banner, the timeline, and a
// single primary action. Less is more here — the user came back to
// move forward, not to browse.

struct SNAPReturningUserHomeView: View {
    @ObservedObject var statusStore: SNAPApplicationStatusStore
    let language: CivicaLanguage
    let onResume: () -> Void
    let onStartOver: () -> Void

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: CivicaSpacing.xl) {
                header
                statusBanner
                timeline
                primaryActionRow
                startOverLink
            }
            .padding(CivicaSpacing.xl)
        }
        .background(CivicaColors.paper.ignoresSafeArea())
        .navigationTitle("Civica")
        .navigationBarTitleDisplayMode(.inline)
    }

    // MARK: - Sections

    private var header: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
            Text(SNAPStatusHomeStrings.returningWelcome.value(in: language))
                .font(CivicaTypography.pageTitle)
                .foregroundStyle(CivicaColors.ink)
            Text(SNAPStatusHomeStrings.returningSubtitle.value(in: language))
                .font(CivicaTypography.body)
                .foregroundStyle(CivicaColors.graphite)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private var statusBanner: some View {
        HStack(spacing: CivicaSpacing.sm) {
            Image(systemName: statusIcon)
                .foregroundStyle(statusAccent)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 2) {
                Text(statusBannerTitle)
                    .font(CivicaTypography.subheadStrong)
                    .foregroundStyle(CivicaColors.ink)
                Text(statusBannerDetail)
                    .font(CivicaTypography.footnote)
                    .foregroundStyle(CivicaColors.graphite)
            }
            Spacer()
        }
        .padding(CivicaSpacing.md)
        .background(statusAccent.opacity(0.13))
        .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card))
    }

    private var timeline: some View {
        CivicaStatusTimeline(steps: SNAPStatusTimelineBuilder.steps(
            for: statusStore.status,
            milestones: statusStore.milestones,
            language: language
        ))
    }

    private var primaryActionRow: some View {
        CivicaPrimaryButton(primaryActionTitle, action: onResume)
    }

    private var startOverLink: some View {
        Button(action: onStartOver) {
            Text(SNAPStatusHomeStrings.returningStartOver.value(in: language))
                .font(CivicaTypography.footnote)
                .foregroundStyle(CivicaColors.graphite)
                .underline()
        }
        .frame(maxWidth: .infinity)
    }

    // MARK: - Status-specific copy

    private var statusBannerTitle: String {
        switch statusStore.status {
        case .screenerInProgress, .notStarted:
            return SNAPStatusHomeStrings.statusInProgress.value(in: language)
        case .screenerComplete, .packetGenerated, .documentsRequested:
            return SNAPStatusHomeStrings.statusActionNeeded.value(in: language)
        case .submittedToState, .interviewScheduled, .interviewCompleted:
            return SNAPStatusHomeStrings.statusWaiting.value(in: language)
        case .decisionApproved, .decisionDenied:
            return SNAPStatusHomeStrings.statusComplete.value(in: language)
        case .recertDue:
            return SNAPStatusHomeStrings.statusActionNeeded.value(in: language)
        }
    }

    private var statusBannerDetail: String {
        primaryActionTitle
    }

    private var primaryActionTitle: String {
        switch statusStore.status {
        case .notStarted, .screenerInProgress:
            return SNAPStatusHomeStrings.returningResume.value(in: language)
        case .screenerComplete:
            return SNAPStatusHomeStrings.actionGeneratePacket.value(in: language)
        case .packetGenerated:
            return SNAPStatusHomeStrings.actionSubmitToState.value(in: language)
        case .submittedToState, .interviewScheduled, .interviewCompleted:
            return SNAPStatusHomeStrings.waitingTitle.value(in: language)
        case .documentsRequested:
            return SNAPStatusHomeStrings.actionUploadRequested.value(in: language)
        case .decisionApproved, .decisionDenied:
            return SNAPStatusHomeStrings.actionViewDecision.value(in: language)
        case .recertDue:
            return SNAPStatusHomeStrings.actionRecert.value(in: language)
        }
    }

    private var statusIcon: String {
        switch statusStore.status {
        case .notStarted, .screenerInProgress: return "arrow.right.circle.fill"
        case .screenerComplete, .packetGenerated: return "tray.and.arrow.up.fill"
        case .documentsRequested, .recertDue: return "exclamationmark.circle.fill"
        case .submittedToState, .interviewScheduled, .interviewCompleted: return "clock.fill"
        case .decisionApproved: return "checkmark.seal.fill"
        case .decisionDenied: return "info.circle.fill"
        }
    }

    private var statusAccent: Color {
        switch statusStore.status {
        case .documentsRequested, .recertDue: return CivicaColors.warningAmber
        case .decisionApproved: return CivicaColors.accentTeal
        case .decisionDenied: return CivicaColors.destructive
        case .submittedToState, .interviewScheduled, .interviewCompleted: return CivicaColors.brickPrimary
        default: return CivicaColors.brickPrimary
        }
    }
}

#if DEBUG
struct SNAPReturningUserHomeView_Previews: PreviewProvider {
    static var previews: some View {
        let store = SNAPApplicationStatusStore()
        store.advance(to: .packetGenerated)
        return NavigationStack {
            SNAPReturningUserHomeView(
                statusStore: store,
                language: .english,
                onResume: {},
                onStartOver: {}
            )
        }
    }
}
#endif
