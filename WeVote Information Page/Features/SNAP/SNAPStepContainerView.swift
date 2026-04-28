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
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Current step")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(VoteNowColors.textSecondary)
                        Text(viewModel.draftStepHeaderTitle)
                            .font(.headline.weight(.semibold))
                            .foregroundStyle(VoteNowColors.textPrimary)
                    }
                    Spacer()
                    Text(viewModel.draftStepNumberText)
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(VoteNowColors.textSecondary)
                }

                HStack(spacing: 6) {
                    ForEach(Array(SNAPDraftStep.allCases.enumerated()), id: \.offset) { index, step in
                        Button {
                            if selectedProgressStep == step {
                                selectedProgressStep = nil
                            } else {
                                selectedProgressStep = step
                            }
                        } label: {
                            Capsule(style: .continuous)
                                .fill(progressBarFillColor(for: index))
                                .frame(maxWidth: .infinity, minHeight: 10, maxHeight: 10)
                                .overlay(
                                    Capsule(style: .continuous)
                                        .stroke(
                                            selectedProgressStep == step
                                                ? VoteNowColors.primaryCTA
                                                : VoteNowColors.borderSubtle.opacity(0.45),
                                            lineWidth: selectedProgressStep == step ? 1.5 : 1
                                        )
                                )
                        }
                        .buttonStyle(.plain)
                    }
                }

                if let selectedProgressStep {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Section \(selectedProgressStep.rawValue + 1): \(selectedProgressStep.title)")
                            .font(.footnote.weight(.semibold))
                            .foregroundStyle(VoteNowColors.textPrimary)

                        if selectedProgressStep.rawValue < viewModel.draftStep.rawValue {
                            Button("Go to section") {
                                viewModel.jumpToDraftStep(selectedProgressStep)
                            }
                            .font(.footnote.weight(.semibold))
                            .foregroundStyle(VoteNowColors.primaryCTA)
                            .buttonStyle(.plain)
                        } else if selectedProgressStep == viewModel.draftStep {
                            Text("You are currently on this section.")
                                .font(.footnote)
                                .foregroundStyle(VoteNowColors.textSecondary)
                        } else {
                            Text("Complete earlier sections to unlock this section.")
                                .font(.footnote)
                                .foregroundStyle(VoteNowColors.textSecondary)
                        }
                    }
                    .padding(.horizontal, 10)
                    .padding(.vertical, 8)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(
                        RoundedRectangle(cornerRadius: 10, style: .continuous)
                            .fill(VoteNowColors.surfacePrimary)
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: 10, style: .continuous)
                            .stroke(VoteNowColors.borderSubtle, lineWidth: 1)
                    )
                }
            }
            .padding(.horizontal, 16)
            .padding(.top, 12)
            .padding(.bottom, 10)
            .background(VoteNowColors.brandSoftBlue)

            Divider()

            ScrollView {
                SNAPApplicationView(viewModel: viewModel)
                    .padding(16)
                    .padding(.bottom, keyboardHeight > 0 ? keyboardHeight + 20 : 20)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .scrollDismissesKeyboard(.interactively)
        }
        .safeAreaInset(edge: .bottom) {
            Divider()
            VStack(alignment: .leading, spacing: 6) {
                HStack(spacing: 10) {
                    Button("Back") {
                        viewModel.goBackDraftFlow()
                    }
                    .buttonStyle(SNAPSecondaryCTAButtonStyle())
                    .frame(maxWidth: .infinity)
                    .disabled(viewModel.isAtFirstDraftStep)

                    Button(primaryButtonLabel) {
                        handlePrimaryAction()
                    }
                    .buttonStyle(VoteNowPrimaryCTAButtonStyle())
                    .frame(maxWidth: .infinity)
                }

                Text(viewModel.draftCompletionSummaryText)
                    .font(.footnote.weight(.medium))
                    .foregroundStyle(VoteNowColors.textSecondary)
                    .frame(maxWidth: .infinity, alignment: .center)

                if let hint = viewModel.draftValidationHint, viewModel.hasAttemptedDraftContinue {
                    Text(hint)
                        .font(.footnote)
                        .foregroundStyle(VoteNowColors.warningAmber)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            .padding(.horizontal, 12)
            .padding(.top, 8)
            .padding(.bottom, 10)
            .background(VoteNowColors.surfacePrimary)
        }
        .toolbar(.hidden, for: .tabBar)
        .toolbarBackground(VoteNowColors.brandSoftBlue, for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
        .ignoresSafeArea(.keyboard, edges: .bottom)
        .background(VoteNowColors.brandSoftBlue.ignoresSafeArea())
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

    private func progressBarFillColor(for index: Int) -> Color {
        if index < viewModel.draftStep.rawValue {
            // Completed sections
            return VoteNowColors.infoSurfaceBlue
        }

        if index == viewModel.draftStep.rawValue {
            // Currently viewed section
            return VoteNowColors.primaryCTA
        }

        // Upcoming sections
        return Color.white
    }
}
