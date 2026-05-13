import CivicaDesignSystem
import SwiftUI

private let dtaConnectURL = URL(string: "https://dtaconnect.eohhs.mass.gov")!

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

    @Environment(\.openURL) private var openURL
    @State private var showSubmitConfirmation = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: CivicaSpacing.xl) {
                header
                statusBanner
                if let result = statusStore.eligibilityResult {
                    verdictCard(result)
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
        .confirmationDialog(
            SNAPReturningHomeStrings.confirmSubmitTitle.value(in: language),
            isPresented: $showSubmitConfirmation,
            titleVisibility: .visible
        ) {
            Button(SNAPReturningHomeStrings.confirmSubmitButton.value(in: language)) {
                statusStore.advance(to: .submittedToState)
            }
            Button(SNAPReturningHomeStrings.confirmSubmitCancel.value(in: language), role: .cancel) {}
        } message: {
            Text(SNAPReturningHomeStrings.confirmSubmitBody.value(in: language))
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
                    .font(.system(size: 20, weight: .semibold))
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
        case .eligible, .eligibleWithConditions: return CivicaColors.accentTeal
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

    @ViewBuilder
    private var primaryActionRow: some View {
        if statusStore.status == .packetGenerated {
            packetGeneratedActions
        } else {
            CivicaPrimaryButton(primaryActionTitle, action: onResume)
        }
    }

    @ViewBuilder
    private var packetGeneratedActions: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
            if let opened = statusStore.dtaConnectOpenedAt {
                Text(SNAPReturningHomeStrings.dtaOpenedNote.value(in: language) + " " + opened.formatted(.dateTime.month(.wide).day()))
                    .font(CivicaTypography.footnote)
                    .foregroundStyle(CivicaColors.graphite)
                    .fixedSize(horizontal: false, vertical: true)
                CivicaPrimaryButton(SNAPReturningHomeStrings.actionMarkSubmitted.value(in: language)) {
                    showSubmitConfirmation = true
                }
                Button(SNAPReturningHomeStrings.actionReviewPacket.value(in: language), action: onResume)
                    .font(CivicaTypography.subhead)
                    .foregroundStyle(CivicaColors.brickPrimary)
                    .frame(maxWidth: .infinity)
            } else {
                CivicaPrimaryButton(SNAPReturningHomeStrings.actionOpenDTAConnect.value(in: language)) {
                    openURL(dtaConnectURL)
                    statusStore.recordDTAConnectOpened()
                }
                Button(SNAPReturningHomeStrings.actionReviewPacket.value(in: language), action: onResume)
                    .font(CivicaTypography.subhead)
                    .foregroundStyle(CivicaColors.brickPrimary)
                    .frame(maxWidth: .infinity)
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
    }

    // MARK: - Status-specific copy

    private var statusBannerTitle: String {
        switch statusStore.status {
        case .screenerInProgress, .notStarted:
            return SNAPStatusHomeStrings.statusInProgress.value(in: language)
        case .screenerComplete, .documentsRequested:
            return SNAPStatusHomeStrings.statusActionNeeded.value(in: language)
        case .packetGenerated:
            return statusStore.dtaConnectOpenedAt != nil
                ? SNAPReturningHomeStrings.dtaOpenedBannerTitle.value(in: language)
                : SNAPStatusHomeStrings.statusActionNeeded.value(in: language)
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
        case .decisionApproved: return CivicaColors.accentTeal
        case .decisionDenied: return CivicaColors.destructive
        case .submittedToState, .interviewScheduled, .interviewCompleted: return CivicaColors.brickPrimary
        default: return CivicaColors.brickPrimary
        }
    }
}

// Strings live next to the view they drive. EN/ES parity per
// HANDOFF #4. Decoupled from SNAPStatusHomeStrings so adding a
// new verdict copy here doesn't dredge through the bigger file.
enum SNAPReturningHomeStrings {
    static let verdictCardEyebrow = CivicaText(
        "Your previous result",
        es: "Tu resultado anterior"
    )
    static let verdictCardEligible = CivicaText(
        "You may be eligible. See the math.",
        es: "Es posible que seas elegible. Ver el cálculo."
    )
    static let verdictCardIneligible = CivicaText(
        "Last time you appeared not to qualify. See why.",
        es: "La última vez parecía que no calificabas. Ver por qué."
    )
    static let verdictCardNeedMore = CivicaText(
        "We needed more info last time. See what's missing.",
        es: "Necesitábamos más información la última vez. Ver qué falta."
    )

    // MARK: - Packet → submission bridge

    static let actionOpenDTAConnect = CivicaText(
        "Open DTA Connect to submit",
        es: "Abrir DTA Connect para enviar"
    )
    static let actionReviewPacket = CivicaText(
        "Review my packet first",
        es: "Revisar mi paquete primero"
    )
    static let dtaOpenedBannerTitle = CivicaText(
        "DTA Connect opened",
        es: "DTA Connect abierto"
    )
    static let dtaOpenedNote = CivicaText(
        "You opened DTA Connect on",
        es: "Abriste DTA Connect el"
    )
    static let actionMarkSubmitted = CivicaText(
        "I submitted — mark as done",
        es: "Envié — marcar como listo"
    )
    static let confirmSubmitTitle = CivicaText(
        "Mark as submitted?",
        es: "¿Marcar como enviado?"
    )
    static let confirmSubmitBody = CivicaText(
        "You're telling Civica you completed your submission on DTA Connect. Civica doesn't receive or verify submissions directly — this just moves your status forward.",
        es: "Le estás diciendo a Civica que completaste tu envío en DTA Connect. Civica no recibe ni verifica envíos directamente — esto solo avanza tu estado."
    )
    static let confirmSubmitButton = CivicaText(
        "Yes, I submitted",
        es: "Sí, lo envié"
    )
    static let confirmSubmitCancel = CivicaText(
        "Not yet",
        es: "Todavía no"
    )
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
