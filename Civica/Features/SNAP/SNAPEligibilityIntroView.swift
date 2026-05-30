import CivicaDesignSystem
import SwiftUI

// EXPERIMENTAL SILOED MODULE: eligibility intro screen with mock, non-sensitive inputs.
struct SNAPEligibilityIntroView: View {
    @Environment(\.dismiss) private var dismiss
    @ObservedObject var viewModel: SNAPApplicationViewModel
    @State private var continueToGuidedDraft = false
    @State private var generatedFromOrchestrator: SNAPApplicationDraft?
    @State private var orchestratorVerdict: SNAPEligibilityResult?
    @State private var presentingVerdict: Bool = false
    @State private var presentingPacket: Bool = false
    /// Shared status store — injected from CivicaRootView's
    /// NavigationStack via .environmentObject so a single instance
    /// drives both the orchestrator's recordEligibilityResult call
    /// and the root view's status-based routing.
    @EnvironmentObject private var statusStore: SNAPApplicationStatusStore

    @AppStorage(CivicaLanguage.defaultStorageKey)
    private var languageRaw: String = CivicaLanguage.english.rawValue

    private var language: CivicaLanguage {
        CivicaLanguage(rawValue: languageRaw) ?? .english
    }

    var body: some View {
        ZStack {
            CivicaColors.paper.ignoresSafeArea()

            ScrollView {
                VStack(alignment: .leading, spacing: CivicaSpacing.md) {
                    VStack(alignment: .leading, spacing: CivicaSpacing.md) {
                        SNAPIntroHeader(title: SNAPEligibilityIntroStrings.whatIsSNAP.value(in: language))

                    Text(SNAPEligibilityIntroStrings.snapDescription.value(in: language))
                        .font(CivicaTypography.bodyStrong)
                        .foregroundStyle(CivicaColors.ink)
                        .fixedSize(horizontal: false, vertical: true)

                    Text(SNAPIntroCopy.approvalHeading(stateCode: viewModel.application.state, language: language))
                        .font(CivicaTypography.subheadStrong)
                        .foregroundStyle(CivicaColors.ink)

                    VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
                        SNAPDescriptionRow(
                            iconName: "creditcard",
                            text: SNAPEligibilityIntroStrings.ebtRow.value(in: language)
                        )
                        SNAPDescriptionRow(
                            iconName: "cart",
                            text: SNAPEligibilityIntroStrings.cartRow.value(in: language)
                        )
                        SNAPDescriptionRow(
                            iconName: "carrot",
                            text: SNAPEligibilityIntroStrings.foodRow.value(in: language)
                        )
                        SNAPDescriptionRow(
                            iconName: "xmark.circle",
                            text: SNAPEligibilityIntroStrings.restrictionsRow.value(in: language)
                        )
                    }
                    .padding(.top, CivicaSpacing.xs)
                    }
                    .padding(.vertical, CivicaSpacing.sm)

                if let submittedAt = viewModel.submittedAt {
                    Button {
                        viewModel.jumpToDraftStep(.nextSteps)
                        continueToGuidedDraft = true
                    } label: {
                        VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
                            Text(SNAPEligibilityIntroStrings.prepStatusTitle.value(in: language))
                                .font(CivicaTypography.sectionHeader)
                                .foregroundStyle(CivicaColors.ink)

                            HStack(spacing: CivicaSpacing.sm) {
                                Text(SNAPEligibilityIntroStrings.statusLabel.value(in: language))
                                    .font(CivicaTypography.subheadStrong)
                                    .foregroundStyle(CivicaColors.graphite)
                                Text(SNAPEligibilityIntroStrings.prepCompleted.value(in: language))
                                    .font(CivicaTypography.subheadStrong)
                                    .foregroundStyle(CivicaColors.amberPrimary)
                            }

                            HStack(spacing: CivicaSpacing.sm) {
                                Text(SNAPEligibilityIntroStrings.dateLabel.value(in: language))
                                    .font(CivicaTypography.subheadStrong)
                                    .foregroundStyle(CivicaColors.graphite)
                                Text(statusDateText(from: submittedAt))
                                    .font(CivicaTypography.subheadStrong)
                                    .foregroundStyle(CivicaColors.ink)
                            }

                            Text(SNAPEligibilityIntroStrings.openNextSteps.value(in: language))
                                .font(CivicaTypography.subheadStrong)
                                .foregroundStyle(CivicaColors.pinePrimary)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(CivicaSpacing.md)
                        .background(
                            RoundedRectangle(cornerRadius: CivicaRadius.card, style: .continuous)
                                .fill(CivicaColors.surfacePrimary)
                        )
                        .overlay(
                            RoundedRectangle(cornerRadius: CivicaRadius.card, style: .continuous)
                                .stroke(CivicaColors.hairline, lineWidth: 1)
                        )
                    }
                    .buttonStyle(.plain)
                }

                    Text(SNAPCopy.globalDisclaimer)
                        .font(CivicaTypography.footnoteStrong)
                        .foregroundStyle(CivicaColors.graphite)
                        .fixedSize(horizontal: false, vertical: true)

                    HStack {
                        Spacer(minLength: 0)
                        Button(SNAPEligibilityIntroStrings.prepareApplication.value(in: language)) {
                            continueToGuidedDraft = true
                        }
                        .buttonStyle(CivicaPrimaryCTAButtonStyle())
                        .accessibilityLabel(SNAPEligibilityIntroStrings.prepareApplication.value(in: language))
                        Spacer(minLength: 0)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(CivicaSpacing.lg)
            }
            .background(CivicaColors.paper)
        }
        .toolbarBackground(CivicaColors.paper, for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
        .navigationDestination(isPresented: $continueToGuidedDraft) {
            // Route dispatch: when SNAP_CONVERSATION_ENABLED is set at
            // compile time (see SNAPFeatureFlag.isConversationEnabled),
            // SNAPRouter.screenerRoute returns .conversation and we
            // mount the LLM-driven chat. Otherwise we mount the
            // question-flow orchestrator.
            screenerDestination
        }
    }

    @ViewBuilder
    private var screenerDestination: some View {
        switch SNAPRouter.screenerRoute {
        case .conversation:
            SNAPConversationFlowView(
                stateCode: resolvedStateCodeForConversation(),
                language: "en",
                onClose: { dismiss() }
            )
        default:
            // Question-flow orchestrator — the HANDOFF-cadence path.
            // Replaced the legacy 4130-line SNAPApplicationView /
            // SNAPStepContainerView pair in the router cutover.
            SNAPApplicationFlowOrchestratorView(
                viewModel: SNAPApplicationFlowOrchestratorViewModel(),
                language: language,
                onGeneratePacket: { draft in
                    // Mission 2 + 7: evaluate the draft, record the
                    // verdict into the shared status store (which
                    // also advances status to .screenerComplete so
                    // CivicaRootView routes the user to the
                    // returning-user-home on the next launch), then
                    // push SNAPDecisionMathView for immediate
                    // feedback.
                    generatedFromOrchestrator = draft
                    let verdict = SNAPLocalEligibilityEvaluator.evaluate(draft)
                    statusStore.recordEligibilityResult(verdict)
                    orchestratorVerdict = verdict
                    presentingVerdict = true
                },
                onDismiss: { dismiss() }
            )
            .navigationTitle(SNAPEligibilityIntroStrings.questionnaireTitle.value(in: language))
            .navigationBarTitleDisplayMode(.inline)
            .navigationDestination(isPresented: $presentingVerdict) {
                if let verdict = orchestratorVerdict {
                    SNAPDecisionMathView(
                        result: verdict,
                        language: language,
                        onContinue: {
                            // Mission 9: chain to the packet view
                            // which renders the user's answers into
                            // a saveable / shareable PDF.
                            presentingPacket = true
                        }
                    )
                    // Inner .navigationDestination — attached to the
                    // verdict view so the packet push fires from
                    // there rather than from the intro screen.
                    .navigationDestination(isPresented: $presentingPacket) {
                        if let draft = generatedFromOrchestrator {
                            SNAPApplicationPacketView(
                                draft: draft,
                                language: language,
                                onClose: { dismiss() }
                            )
                        }
                    }
                }
            }
        }
    }

    /// Pick the best USPS state code for the conversation pipeline.
    /// Prefer the user's typed/geofenced state, then default to CA
    /// (the launch state).
    private func resolvedStateCodeForConversation() -> String {
        let typed = (viewModel.application.state ?? "").trimmingCharacters(in: .whitespaces)
        if !typed.isEmpty {
            return typed.uppercased()
        }
        return "CA"
    }

    private func statusDateText(from date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }
}

private struct SNAPIntroHeader: View {
    let title: String

    var body: some View {
        HStack(alignment: .top, spacing: CivicaSpacing.md) {
            ZStack {
                RoundedRectangle(cornerRadius: CivicaRadius.card, style: .continuous)
                    .fill(CivicaColors.surfacePrimary)
                    .frame(width: 56, height: 56)
                    .overlay(
                        RoundedRectangle(cornerRadius: CivicaRadius.card, style: .continuous)
                            .stroke(CivicaColors.hairline, lineWidth: 1)
                    )
                    .shadow(color: CivicaColors.pinePrimary.opacity(0.14), radius: 6, x: 0, y: 3)

                Image("SNAPOfficialLogo")
                    .resizable()
                    .scaledToFit()
                    .frame(width: 44, height: 44)
                    .accessibilityHidden(true)
            }

            Text(title)
                .font(CivicaTypography.pageTitle)
                .foregroundStyle(CivicaColors.ink)
                .lineLimit(1)
                .minimumScaleFactor(0.84)
                .padding(.top, CivicaSpacing.xs)
                .frame(minHeight: 56, alignment: .topLeading)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.top, CivicaSpacing.xs)
    }
}

private enum SNAPIntroCopy {
    static func approvalHeading(stateCode: String?, language: CivicaLanguage) -> String {
        let agency = SNAPAgencyDirectory.agencyShortName(for: stateCode, language: language)
        switch language {
        case .english: return "If \(agency) approves your application..."
        case .spanish: return "Si \(agency) aprueba tu solicitud..."
        }
    }
}

private struct SNAPDescriptionRow: View {
    let iconName: String
    let text: String

    var body: some View {
        HStack(alignment: .top, spacing: CivicaSpacing.sm) {
            Image(systemName: iconName)
                .font(CivicaTypography.footnoteStrong)
                .foregroundStyle(CivicaColors.pinePrimary)
                .frame(width: 20, height: 20)
                .padding(.top, CivicaSpacing.xs)

            Text(text)
                .font(CivicaTypography.subhead)
                .foregroundStyle(CivicaColors.ink)
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}
