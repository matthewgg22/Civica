import CivicaDesignSystem
import SwiftUI
import UIKit

// EXPERIMENTAL SILOED MODULE: iPhone-first step container for the SNAP prototype.
struct SNAPStepContainerView: View {
    @Environment(\.dismiss) private var dismiss
    @ObservedObject var viewModel: SNAPApplicationViewModel
    let onClose: (() -> Void)?
    @State private var keyboardHeight: CGFloat = 0
    @State private var selectedProgressStep: SNAPDraftStep?

    var body: some View {
        VStack(spacing: 0) {
            VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
                HStack {
                    VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
                        Text(viewModel.draftStep == .nextSteps ? "Current page" : "Current step")
                            .font(CivicaTypography.captionStrong)
                            .foregroundStyle(CivicaColors.graphite)
                        Text(viewModel.draftStepHeaderTitle)
                            .font(CivicaTypography.sectionHeader)
                            .foregroundStyle(CivicaColors.ink)
                    }
                    Spacer()
                    Text(viewModel.draftStepNumberText)
                        .font(CivicaTypography.footnoteStrong)
                        .foregroundStyle(CivicaColors.graphite)
                }

                if viewModel.draftStep != .nextSteps {
                    HStack(spacing: CivicaSpacing.xs) {
                        ForEach(Array(viewModel.questionnaireSteps.enumerated()), id: \.offset) { index, step in
                            Button {
                                if selectedProgressStep == step {
                                    selectedProgressStep = nil
                                } else {
                                    selectedProgressStep = step
                                }
                            } label: {
                                Capsule(style: .continuous)
                                    .fill(progressBarFillColor(for: step, index: index))
                                    .frame(maxWidth: .infinity, minHeight: 10, maxHeight: 10)
                                    .overlay(
                                        Capsule(style: .continuous)
                                            .stroke(
                                                selectedProgressStep == step
                                                    ? CivicaColors.brickPrimary
                                                    : CivicaColors.hairline.opacity(0.45),
                                                lineWidth: selectedProgressStep == step ? 1.5 : 1
                                            )
                                    )
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }

                if let selectedProgressStep, viewModel.draftStep != .nextSteps {
                    let selectedIndex = viewModel.questionnaireSteps.firstIndex(of: selectedProgressStep) ?? 0
                    let currentIndex = viewModel.questionnaireSteps.firstIndex(of: viewModel.draftStep) ?? 0
                    VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
                        Text("Section \(selectedIndex + 1): \(selectedProgressStep.title)")
                            .font(CivicaTypography.footnoteStrong)
                            .foregroundStyle(CivicaColors.ink)

                        if selectedIndex < currentIndex {
                            Button("Go to section") {
                                viewModel.jumpToDraftStep(selectedProgressStep)
                            }
                            .font(CivicaTypography.footnoteStrong)
                            .foregroundStyle(CivicaColors.brickPrimary)
                            .buttonStyle(.plain)
                        } else if selectedProgressStep == viewModel.draftStep {
                            Text("You are currently on this section.")
                                .font(CivicaTypography.footnote)
                                .foregroundStyle(CivicaColors.graphite)
                        } else {
                            Text("Complete earlier sections to unlock this section.")
                                .font(CivicaTypography.footnote)
                                .foregroundStyle(CivicaColors.graphite)
                        }
                    }
                    .padding(.horizontal, CivicaSpacing.sm)
                    .padding(.vertical, CivicaSpacing.sm)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(
                        RoundedRectangle(cornerRadius: CivicaRadius.md, style: .continuous)
                            .fill(CivicaColors.surfacePrimary)
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: CivicaRadius.md, style: .continuous)
                            .stroke(CivicaColors.hairline, lineWidth: 1)
                    )
                }
            }
            .padding(.horizontal, CivicaSpacing.lg)
            .padding(.top, CivicaSpacing.md)
            .padding(.bottom, CivicaSpacing.sm)
            .background(CivicaColors.tealSurface)

            Divider()

            ScrollView {
                SNAPApplicationView(viewModel: viewModel)
                    .padding(CivicaSpacing.lg)
                    .padding(.bottom, keyboardHeight > 0 ? keyboardHeight + 20 : 20)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .scrollDismissesKeyboard(.interactively)
        }
        .safeAreaInset(edge: .bottom) {
            Divider()
            VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
                HStack(spacing: CivicaSpacing.sm) {
                    Button("Back") {
                        viewModel.goBackDraftFlow()
                    }
                    .buttonStyle(SNAPSecondaryCTAButtonStyle())
                    .frame(maxWidth: .infinity)
                    .disabled(viewModel.isAtFirstDraftStep)

                    Button(primaryButtonLabel) {
                        handlePrimaryAction()
                    }
                    .buttonStyle(CivicaPrimaryCTAButtonStyle())
                    .frame(maxWidth: .infinity)
                }

                Text(viewModel.draftCompletionSummaryText)
                    .font(.footnote.weight(.medium))
                    .foregroundStyle(CivicaColors.graphite)
                    .frame(maxWidth: .infinity, alignment: .center)

            }
            .padding(.horizontal, CivicaSpacing.md)
            .padding(.top, CivicaSpacing.sm)
            .padding(.bottom, CivicaSpacing.sm)
            .background(CivicaColors.surfacePrimary)
        }
        .toolbar(.hidden, for: .tabBar)
        .toolbarBackground(CivicaColors.tealSurface, for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
        .ignoresSafeArea(.keyboard, edges: .bottom)
        .background(CivicaColors.tealSurface.ignoresSafeArea())
        .onAppear {
            viewModel.markStarted()
            if viewModel.draftStep == .reviewDraft {
                viewModel.markReviewViewed()
            }
            if viewModel.draftStep == .nextSteps {
                viewModel.markNextStepsViewed()
            }
        }
        .onChange(of: viewModel.draftStep) { _, newStep in
            if newStep == .reviewDraft {
                viewModel.markReviewViewed()
            }
            if newStep == .nextSteps {
                viewModel.markNextStepsViewed()
            }
        }
        .onReceive(NotificationCenter.default.publisher(for: UIResponder.keyboardWillShowNotification)) { note in
            guard
                let frame = note.userInfo?[UIResponder.keyboardFrameEndUserInfoKey] as? CGRect
            else { return }
            withAnimation(.easeOut(duration: 0.22)) {
                keyboardHeight = max(0, frame.height - 80)
            }
        }
        .onReceive(NotificationCenter.default.publisher(for: UIResponder.keyboardWillHideNotification)) { _ in
            withAnimation(.easeOut(duration: 0.2)) {
                keyboardHeight = 0
            }
        }
    }

    private var primaryButtonLabel: String {
        switch viewModel.draftStep {
        case .documentsChecklist:
            return "Review"
        case .reviewDraft:
            return "Show next steps"
        case .nextSteps:
            return "Done"
        default:
            return "Continue"
        }
    }

    private func handlePrimaryAction() {
        if viewModel.isAtLastDraftStep {
            // Prefer local dismissal so final-step completion always works,
            // regardless of which parent pushed this screen.
            onClose?()
            dismiss()
        } else {
            viewModel.continueDraftFlow()
        }
    }

    private func progressBarFillColor(for step: SNAPDraftStep, index: Int) -> Color {
        let completionState = viewModel.completionState(for: step)
        let currentIndex = viewModel.questionnaireSteps.firstIndex(of: viewModel.draftStep)

        if let currentIndex, index > currentIndex {
            // Upcoming sections
            return Color.white
        }

        switch completionState {
        case .missingRequired:
            return CivicaColors.ctaRed.opacity(0.88)
        case .missingOptional:
            return CivicaColors.warningAmber.opacity(0.82)
        case .complete:
            return currentIndex == index
                ? CivicaColors.brickPrimary
                : CivicaColors.accentTeal.opacity(0.9)
        case .notStarted:
            return currentIndex == index
                ? CivicaColors.warningAmber.opacity(0.72)
                : Color.white
        }
    }
}
