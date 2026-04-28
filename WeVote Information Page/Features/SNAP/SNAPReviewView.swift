import SwiftUI

// EXPERIMENTAL SILOED MODULE:
// Review screen for the SNAP prototype draft. This view is session-only and does not send data anywhere.
struct SNAPReviewView: View {
    @ObservedObject var viewModel: SNAPApplicationViewModel
    let onShowNextSteps: (() -> Void)?

    init(
        viewModel: SNAPApplicationViewModel,
        onShowNextSteps: (() -> Void)? = nil
    ) {
        self.viewModel = viewModel
        self.onShowNextSteps = onShowNextSteps
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                Text("Review your SNAP draft")
                    .font(.title3.weight(.semibold))
                    .foregroundStyle(VoteNowColors.textPrimary)

                Text("Review this before using it to complete your official state application.")
                    .font(.footnote)
                    .foregroundStyle(VoteNowColors.warningAmber)

                SNAPReviewSectionCard(
                    title: "Household",
                    rows: [
                        ("Household size", displayOptionalInt(viewModel.application.householdSize)),
                        ("Applicant age", displayOptionalInt(viewModel.application.applicantAge)),
                        ("Housing status", viewModel.application.housingStatus?.label ?? "Not provided")
                    ],
                    onEdit: { goToDraftStep(.householdBasics) }
                )

                SNAPReviewSectionCard(
                    title: "Location",
                    rows: [
                        ("State", displayOptionalString(viewModel.application.state)),
                        ("ZIP code", displayOptionalString(viewModel.application.zipCode))
                    ],
                    onEdit: { goToDraftStep(.householdBasics) }
                )

                SNAPReviewSectionCard(
                    title: "Student status",
                    rows: [
                        ("In higher education", yesNoUnknown(viewModel.application.isCurrentlyEnrolledInHigherEducation)),
                        ("Enrolled half-time", studentFollowUpValue(viewModel.application.isEnrolledAtLeastHalfTime)),
                        ("Works 20+ hours/week", studentFollowUpValue(viewModel.application.worksAtLeastTwentyHoursPerWeek)),
                        ("Participates in work-study", studentFollowUpValue(viewModel.application.participatesInWorkStudy)),
                        ("Responsible for dependent child", studentFollowUpValue(viewModel.application.isResponsibleForDependentChild))
                    ],
                    onEdit: { goToDraftStep(.studentStatus) }
                )

                SNAPReviewSectionCard(
                    title: "Income",
                    rows: [
                        ("Employment status", viewModel.application.employmentStatus?.label ?? "Not provided"),
                        ("Monthly income estimate", displayString(viewModel.application.monthlyIncomeEstimate)),
                        ("Income changes month to month", yesNoUnknown(viewModel.application.incomeChangesMonthToMonth))
                    ],
                    onEdit: { goToDraftStep(.income) }
                )

                SNAPReviewSectionCard(
                    title: "Expenses",
                    rows: [
                        ("Rent or housing", displayString(viewModel.application.rentOrHousingCost)),
                        ("Utilities", displayString(viewModel.application.utilitiesCost)),
                        ("Childcare (optional)", displayString(viewModel.application.childcareCostEstimate)),
                        ("Medical (optional estimate)", displayString(viewModel.application.medicalExpensesEstimate))
                    ],
                    onEdit: { goToDraftStep(.expenses) }
                )

                SNAPReviewSectionCard(
                    title: "Documents checklist",
                    rows: [
                        ("Items checked", documentsValue(viewModel.application.documentsAvailable))
                    ],
                    onEdit: { goToDraftStep(.documentsChecklist) }
                )

                Button("Show next steps") {
                    if let onShowNextSteps {
                        onShowNextSteps()
                    } else {
                        viewModel.goNext()
                    }
                }
                .buttonStyle(VoteNowPrimaryCTAButtonStyle())
            }
            .padding(16)
        }
        .background(VoteNowColors.brandSoftBlue.ignoresSafeArea())
        .onAppear {
            viewModel.markReviewViewed()
        }
    }

    private func goToDraftStep(_ step: SNAPDraftStep) {
        viewModel.draftStep = step
        viewModel.currentStep = .application
    }

    private func yesNoUnknown(_ value: Bool?) -> String {
        guard let value else { return "Not provided" }
        return value ? "Yes" : "No"
    }

    private func studentFollowUpValue(_ value: Bool?) -> String {
        guard viewModel.application.isCurrentlyEnrolledInHigherEducation == true else {
            return "Not applicable"
        }
        return yesNoUnknown(value)
    }

    private func displayOptionalString(_ value: String?) -> String {
        let trimmed = (value ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? "Not provided" : trimmed
    }

    private func displayOptionalInt(_ value: Int?) -> String {
        guard let value else { return "Not provided" }
        return "\(value)"
    }

    private func displayString(_ value: String) -> String {
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? "Not provided" : trimmed
    }

    private func documentsValue(_ docs: [SNAPDocumentType]) -> String {
        guard !docs.isEmpty else { return "Nothing checked yet" }
        return docs.map(\.label).joined(separator: ", ")
    }
}

private struct SNAPReviewSectionCard: View {
    let title: String
    let rows: [(label: String, value: String)]
    let onEdit: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text(title)
                    .font(.headline)
                    .foregroundStyle(VoteNowColors.textPrimary)
                Spacer()
                Button("Edit") {
                    onEdit()
                }
                .font(.subheadline.weight(.semibold))
                .buttonStyle(.plain)
                .foregroundStyle(VoteNowColors.primaryCTA)
            }

            ForEach(Array(rows.enumerated()), id: \.offset) { _, row in
                HStack(alignment: .top) {
                    Text(row.label)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(VoteNowColors.textPrimary)
                    Spacer(minLength: 12)
                    Text(row.value)
                        .font(.subheadline)
                        .foregroundStyle(VoteNowColors.textSecondary)
                        .multilineTextAlignment(.trailing)
                }
            }
        }
        .padding(14)
        .background(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(VoteNowColors.surfacePrimary)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke(VoteNowColors.borderSubtle, lineWidth: 1)
        )
    }
}

/*
 #Preview {
 SNAPReviewView(viewModel: SNAPApplicationViewModel())
 }
 */
