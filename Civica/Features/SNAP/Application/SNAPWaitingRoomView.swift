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

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: CivicaSpacing.xl) {
                header
                if currentStatusHasAction {
                    actionBanner
                }
                whatsHappeningSection
                timeline
                expeditedNoticeIfApplicable
                findHelpLinks
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
            Text(SNAPStatusHomeStrings.waitingTitle.value(in: language))
                .font(CivicaTypography.pageTitle)
                .foregroundStyle(CivicaColors.ink)
        }
    }

    private var whatsHappeningSection: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
            Text(SNAPStatusHomeStrings.waitingBody.value(in: language))
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

    private var actionBanner: some View {
        Button(action: onAction) {
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
        }
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
                    language: language
                )
            )
        }
    }

    @ViewBuilder
    private var expeditedNoticeIfApplicable: some View {
        if isExpeditedCandidate {
            HStack(alignment: .top, spacing: CivicaSpacing.sm) {
                Image(systemName: "bolt.fill")
                    .foregroundStyle(CivicaColors.brickPrimary)
                Text(SNAPStatusHomeStrings.waitingExpedited.value(in: language))
                    .font(CivicaTypography.footnote)
                    .foregroundStyle(CivicaColors.ink)
            }
            .padding(CivicaSpacing.md)
            .background(CivicaColors.brickSurface)
            .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card))
        }
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

    // Phase E.5 hook — when we link confirmed eligibility result into the
    // status store, we can read expedited_eligible off it here. For v1
    // the placeholder is false (no signal yet); when wired the timeline
    // also shows the expedited badge inline on the relevant step.
    private var isExpeditedCandidate: Bool {
        false
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
