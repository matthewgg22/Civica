import Foundation

@MainActor
final class SNAPApplicationViewModel: ObservableObject {
    // EXPERIMENTAL SILOED MODULE:
    // All SNAP state is isolated here and remains in-memory only.
    // SNAP state is intentionally siloed from voter/civic profile state during prototype development.
    // Do not read from or write to voter registration, representative lookup, party preference,
    // election location, or shared civic profile stores from this view model.
    @Published var currentStep: SNAPRoute = .entry
    @Published var application = SNAPApplicationDraft()
    @Published var draftStep: SNAPDraftStep = .householdBasics
    @Published var eligibility = SNAPEligibilityDraft()
    @Published private(set) var geofencedStateCode: String?
    @Published var acceptedPrivacyNotice = false
    @Published private(set) var submittedAt: Date?
    @Published private(set) var hasStartedGuidedDraft = false
    @Published private(set) var hasViewedNextSteps = false
    @Published private(set) var hasAttemptedDraftContinue = false

    private var hasTrackedReviewViewed = false
    private var hasTrackedAbandoned = false

    var progress: Double {
        guard
            let maxStep = SNAPRouter.orderedRoutes.last?.rawValue,
            maxStep > 0
        else {
            return 0
        }
        return Double(currentStep.rawValue) / Double(maxStep)
    }

    // Kept for compatibility with existing SNAP views.
    var progressFraction: Double {
        progress
    }

    var draftProgressFraction: Double {
        let all = SNAPDraftStep.allCases
        guard !all.isEmpty else { return 0 }
        return Double(draftStep.rawValue + 1) / Double(all.count)
    }

    var draftStepNumberText: String {
        "\(draftStep.rawValue + 1) of \(SNAPDraftStep.allCases.count)"
    }

    var completedDraftStepCount: Int {
        min(max(draftStep.rawValue, 0), SNAPDraftStep.allCases.count)
    }

    var totalDraftStepCount: Int {
        SNAPDraftStep.allCases.count
    }

    var draftCompletionSummaryText: String {
        let counts = currentDraftQuestionCounts
        if counts.total == 0 {
            return "No questions on this step"
        }
        return "\(counts.completed) out of \(counts.total) completed"
    }

    var draftStepHeaderTitle: String {
        switch draftStep {
        case .householdBasics:
            return "Household basics"
        case .addressContact:
            return "Contact preference"
        case .income:
            return "Income"
        case .studentStatus:
            return "Student status"
        case .expenses:
            return "Monthly expenses"
        case .documentsChecklist:
            return "Preparation checklist"
        case .reviewDraft:
            return "Review your application"
        case .nextSteps:
            return "Next steps"
        }
    }

    var isStateGeofenced: Bool {
        geofencedStateCode != nil
    }

    var reviewItems: [SNAPReviewLineItem] {
        [
            SNAPReviewLineItem(label: "Household size", value: displayOptionalInt(application.householdSize)),
            SNAPReviewLineItem(label: "Applicant age", value: displayOptionalInt(application.applicantAge)),
            SNAPReviewLineItem(label: "State", value: displayOptionalString(application.state)),
            SNAPReviewLineItem(label: "ZIP code", value: displayOptionalString(application.zipCode)),
            SNAPReviewLineItem(label: "Housing status", value: application.housingStatus?.label ?? "Not provided"),
            SNAPReviewLineItem(label: "Student status", value: application.studentStatus?.label ?? "Not provided"),
            SNAPReviewLineItem(label: "Enrolled in higher education", value: yesNoUnknown(application.isCurrentlyEnrolledInHigherEducation)),
            SNAPReviewLineItem(label: "Enrolled at least half-time", value: yesNoUnknown(application.isEnrolledAtLeastHalfTime)),
            SNAPReviewLineItem(label: "Works at least 20 hours per week", value: yesNoUnknown(application.worksAtLeastTwentyHoursPerWeek)),
            SNAPReviewLineItem(label: "Participates in work-study", value: yesNoUnknown(application.participatesInWorkStudy)),
            SNAPReviewLineItem(label: "Responsible for a dependent child", value: yesNoUnknown(application.isResponsibleForDependentChild)),
            SNAPReviewLineItem(label: "Monthly income estimate", value: displayString(application.monthlyIncomeEstimate)),
            SNAPReviewLineItem(label: "Employment status", value: application.employmentStatus?.label ?? "Not provided"),
            SNAPReviewLineItem(label: "Income changes month to month", value: yesNoUnknown(application.incomeChangesMonthToMonth)),
            SNAPReviewLineItem(label: "Rent or housing cost", value: displayString(application.rentOrHousingCost)),
            SNAPReviewLineItem(label: "Utilities cost", value: displayString(application.utilitiesCost)),
            SNAPReviewLineItem(label: "Childcare cost estimate", value: displayString(application.childcareCostEstimate)),
            SNAPReviewLineItem(label: "Medical expenses estimate", value: displayString(application.medicalExpensesEstimate)),
            SNAPReviewLineItem(label: "Documents available", value: displayDocuments(application.documentsAvailable))
        ]
    }

    var canContinue: Bool {
        switch currentStep {
        case .entry:
            return true
        case .privacyNotice:
            return acceptedPrivacyNotice
        case .eligibilityIntro:
            return eligibility.isMassachusettsResident != nil
        case .application:
            return canContinueDraftStep
        case .review:
            return true
        case .confirmation:
            return true
        }
    }

    // Kept for compatibility with existing SNAP views.
    var canContinueCurrentStep: Bool {
        canContinue
    }

    var canContinueDraftStep: Bool {
        switch draftStep {
        case .householdBasics:
            return application.householdSize != nil
                && !trimmed(application.state).isEmpty
                && !trimmed(application.zipCode).isEmpty
        case .addressContact:
            // Contact preference is optional in the prototype flow to avoid blocking progress.
            return true
        case .income:
            return !trimmed(application.monthlyIncomeEstimate).isEmpty
                && application.employmentStatus != nil
                && application.incomeChangesMonthToMonth != nil
        case .studentStatus:
            guard let isStudent = application.isCurrentlyEnrolledInHigherEducation else {
                return false
            }
            guard isStudent else {
                return true
            }
            return application.isEnrolledAtLeastHalfTime != nil
                && application.worksAtLeastTwentyHoursPerWeek != nil
                && application.participatesInWorkStudy != nil
                && application.isResponsibleForDependentChild != nil
        case .expenses:
            return !trimmed(application.rentOrHousingCost).isEmpty
                && !trimmed(application.utilitiesCost).isEmpty
        case .documentsChecklist:
            return true
        case .reviewDraft:
            return true
        case .nextSteps:
            return true
        }
    }

    var draftValidationHint: String? {
        switch draftStep {
        case .householdBasics:
            var missing: [String] = []
            if application.householdSize == nil { missing.append("household size") }
            if trimmed(application.state).isEmpty { missing.append("state") }
            if trimmed(application.zipCode).isEmpty { missing.append("ZIP code") }
            guard !missing.isEmpty else { return nil }
            return "To continue, add: \(missing.joined(separator: ", "))."
        case .income:
            var missing: [String] = []
            if application.employmentStatus == nil { missing.append("employment status") }
            if trimmed(application.monthlyIncomeEstimate).isEmpty { missing.append("estimated monthly income") }
            if application.incomeChangesMonthToMonth == nil { missing.append("income change answer") }
            guard !missing.isEmpty else { return nil }
            return "To continue, add: \(missing.joined(separator: ", "))."
        case .studentStatus:
            guard let isStudent = application.isCurrentlyEnrolledInHigherEducation else {
                return "To continue, answer whether you are currently enrolled in higher education."
            }
            guard isStudent else { return nil }

            var missing: [String] = []
            if application.isEnrolledAtLeastHalfTime == nil { missing.append("half-time enrollment") }
            if application.worksAtLeastTwentyHoursPerWeek == nil { missing.append("20+ hours/week work status") }
            if application.participatesInWorkStudy == nil { missing.append("work-study status") }
            if application.isResponsibleForDependentChild == nil { missing.append("dependent child responsibility") }
            guard !missing.isEmpty else { return nil }
            return "To continue, add: \(missing.joined(separator: ", "))."
        case .expenses:
            var missing: [String] = []
            if trimmed(application.rentOrHousingCost).isEmpty { missing.append("rent or housing cost") }
            if trimmed(application.utilitiesCost).isEmpty { missing.append("utilities cost") }
            guard !missing.isEmpty else { return nil }
            return "To continue, add: \(missing.joined(separator: ", "))."
        case .addressContact, .documentsChecklist, .reviewDraft, .nextSteps:
            return nil
        }
    }

    var isAtFirstDraftStep: Bool {
        draftStep == SNAPDraftStep.allCases.first
    }

    var isAtLastDraftStep: Bool {
        draftStep == SNAPDraftStep.allCases.last
    }

    func continueDraftFlow() {
        guard canContinueDraftStep else {
            hasAttemptedDraftContinue = true
            return
        }

        hasAttemptedDraftContinue = false
        let completedStep = draftStep
        guard let next = SNAPDraftStep(rawValue: draftStep.rawValue + 1) else {
            submittedAt = Date()
            return
        }
        draftStep = next
        SNAPAnalytics.trackStepCompleted(step: completedStep)
        if draftStep == .reviewDraft {
            markReviewViewed()
        }
        if draftStep == .nextSteps {
            submittedAt = Date()
            markNextStepsViewed()
        }
    }

    func goBackDraftFlow() {
        guard let previous = SNAPDraftStep(rawValue: draftStep.rawValue - 1) else { return }
        draftStep = previous
        hasAttemptedDraftContinue = false
    }

    func resetDraftFlow() {
        draftStep = .householdBasics
        hasAttemptedDraftContinue = false
    }

    func jumpToDraftStep(_ step: SNAPDraftStep) {
        draftStep = step
        hasAttemptedDraftContinue = false
    }

    func markStarted() {
        guard !hasStartedGuidedDraft else { return }
        hasStartedGuidedDraft = true
        SNAPAnalytics.trackStarted()
    }

    func markReviewViewed() {
        guard !hasTrackedReviewViewed else { return }
        hasTrackedReviewViewed = true
        SNAPAnalytics.trackReviewViewed()
    }

    func markNextStepsViewed() {
        guard !hasViewedNextSteps else { return }
        hasViewedNextSteps = true
        SNAPAnalytics.trackNextStepsViewed()
    }

    func trackAbandonmentIfNeeded() {
        guard hasStartedGuidedDraft, !hasViewedNextSteps, !hasTrackedAbandoned else { return }
        hasTrackedAbandoned = true
        SNAPAnalytics.trackAbandoned(lastStep: draftStep)
    }

    func goNext() {
        guard canContinue else { return }
        guard let next = SNAPRouter.nextRoute(after: currentStep) else { return }
        currentStep = next
    }

    func goBack() {
        guard let previous = SNAPRouter.previousRoute(before: currentStep) else { return }
        currentStep = previous
    }

    func submitMockPacket() {
        // EXPERIMENTAL SILOED MODULE: mock submit only; no backend persistence.
        submittedAt = Date()
        currentStep = .confirmation
    }

    func resetDraft() {
        currentStep = .entry
        draftStep = .householdBasics
        eligibility = SNAPEligibilityDraft()
        application = SNAPApplicationDraft()
        if let geofencedStateCode {
            application.state = geofencedStateCode
        }
        acceptedPrivacyNotice = false
        submittedAt = nil
        hasStartedGuidedDraft = false
        hasViewedNextSteps = false
        hasAttemptedDraftContinue = false
        hasTrackedReviewViewed = false
        hasTrackedAbandoned = false
    }

    // Kept for compatibility with existing SNAP views.
    func resetFlow() {
        resetDraft()
    }

    func applyLocationPrefill(stateCode: String?, zipCode: String?) {
        // Keep SNAP session state isolated while allowing location prefill.
        // Geofence behavior: if a valid address state exists, lock SNAP state context to it.
        let normalizedState = trimmed(stateCode).uppercased()
        let normalizedZIP = String((zipCode ?? "").filter(\.isNumber).prefix(5))

        if normalizedState.count == 2 {
            geofencedStateCode = normalizedState
            application.state = normalizedState
        } else if trimmed(application.state).isEmpty {
            geofencedStateCode = nil
        }

        if trimmed(application.zipCode).isEmpty,
           normalizedZIP.count == 5 {
            application.zipCode = normalizedZIP
        }
    }

    private func displayOptionalInt(_ value: Int?) -> String {
        guard let value else { return "Not provided" }
        return "\(value)"
    }

    private func displayOptionalString(_ value: String?) -> String {
        let normalized = trimmed(value)
        return normalized.isEmpty ? "Not provided" : normalized
    }

    private func displayString(_ value: String) -> String {
        let normalized = value.trimmingCharacters(in: .whitespacesAndNewlines)
        return normalized.isEmpty ? "Not provided" : normalized
    }

    private func displayDocuments(_ docs: [SNAPDocumentType]) -> String {
        guard !docs.isEmpty else { return "None selected" }
        return docs.map(\.label).joined(separator: ", ")
    }

    private func yesNoUnknown(_ value: Bool?) -> String {
        guard let value else { return "Not provided" }
        return value ? "Yes" : "No"
    }

    private func trimmed(_ value: String?) -> String {
        (value ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private var currentDraftQuestionCounts: (completed: Int, total: Int) {
        switch draftStep {
        case .householdBasics:
            let total = 5
            var completed = 0
            if application.householdSize != nil { completed += 1 }
            if application.applicantAge != nil { completed += 1 }
            if !trimmed(application.state).isEmpty { completed += 1 }
            if !trimmed(application.zipCode).isEmpty { completed += 1 }
            if application.housingStatus != nil { completed += 1 }
            return (completed, total)

        case .addressContact:
            let total = 1
            let completed = application.preferredContactMethod == nil ? 0 : 1
            return (completed, total)

        case .income:
            let total = 3
            var completed = 0
            if application.employmentStatus != nil { completed += 1 }
            if !trimmed(application.monthlyIncomeEstimate).isEmpty { completed += 1 }
            if application.incomeChangesMonthToMonth != nil { completed += 1 }
            return (completed, total)

        case .studentStatus:
            var total = 1
            var completed = 0

            if application.isCurrentlyEnrolledInHigherEducation != nil {
                completed += 1
            }

            if application.isCurrentlyEnrolledInHigherEducation == true {
                total += 4
                if application.isEnrolledAtLeastHalfTime != nil { completed += 1 }
                if application.worksAtLeastTwentyHoursPerWeek != nil { completed += 1 }
                if application.participatesInWorkStudy != nil { completed += 1 }
                if application.isResponsibleForDependentChild != nil { completed += 1 }
            }

            return (completed, total)

        case .expenses:
            var total = 3
            var completed = 0

            if !trimmed(application.rentOrHousingCost).isEmpty { completed += 1 }
            if !trimmed(application.utilitiesCost).isEmpty { completed += 1 }
            if !trimmed(application.medicalExpensesEstimate).isEmpty { completed += 1 }

            if application.isResponsibleForDependentChild == true {
                total += 1
                if !trimmed(application.childcareCostEstimate).isEmpty {
                    completed += 1
                }
            }

            return (completed, total)

        case .documentsChecklist:
            let visibleChecklistDocuments = SNAPDocumentType.allCases.filter { document in
                if document == .studentStatusDocuments {
                    return application.isCurrentlyEnrolledInHigherEducation == true
                        || application.studentStatus == .currentlyStudent
                }
                if document == .childcareCostProof {
                    return application.isResponsibleForDependentChild == true
                }
                if document == .immigrationDocumentsIfRelevant {
                    // No dedicated immigration relevance question exists yet in this prototype.
                    return false
                }
                return true
            }

            let total = visibleChecklistDocuments.count
            let selected = Set(application.documentsAvailable.map(\.id))
            let completed = visibleChecklistDocuments.filter { selected.contains($0.id) }.count
            return (completed, max(1, total))

        case .reviewDraft, .nextSteps:
            return (1, 1)
        }
    }
}
