import CivicaDesignSystem
import OSLog
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
    let onReRunScreener: () -> Void
    let onStartOver: () -> Void

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: CivicaSpacing.xl) {
                header
                statusBanner
                if let result = statusStore.eligibilityResult {
                    verdictCard(result)
                } else if SNAPReturningUserHomeView.shouldShowFallbackCard(
                    status: statusStore.status,
                    eligibilityResult: nil
                ) {
                    fallbackCard
                }
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

    // MARK: - Fallback card (IA-6)

    /// True when the view is reached but eligibilityResult is nil — i.e.
    /// the keychain payload was lost across a crash or version upgrade.
    /// Drives the quiet recovery card so returning users always have a
    /// forward path, not a silent omission.
    static func shouldShowFallbackCard(
        status: SNAPApplicationStatus,
        eligibilityResult: SNAPEligibilityResult?
    ) -> Bool {
        guard eligibilityResult == nil else { return false }
        return status.isActiveCase
    }

    private var fallbackCard: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.md) {
            Text(SNAPReturningHomeStrings.fallbackHeadline.value(in: language))
                .font(CivicaTypography.body)
                .foregroundStyle(CivicaColors.ink)
                .fixedSize(horizontal: false, vertical: true)
            VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
                Button { onReRunScreener() } label: {
                    Text(SNAPReturningHomeStrings.fallbackReRunAction.value(in: language))
                        .font(CivicaTypography.footnote)
                        .foregroundStyle(CivicaColors.pinePrimary)
                }
                Button { onResume() } label: {
                    Text(SNAPReturningHomeStrings.fallbackSkipAction.value(in: language))
                        .font(CivicaTypography.footnote)
                        .foregroundStyle(CivicaColors.graphite)
                }
            }
        }
        .padding(CivicaSpacing.lg)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(CivicaColors.surfaceSecondary)
        .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.card))
        .onAppear {
            SNAPReturningHomeTelemetry.trackFallbackCardShown(status: statusStore.status)
        }
    }

    /// "Your previous result" card — only renders when the orchestrator
    /// has recorded a verdict via statusStore.recordEligibilityResult.
    /// Tapping pushes SNAPDecisionMathView with the saved result so the
    /// user can re-see the same math without re-walking the orchestrator.
    private func verdictCard(_ result: SNAPEligibilityResult) -> some View {
        NavigationLink {
            SNAPDecisionMathView(result: result, language: language)
        } label: {
            HStack(alignment: .top, spacing: CivicaSpacing.md) {
                Image(systemName: verdictIcon(for: result.status))
                    .imageScale(.large)
                    .font(.body)
                    .foregroundStyle(verdictAccent(for: result.status))
                    .frame(width: 28, alignment: .leading)
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
                    Text(SNAPReturningHomeStrings.verdictCardEyebrow.value(in: language))
                        .font(CivicaTypography.captionStrong)
                        .foregroundStyle(CivicaColors.graphite)
                        .textCase(.uppercase)
                        .kerning(1.2)
                    Text(verdictCardTitle(for: result.status))
                        .font(CivicaTypography.subheadStrong)
                        .foregroundStyle(CivicaColors.ink)
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
        }
        .buttonStyle(.plain)
        .accessibilityLabel(verdictCardTitle(for: result.status))
    }

    private func verdictIcon(for status: SNAPEligibilityStatus) -> String {
        switch status {
        case .eligible, .eligibleWithConditions: return "checkmark.seal.fill"
        case .ineligible:                        return "info.circle.fill"
        case .insufficientInformation:           return "questionmark.circle.fill"
        }
    }

    private func verdictAccent(for status: SNAPEligibilityStatus) -> Color {
        switch status {
        case .eligible, .eligibleWithConditions: return CivicaColors.amberPrimary
        case .ineligible:                        return CivicaColors.destructive
        case .insufficientInformation:           return CivicaColors.warningAmber
        }
    }

    private func verdictCardTitle(for status: SNAPEligibilityStatus) -> String {
        switch status {
        case .eligible, .eligibleWithConditions:
            return SNAPReturningHomeStrings.verdictCardEligible.value(in: language)
        case .ineligible:
            return SNAPReturningHomeStrings.verdictCardIneligible.value(in: language)
        case .insufficientInformation:
            return SNAPReturningHomeStrings.verdictCardNeedMore.value(in: language)
        }
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
            language: language,
            stateCode: SNAPApplicationDraftStore().load()?.draft.whereApplying.stateCode
        ))
    }

    private var primaryActionRow: some View {
        VStack(spacing: CivicaSpacing.sm) {
            CivicaPrimaryButton(primaryActionTitle, action: onResume)
            let previewLine = SNAPReturningHomeStrings.ctaPreviewLine(
                status: statusStore.status,
                persistedState: SNAPApplicationDraftStore().load(),
                language: language
            )
            if !previewLine.isEmpty {
                Text(previewLine)
                    .font(CivicaTypography.footnote)
                    .foregroundStyle(CivicaColors.graphite)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    private var startOverLink: some View {
        Button(action: onStartOver) {
            Text(SNAPStatusHomeStrings.returningStartOver.value(in: language))
                .font(CivicaTypography.footnote)
                .foregroundStyle(CivicaColors.graphite)
                .underline()
        }
        .frame(maxWidth: .infinity)
        .accessibilityLabel(SNAPStatusHomeStrings.returningStartOver.value(in: language))
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
            return SNAPStatusHomeStrings.actionSubmitToState(
                stateCode: SNAPApplicationDraftStore().load()?.draft.whereApplying.stateCode,
                language: language
            )
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
        case .decisionApproved: return CivicaColors.amberPrimary
        case .decisionDenied: return CivicaColors.destructive
        case .submittedToState, .interviewScheduled, .interviewCompleted: return CivicaColors.pinePrimary
        default: return CivicaColors.pinePrimary
        }
    }
}

// Strings live next to the view they drive. EN/ES parity per
// HANDOFF #4. Decoupled from SNAPStatusHomeStrings so adding a
// new verdict copy here doesn't dredge through the bigger file.
enum SNAPReturningHomeStrings {
    static let verdictCardEyebrow = CivicaText(
        "Your previous result",
        es: "Tu resultado anterior",
        vi: "Kết quả trước đó của bạn",
        tl: "Ang iyong nakaraang resulta"
    )
    static let verdictCardEligible = CivicaText(
        "You looked likely eligible. See the math.",
        es: "Parecías probablemente elegible. Ver el cálculo.",
        vi: "Bạn có vẻ đủ điều kiện. Xem cách tính.",
        tl: "Mukhang malamang na kuwalipikado ka. Tingnan ang kuwenta."
    )
    static let verdictCardIneligible = CivicaText(
        "Last time you appeared not to qualify. See why.",
        es: "La última vez parecía que no calificabas. Ver por qué.",
        vi: "Lần trước bạn có vẻ không đủ điều kiện. Xem lý do.",
        tl: "Noong huli, mukhang hindi ka kuwalipikado. Tingnan kung bakit."
    )
    static let verdictCardNeedMore = CivicaText(
        "We needed more info last time. See what's missing.",
        es: "Necesitábamos más información la última vez. Ver qué falta.",
        vi: "Lần trước chúng tôi cần thêm thông tin. Xem còn thiếu gì.",
        tl: "Kailangan namin ng karagdagang impormasyon noong huli. Tingnan kung ano ang kulang."
    )

    /// JR-6 (iOS audit 2026-05-29): destination-preview line under the
    /// returning-user primary CTA. Removes the "where will this take me"
    /// cognitive cost. Pure function so unit tests can exercise every
    /// status branch without touching UserDefaults.
    static func ctaPreviewLine(
        status: SNAPApplicationStatus,
        persistedState: SNAPApplicationDraftStore.PersistedState?,
        language: CivicaLanguage
    ) -> String {
        switch status {
        case .screenerInProgress:
            let section = persistedState?.sequentialSection ?? .whereApplying
            return previewStepLine(section: section, language: language)
        case .screenerComplete:
            return SNAPStatusHomeStrings.actionGeneratePacket.value(in: language)
        case .packetGenerated:
            return SNAPStatusHomeStrings.actionSubmitToState(
                stateCode: persistedState?.draft.whereApplying.stateCode,
                language: language
            )
        case .documentsRequested:
            return SNAPStatusHomeStrings.actionUploadRequested.value(in: language)
        case .notStarted, .submittedToState, .interviewScheduled,
             .interviewCompleted, .decisionApproved, .decisionDenied, .recertDue:
            return ""
        }
    }

    private static func previewStepLine(
        section: SNAPApplicationSection,
        language: CivicaLanguage
    ) -> String {
        let step = section.oneBasedIndex
        let total = SNAPApplicationSection.count
        let name = section.title(in: language)
        switch language {
        case .english, .mandarin: return "Step \(step) of \(total) \u{00B7} \(name)"
        case .spanish: return "Paso \(step) de \(total) \u{00B7} \(name)"
        case .vietnamese: return "Bước \(step) / \(total) \u{00B7} \(name)"
        case .tagalog: return "Hakbang \(step) ng \(total) \u{00B7} \(name)"
        }
    }

    // IA-6: fallback card copy when eligibilityResult is nil.
    static let fallbackHeadline = CivicaText(
        "We couldn't pull up your screener result.",
        es: "No pudimos encontrar tu resultado de la evaluación.",
        vi: "Chúng tôi không tìm được kết quả sàng lọc của bạn.",
        tl: "Hindi namin makita ang resulta ng iyong screener."
    )
    static let fallbackReRunAction = CivicaText(
        "Re-run the screener (2 min)",
        es: "Repetir la evaluación (2 min)",
        vi: "Làm lại sàng lọc (2 phút)",
        tl: "Ulitin ang screener (2 minuto)"
    )
    static let fallbackSkipAction = CivicaText(
        "Skip and continue",
        es: "Omitir y continuar",
        vi: "Bỏ qua và tiếp tục",
        tl: "Laktawan at magpatuloy"
    )
}

private enum SNAPReturningHomeTelemetry {
    private static let logger = Logger(subsystem: "Civica", category: "SNAPReturningUserHome")

    /// Logged on first render of the fallback card — fires when
    /// eligibilityResult is nil on an active-case status. Rate of this
    /// event in production measures how often keychain loss occurs post-
    /// migration.
    static func trackFallbackCardShown(status: SNAPApplicationStatus) {
        logger.info(
            "snap.returning_home.fallback_card_shown status=\(status.rawValue, privacy: .public)"
        )
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
                onReRunScreener: {},
                onStartOver: {}
            )
        }
    }
}
#endif
