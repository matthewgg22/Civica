import SwiftUI

// EXPERIMENTAL SILOED MODULE: eligibility intro screen with mock, non-sensitive inputs.
struct SNAPEligibilityIntroView: View {
    @Environment(\.dismiss) private var dismiss
    @ObservedObject var viewModel: SNAPApplicationViewModel
    @State private var continueToGuidedDraft = false

    var body: some View {
        ZStack {
            CivicaColors.brandSoftBlue.ignoresSafeArea()

            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    VStack(alignment: .leading, spacing: 14) {
                        SNAPIntroHeader(title: "What is SNAP?")

                    Text("The Supplemental Nutrition Assistance Program (commonly referred to as SNAP) is a U.S. government program that helps low-income individuals and families buy food.")
                        .font(.body.weight(.semibold))
                        .foregroundStyle(Color.black)
                        .fixedSize(horizontal: false, vertical: true)

                    Text("If DTA approves your application...")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Color.black)

                    VStack(alignment: .leading, spacing: 10) {
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
                    .padding(.top, 2)
                    }
                    .padding(.vertical, 8)

                if let submittedAt = viewModel.submittedAt {
                    Button {
                        viewModel.jumpToDraftStep(.nextSteps)
                        continueToGuidedDraft = true
                    } label: {
                        VStack(alignment: .leading, spacing: 10) {
                            Text("SNAP prep status")
                                .font(.headline.weight(.semibold))
                                .foregroundStyle(CivicaColors.textPrimary)

                            HStack(spacing: 8) {
                                Text("Status:")
                                    .font(.subheadline.weight(.semibold))
                                    .foregroundStyle(CivicaColors.textSecondary)
                                Text("Prep checklist completed")
                                    .font(.subheadline.weight(.bold))
                                    .foregroundStyle(CivicaColors.successGreen)
                            }

                            HStack(spacing: 8) {
                                Text("Date:")
                                    .font(.subheadline.weight(.semibold))
                                    .foregroundStyle(CivicaColors.textSecondary)
                                Text(statusDateText(from: submittedAt))
                                    .font(.subheadline.weight(.semibold))
                                    .foregroundStyle(CivicaColors.textPrimary)
                            }

                            Text("Open next steps")
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(CivicaColors.ctaBlue)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(14)
                        .background(
                            RoundedRectangle(cornerRadius: 14, style: .continuous)
                                .fill(CivicaColors.surfacePrimary)
                        )
                        .overlay(
                            RoundedRectangle(cornerRadius: 14, style: .continuous)
                                .stroke(CivicaColors.borderSubtle, lineWidth: 1)
                        )
                    }
                    .buttonStyle(.plain)
                }

                    Text(SNAPCopy.globalDisclaimer)
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(CivicaColors.textSecondary)
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
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(CivicaColors.ctaBlue)
                            .frame(maxWidth: .infinity, alignment: .center)
                            .padding(.vertical, 8)
                    }
                    .buttonStyle(.plain)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(16)
            }
            .background(CivicaColors.brandSoftBlue)
        }
        .toolbarBackground(CivicaColors.brandSoftBlue, for: .navigationBar)
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
        HStack(alignment: .top, spacing: 14) {
            ZStack {
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .fill(CivicaColors.surfacePrimary)
                    .frame(width: 56, height: 56)
                    .overlay(
                        RoundedRectangle(cornerRadius: 12, style: .continuous)
                            .stroke(CivicaColors.borderSubtle, lineWidth: 1)
                    )
                    .shadow(color: CivicaColors.ctaBlue.opacity(0.14), radius: 6, x: 0, y: 3)

                Image("SNAPOfficialLogo")
                    .resizable()
                    .scaledToFit()
                    .frame(width: 44, height: 44)
                    .accessibilityHidden(true)
            }

            Text(title)
                .font(.largeTitle)
                .fontWeight(.bold)
                .foregroundStyle(Color.black)
                .lineLimit(1)
                .minimumScaleFactor(0.84)
                .padding(.top, 2)
                .frame(minHeight: 56, alignment: .topLeading)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.top, 4)
    }
}

private struct SNAPDescriptionRow: View {
    let iconName: String
    let text: String

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: iconName)
                .font(.footnote.weight(.semibold))
                .foregroundStyle(CivicaColors.ctaBlue)
                .frame(width: 20, height: 20)
                .padding(.top, 1)

            Text(text)
                .font(.subheadline)
                .foregroundStyle(Color.black)
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}
