import CivicaDesignSystem
import SwiftUI

// EXPERIMENTAL SILOED MODULE:
// Review screen for the SNAP prototype draft. This view is session-only and does not send data anywhere.
struct SNAPReviewView: View {
    @ObservedObject var viewModel: SNAPApplicationViewModel
    let onShowNextSteps: (() -> Void)?

    @AppStorage(CivicaLanguage.defaultStorageKey)
    private var languageRaw: String = CivicaLanguage.english.rawValue

    private var language: CivicaLanguage {
        CivicaLanguage(rawValue: languageRaw) ?? .english
    }

    init(
        viewModel: SNAPApplicationViewModel,
        onShowNextSteps: (() -> Void)? = nil
    ) {
        self.viewModel = viewModel
        self.onShowNextSteps = onShowNextSteps
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: CivicaSpacing.md) {
                Text(SNAPReviewStrings.title.value(in: language))
                    .font(CivicaTypography.cardSubtitle)
                    .foregroundStyle(CivicaColors.ink)

                Text(SNAPReviewStrings.reviewBeforeSubmitting.value(in: language))
                    .font(CivicaTypography.footnote)
                    .foregroundStyle(CivicaColors.warningAmber)

                Text(SNAPCopy.globalDisclaimer)
                    .font(CivicaTypography.footnoteStrong)
                    .foregroundStyle(CivicaColors.graphite)
                    .fixedSize(horizontal: false, vertical: true)

                SNAPReviewSectionCard(
                    title: SNAPReviewStrings.householdSection.value(in: language),
                    editLabel: SNAPReviewStrings.edit.value(in: language),
                    rows: [
                        (SNAPReviewStrings.householdSize.value(in: language), displayOptionalInt(viewModel.application.householdSize)),
                        (SNAPReviewStrings.applicantAge.value(in: language), displayOptionalInt(viewModel.application.applicantAge)),
                        (SNAPReviewStrings.housingStatus.value(in: language), viewModel.application.housingStatus?.label ?? SNAPReviewStrings.notProvided.value(in: language))
                    ],
                    onEdit: { goToDraftStep(.householdBasics) }
                )

                SNAPReviewSectionCard(
                    title: SNAPReviewStrings.locationSection.value(in: language),
                    editLabel: SNAPReviewStrings.edit.value(in: language),
                    rows: [
                        (SNAPReviewStrings.stateLabel.value(in: language), displayOptionalString(viewModel.application.state)),
                        (SNAPReviewStrings.zipCode.value(in: language), displayOptionalString(viewModel.application.zipCode))
                    ],
                    onEdit: { goToDraftStep(.whereApplyingFrom) }
                )

                SNAPReviewSectionCard(
                    title: SNAPReviewStrings.studentSection.value(in: language),
                    editLabel: SNAPReviewStrings.edit.value(in: language),
                    rows: [
                        (SNAPReviewStrings.inHigherEducation.value(in: language), yesNoUnknown(viewModel.application.isCurrentlyEnrolledInHigherEducation)),
                        (SNAPReviewStrings.halfTimeEnrolled.value(in: language), studentFollowUpValue(viewModel.application.isEnrolledAtLeastHalfTime)),
                        (SNAPReviewStrings.works20Hours.value(in: language), studentFollowUpValue(viewModel.application.worksAtLeastTwentyHoursPerWeek)),
                        (SNAPReviewStrings.workStudy.value(in: language), studentFollowUpValue(viewModel.application.participatesInWorkStudy)),
                        (SNAPReviewStrings.dependentChild.value(in: language), studentFollowUpValue(viewModel.application.isResponsibleForDependentChild))
                    ],
                    onEdit: { goToDraftStep(.studentStatus) }
                )

                SNAPReviewSectionCard(
                    title: SNAPReviewStrings.incomeSection.value(in: language),
                    editLabel: SNAPReviewStrings.edit.value(in: language),
                    rows: [
                        (SNAPReviewStrings.employmentStatus.value(in: language), viewModel.application.employmentStatus?.label ?? SNAPReviewStrings.notProvided.value(in: language)),
                        (SNAPReviewStrings.monthlyIncome.value(in: language), displayString(viewModel.application.monthlyIncomeEstimate)),
                        (SNAPReviewStrings.incomeChanges.value(in: language), yesNoUnknown(viewModel.application.incomeChangesMonthToMonth))
                    ],
                    onEdit: { goToDraftStep(.income) }
                )

                SNAPReviewSectionCard(
                    title: SNAPReviewStrings.expensesSection.value(in: language),
                    editLabel: SNAPReviewStrings.edit.value(in: language),
                    rows: [
                        (SNAPReviewStrings.rentOrHousing.value(in: language), displayString(viewModel.application.rentOrHousingCost)),
                        (SNAPReviewStrings.utilities.value(in: language), displayString(viewModel.application.utilitiesCost)),
                        (SNAPReviewStrings.childcareOptional.value(in: language), displayString(viewModel.application.childcareCostEstimate)),
                        (SNAPReviewStrings.medicalOptional.value(in: language), displayString(viewModel.application.medicalExpensesEstimate))
                    ],
                    onEdit: { goToDraftStep(.expenses) }
                )

                SNAPReviewSectionCard(
                    title: SNAPReviewStrings.documentsSection.value(in: language),
                    editLabel: SNAPReviewStrings.edit.value(in: language),
                    rows: [
                        (SNAPReviewStrings.itemsChecked.value(in: language), documentsValue(viewModel.application.documentsAvailable))
                    ],
                    onEdit: { goToDraftStep(.documentsChecklist) }
                )

                Button(SNAPReviewStrings.showNextSteps.value(in: language)) {
                    if let onShowNextSteps {
                        onShowNextSteps()
                    } else {
                        viewModel.goNext()
                    }
                }
                .buttonStyle(CivicaPrimaryCTAButtonStyle())
            }
            .padding(CivicaSpacing.lg)
        }
        .background(CivicaColors.tealSurface.ignoresSafeArea())
        .navigationTitle(SNAPReviewStrings.title.value(in: language))
        .navigationBarTitleDisplayMode(.inline)
        .onAppear {
            viewModel.markReviewViewed()
        }
    }

    private func goToDraftStep(_ step: SNAPDraftStep) {
        viewModel.draftStep = step
        viewModel.currentStep = .application
    }

    private func yesNoUnknown(_ value: Bool?) -> String {
        guard let value else { return SNAPReviewStrings.notProvided.value(in: language) }
        return value
            ? SNAPReviewStrings.yes.value(in: language)
            : SNAPReviewStrings.no.value(in: language)
    }

    private func studentFollowUpValue(_ value: Bool?) -> String {
        guard viewModel.application.isCurrentlyEnrolledInHigherEducation == true else {
            return SNAPReviewStrings.notApplicable.value(in: language)
        }
        return yesNoUnknown(value)
    }

    private func displayOptionalString(_ value: String?) -> String {
        let trimmed = (value ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? SNAPReviewStrings.notProvided.value(in: language) : trimmed
    }

    private func displayOptionalInt(_ value: Int?) -> String {
        guard let value else { return SNAPReviewStrings.notProvided.value(in: language) }
        return "\(value)"
    }

    private func displayString(_ value: String) -> String {
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? SNAPReviewStrings.notProvided.value(in: language) : trimmed
    }

    private func documentsValue(_ docs: [SNAPDocumentType]) -> String {
        guard !docs.isEmpty else { return SNAPReviewStrings.nothingChecked.value(in: language) }
        return docs.map(\.label).joined(separator: ", ")
    }
}

private struct SNAPReviewSectionCard: View {
    let title: String
    let editLabel: String
    let rows: [(label: String, value: String)]
    let onEdit: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
            HStack {
                Text(title)
                    .font(CivicaTypography.sectionHeader)
                    .foregroundStyle(CivicaColors.ink)
                Spacer()
                Button(editLabel) {
                    onEdit()
                }
                .font(CivicaTypography.subheadStrong)
                .buttonStyle(.plain)
                .foregroundStyle(CivicaColors.pinePrimary)
            }

            ForEach(Array(rows.enumerated()), id: \.offset) { _, row in
                HStack(alignment: .top) {
                    Text(row.label)
                        .font(CivicaTypography.subheadStrong)
                        .foregroundStyle(CivicaColors.ink)
                    Spacer(minLength: 12)
                    Text(row.value)
                        .font(CivicaTypography.subhead)
                        .foregroundStyle(CivicaColors.graphite)
                        .multilineTextAlignment(.trailing)
                }
            }
        }
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
}

/*
 #Preview {
 SNAPReviewView(viewModel: SNAPApplicationViewModel())
 }
 */
