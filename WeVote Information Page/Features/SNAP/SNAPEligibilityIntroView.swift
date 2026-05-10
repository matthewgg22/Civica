import CivicaDesignSystem
import SwiftUI

// EXPERIMENTAL SILOED MODULE: eligibility intro screen with mock, non-sensitive inputs.
struct SNAPEligibilityIntroView: View {
    @Environment(\.dismiss) private var dismiss
    @ObservedObject var viewModel: SNAPApplicationViewModel
    @State private var continueToGuidedDraft = false

    var body: some View {
        ZStack {
            CivicaColors.tealSurface.ignoresSafeArea()

            ScrollView {
                VStack(alignment: .leading, spacing: CivicaSpacing.md) {
                    VStack(alignment: .leading, spacing: CivicaSpacing.md) {
                        SNAPIntroHeader(title: "What is SNAP?")

                    Text("The Supplemental Nutrition Assistance Program (commonly referred to as SNAP) is a U.S. government program that helps low-income individuals and families buy food.")
                        .font(CivicaTypography.bodyStrong)
                        .foregroundStyle(Color.black)
                        .fixedSize(horizontal: false, vertical: true)

                    Text("If DTA approves your application...")
                        .font(CivicaTypography.subheadStrong)
                        .foregroundStyle(Color.black)

                    VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
                        SNAPDescriptionRow(
                            iconName: "creditcard",
                            text: "Monthly benefits are loaded onto an Electronic Benefits Transfer (EBT) card."
                        )
                        SNAPDescriptionRow(
                            iconName: "cart",
                            text: "The card works like a debit card at grocery stores and some farmers markets."
                        )
                        SNAPDescriptionRow(
                            iconName: "carrot",
                            text: "SNAP can buy eligible food items to fruits, vegetables, meat, dairy, bread, and more."
                        )
                        SNAPDescriptionRow(
                            iconName: "xmark.circle",
                            text: "SNAP cannot be used for alcohol, tobacco, or hot prepared meals."
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
                            Text("SNAP prep status")
                                .font(CivicaTypography.sectionHeader)
                                .foregroundStyle(CivicaColors.ink)

                            HStack(spacing: CivicaSpacing.sm) {
                                Text("Status:")
                                    .font(CivicaTypography.subheadStrong)
                                    .foregroundStyle(CivicaColors.graphite)
                                Text("Prep checklist completed")
                                    .font(CivicaTypography.subheadBold)
                                    .foregroundStyle(CivicaColors.accentTeal)
                            }

                            HStack(spacing: CivicaSpacing.sm) {
                                Text("Date:")
                                    .font(CivicaTypography.subheadStrong)
                                    .foregroundStyle(CivicaColors.graphite)
                                Text(statusDateText(from: submittedAt))
                                    .font(CivicaTypography.subheadStrong)
                                    .foregroundStyle(CivicaColors.ink)
                            }

                            Text("Open next steps")
                                .font(CivicaTypography.subheadStrong)
                                .foregroundStyle(CivicaColors.brickPrimary)
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
                        Button("Prepare my SNAP application") {
                            continueToGuidedDraft = true
                        }
                        .buttonStyle(CivicaPrimaryCTAButtonStyle())
                        Spacer(minLength: 0)
                    }

                    Button {
                        NotificationCenter.default.post(
                            name: .openMyInfoPanel,
                            object: nil,
                            userInfo: ["section": "language"]
                        )
                    } label: {
                        Text("Need language assistance?")
                            .font(CivicaTypography.subheadStrong)
                            .foregroundStyle(CivicaColors.brickPrimary)
                            .frame(maxWidth: .infinity, alignment: .center)
                            .padding(.vertical, CivicaSpacing.sm)
                    }
                    .buttonStyle(.plain)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(CivicaSpacing.lg)
            }
            .background(CivicaColors.tealSurface)
        }
        .toolbarBackground(CivicaColors.tealSurface, for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
        .navigationDestination(isPresented: $continueToGuidedDraft) {
            SNAPStepContainerView(viewModel: viewModel) {
                dismiss()
            }
            .navigationTitle("SNAP Eligibility Questionnaire")
            .navigationBarTitleDisplayMode(.inline)
            .onAppear {
                viewModel.resetDraftFlow()
            }
        }
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
                    .shadow(color: CivicaColors.brickPrimary.opacity(0.14), radius: 6, x: 0, y: 3)

                Image("SNAPOfficialLogo")
                    .resizable()
                    .scaledToFit()
                    .frame(width: 44, height: 44)
                    .accessibilityHidden(true)
            }

            Text(title)
                .font(CivicaTypography.pageTitle)
                .foregroundStyle(Color.black)
                .lineLimit(1)
                .minimumScaleFactor(0.84)
                .padding(.top, CivicaSpacing.xs)
                .frame(minHeight: 56, alignment: .topLeading)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.top, CivicaSpacing.xs)
    }
}

private struct SNAPDescriptionRow: View {
    let iconName: String
    let text: String

    var body: some View {
        HStack(alignment: .top, spacing: CivicaSpacing.sm) {
            Image(systemName: iconName)
                .font(CivicaTypography.footnoteStrong)
                .foregroundStyle(CivicaColors.brickPrimary)
                .frame(width: 20, height: 20)
                .padding(.top, CivicaSpacing.xs)

            Text(text)
                .font(CivicaTypography.subhead)
                .foregroundStyle(Color.black)
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}
