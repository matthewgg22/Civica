import Foundation

@MainActor
final class SNAPApplicationViewModel: ObservableObject {
    enum DraftStepCompletionState {
        case complete
        case missingRequired
        case missingOptional
        case notStarted
    }

    enum ExpeditedScreeningResult {
        case mayNeedScreening
        case unclear
        case lessLikely

        var label: String {
            switch self {
            case .mayNeedScreening:
                return "May need expedited SNAP screening"
            case .unclear:
                return "Expedited screening unclear"
            case .lessLikely:
                return "Less likely based on these answers"
            }
        }
    }

    // EXPERIMENTAL SILOED MODULE:
    // All SNAP state is isolated here and remains in-memory only.
    // SNAP state is intentionally siloed from voter/civic profile state during prototype development.
    // Do not read from or write to voter registration, representative lookup, party preference,
    // election location, or shared civic profile stores from this view model.
    @Published var currentStep: SNAPRoute = .entry
    @Published var application = SNAPLegacyApplicationDraft()
    @Published var draftStep: SNAPDraftStep = .whereApplyingFrom
    @Published var eligibility = SNAPEligibilityDraft()
    @Published private(set) var geofencedStateCode: String?
    @Published private(set) var geofencedZIPCode: String?
    @Published var acceptedPrivacyNotice = false
    @Published private(set) var submittedAt: Date?
    @Published private(set) var hasStartedGuidedDraft = false
    @Published private(set) var hasViewedNextSteps = false
    @Published private(set) var hasAttemptedDraftContinue = false
    @Published private(set) var draftContinueAttemptToken = 0

    private let zipStateResolver = USZipStateResolver()
    private var hasTrackedReviewViewed = false
    private var hasTrackedAbandoned = false

    var hasStateZIPMismatch: Bool {
        guard let mismatchStateCode else { return false }
        return !mismatchStateCode.isEmpty
    }

    var stateZIPMismatchMessage: String? {
        guard let mismatchStateCode else { return nil }
        return "State and ZIP do not match. ZIP appears to be in \(mismatchStateCode). Please fix state or ZIP."
    }

    private var mismatchStateCode: String? {
        let state = trimmed(application.state).uppercased()
        let zip = trimmed(application.zipCode)
        guard state.count == 2, zip.count == 5 else { return nil }
        guard let inferredState = zipStateResolver.stateCode(for: zip)?.uppercased() else { return nil }
        return inferredState == state ? nil : inferredState
    }

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
        let questionnaireSteps = self.questionnaireSteps
        guard !questionnaireSteps.isEmpty else { return 0 }
        if draftStep == .nextSteps {
            return 1
        }
        guard let index = questionnaireSteps.firstIndex(of: draftStep) else { return 0 }
        return Double(index + 1) / Double(questionnaireSteps.count)
    }

    var draftStepNumberText: String {
        if draftStep == .nextSteps {
            return "Completion page"
        }
        let percent = Int((draftProgressFraction * 100).rounded())
        return "\(max(0, min(100, percent)))% Completed"
    }

    var completedDraftStepCount: Int {
        let questionnaireSteps = self.questionnaireSteps
        if draftStep == .nextSteps {
            return questionnaireSteps.count
        }
        guard let index = questionnaireSteps.firstIndex(of: draftStep) else { return 0 }
        return min(max(index + 1, 0), questionnaireSteps.count)
    }

    var totalDraftStepCount: Int {
        questionnaireSteps.count
    }

    var draftCompletionSummaryText: String {
        if draftStep == .nextSteps {
            return "Prep checklist completed"
        }
        let counts = currentDraftQuestionCounts
        if counts.total == 0 {
            return "No questions on this step"
        }
        return "\(counts.completed) out of \(counts.total) completed"
    }

    var draftStepHeaderTitle: String {
        switch draftStep {
        case .whereApplyingFrom:
            return "Where are you currently residing?"
        case .householdBasics:
            return "Your Food Household"
        case .applicantAge:
            return "Applicant age"
        case .addressContact:
            return "Contact information"
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

    var expeditedScreeningResult: ExpeditedScreeningResult {
        let grossIncome = firstAvailableAmount(
            application.expeditedGrossIncomeEstimate,
            application.monthlyIncomeEstimate
        )
        let liquidResources = amount(from: application.expeditedLiquidResourcesEstimate)
        let housingCost = firstAvailableAmount(
            application.expeditedHousingCostEstimate,
            application.rentOrHousingCost
        )
        let utilityCost = firstAvailableAmount(
            application.expeditedUtilityEstimate,
            application.utilitiesCost
        )
        let paysUtilities = application.expeditedPaysUtilities
        let migrantOrSeasonal = application.expeditedIsMigrantOrSeasonalFarmworker

        if migrantOrSeasonal == true {
            return .mayNeedScreening
        }

        if let grossIncome, let liquidResources,
           grossIncome <= 150, liquidResources <= 100 {
            return .mayNeedScreening
        }

        let effectiveUtilityCost: Double?
        if paysUtilities == false {
            effectiveUtilityCost = 0
        } else {
            effectiveUtilityCost = utilityCost
        }

        if let grossIncome, let liquidResources, let housingCost, let effectiveUtilityCost,
           (grossIncome + liquidResources) < (housingCost + effectiveUtilityCost) {
            return .mayNeedScreening
        }

        let missingCoreValues =
            grossIncome == nil
            || liquidResources == nil
            || housingCost == nil
            || (paysUtilities != false && effectiveUtilityCost == nil)

        if missingCoreValues || migrantOrSeasonal == nil {
            return .unclear
        }

        return .lessLikely
    }

    var interviewPrepSummaryText: String {
        let incomePart = displayCurrencyOrUnknown(
            firstAvailableAmount(
                application.expeditedGrossIncomeEstimate,
                application.monthlyIncomeEstimate
            )
        )
        let resourcesPart = displayCurrencyOrUnknown(amount(from: application.expeditedLiquidResourcesEstimate))
        let housingUtilitiesPart = displayCurrencyOrUnknown(
            combinedHousingAndUtilityEstimate()
        )
        let identityPart = yesNoNotSure(application.expeditedHasIdentityProofAvailable)

        return "I need expedited SNAP screening. My income this month is about \(incomePart). My cash/checking/savings is about \(resourcesPart). My housing and utility costs are about \(housingUtilitiesPart). I \(identityPart) proof of identity."
    }

    func completionState(for step: SNAPDraftStep) -> DraftStepCompletionState {
        switch step {
        case .whereApplyingFrom:
            let hasState = !trimmed(application.state).isEmpty
            let hasHousingStatus = application.housingStatus != nil
            let hasAddress = hasRequiredResidentialAddress
            if !hasState && !hasHousingStatus && !hasAddress { return .notStarted }
            guard hasState else { return .missingRequired }
            guard hasHousingStatus else { return .missingRequired }
            if shouldCollectResidentialAddress && !hasAddress {
                return .missingRequired
            }
            return .complete

        case .applicantAge:
            let hasAgeData = application.applicantDateOfBirth != nil || application.applicantAge != nil
            return hasAgeData ? .complete : .missingRequired

        case .householdBasics:
            let hasRequired = application.householdSize != nil
            let shouldAskMultiPersonFollowUps = (application.householdSize ?? 0) > 1
            let hasAnyOptional =
                (shouldAskMultiPersonFollowUps && (
                    application.buysAndPreparesFoodWithOthers != nil
                        || application.spouseLivesWithUser != nil
                        || application.childUnder22LivesWithParentInHome != nil
                        || application.childrenInHousehold != nil
                ))
                || application.anyoneAge60OrOlder != nil
                || application.anyoneWithDisability != nil
                || application.anyonePregnant != nil
                || application.anyoneUnhousedOrNoFixedMailingAddress != nil
                || application.preferredSafeMailingContactOption != nil
            if !hasRequired && !hasAnyOptional { return .notStarted }
            guard hasRequired else { return .missingRequired }
            let hasMissingOptional =
                (shouldAskMultiPersonFollowUps && (
                    application.buysAndPreparesFoodWithOthers == nil
                        || application.spouseLivesWithUser == nil
                        || application.childUnder22LivesWithParentInHome == nil
                        || application.childrenInHousehold == nil
                ))
                || application.anyoneAge60OrOlder == nil
                || application.anyoneWithDisability == nil
                || application.anyonePregnant == nil
                || application.anyoneUnhousedOrNoFixedMailingAddress == nil
                || (application.anyoneUnhousedOrNoFixedMailingAddress == .yes
                    && application.preferredSafeMailingContactOption == nil)
            return hasMissingOptional ? .missingOptional : .complete

        case .addressContact:
            let hasAnyContactInfo =
                application.preferredContactMethod != nil
                || !trimmed(application.contactEmail).isEmpty
                || !trimmed(application.contactPhone).isEmpty
            if !hasAnyContactInfo { return .missingOptional }
            return .complete

        case .income:
            let hasEmployment = application.employmentStatus != nil
            let hasMonthly = !trimmed(application.monthlyIncomeEstimate).isEmpty
            let hasIncomeChange = application.incomeChangesMonthToMonth != nil
            if !hasEmployment && !hasMonthly && !hasIncomeChange { return .notStarted }
            return (hasEmployment && hasMonthly && hasIncomeChange) ? .complete : .missingRequired

        case .studentStatus:
            guard let isStudent = application.isCurrentlyEnrolledInHigherEducation else {
                return .notStarted
            }
            guard isStudent else { return .complete }
            let hasRequired = application.isEnrolledAtLeastHalfTime != nil
                && application.worksAtLeastTwentyHoursPerWeek != nil
                && application.participatesInWorkStudy != nil
                && application.isResponsibleForDependentChild != nil
            return hasRequired ? .complete : .missingRequired

        case .expenses:
            let hasRent = !trimmed(application.rentOrHousingCost).isEmpty
            let hasUtilities = !trimmed(application.utilitiesCost).isEmpty
            let hasMedical = !trimmed(application.medicalExpensesEstimate).isEmpty
            let hasChildcare = !trimmed(application.childcareCostEstimate).isEmpty
            if !hasRent && !hasUtilities && !hasMedical && !hasChildcare { return .notStarted }
            guard hasRent && hasUtilities else { return .missingRequired }
            if application.isResponsibleForDependentChild == true && !hasChildcare {
                return .missingOptional
            }
            return hasMedical ? .complete : .missingOptional

        case .documentsChecklist:
            return application.documentsAvailable.isEmpty ? .missingOptional : .complete

        case .reviewDraft, .nextSteps:
            return .complete
        }
    }

    var isStateGeofenced: Bool {
        geofencedStateCode != nil
    }

    var isStateUsingPrefill: Bool {
        guard let geofencedStateCode else { return false }
        return trimmed(application.state).uppercased() == geofencedStateCode
    }

    var isZIPUsingPrefill: Bool {
        guard let geofencedZIPCode else { return false }
        return trimmed(application.residentialZIP) == geofencedZIPCode
    }

    var reviewItems: [SNAPReviewLineItem] {
        [
            SNAPReviewLineItem(label: "Household size", value: displayOptionalInt(application.householdSize)),
            SNAPReviewLineItem(label: "Applicant age", value: displayOptionalInt(application.applicantAge)),
            SNAPReviewLineItem(label: "State", value: displayOptionalString(application.state)),
            SNAPReviewLineItem(label: "City", value: displayString(application.residentialCity)),
            SNAPReviewLineItem(label: "ZIP code", value: displayString(application.residentialZIP)),
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
            SNAPReviewLineItem(label: "Preferred contact method", value: application.preferredContactMethod?.label ?? "Not provided"),
            SNAPReviewLineItem(label: "Contact email", value: displayString(application.contactEmail)),
            SNAPReviewLineItem(label: "Contact phone", value: displayString(application.contactPhone)),
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
        case .conversation:
            // Conversation flow manages its own continue/done state via the
            // backend pipeline; the wrapping router doesn't gate continuation.
            return true
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
        case .whereApplyingFrom:
            guard !trimmed(application.state).isEmpty else { return false }
            guard let housingStatus = application.housingStatus else { return false }
            if housingStatus == .unhoused { return true }
            return hasRequiredResidentialAddress
        case .applicantAge:
            return application.applicantDateOfBirth != nil || application.applicantAge != nil
        case .householdBasics:
            return application.householdSize != nil
        case .addressContact:
            // Contact information is optional in the prototype flow to avoid blocking progress.
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
        case .whereApplyingFrom:
            var missing: [String] = []
            if trimmed(application.state).isEmpty { missing.append("state") }
            if application.housingStatus == nil { missing.append("housing status") }
            if shouldCollectResidentialAddress {
                if trimmed(application.residentialCity).isEmpty { missing.append("city") }
                if trimmed(application.residentialZIP).isEmpty { missing.append("ZIP code") }
            }
            if !missing.isEmpty {
                return "To continue, add: \(missing.joined(separator: ", "))."
            }
            return nil
        case .applicantAge:
            let hasAgeData = application.applicantDateOfBirth != nil || application.applicantAge != nil
            return hasAgeData ? nil : "To continue, add: applicant age."
        case .householdBasics:
            var missing: [String] = []
            if application.householdSize == nil { missing.append("household size") }
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
                return "Please answer the enrollment question to continue."
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

    var questionnaireSteps: [SNAPDraftStep] {
        SNAPDraftStep.allCases.filter { $0 != .nextSteps }
    }

    func continueDraftFlow() {
        guard canContinueDraftStep else {
            if hasAttemptedDraftContinue {
                // Allow users to continue after warning shake on a second tap.
                advanceDraftFlow()
                return
            }
            hasAttemptedDraftContinue = true
            draftContinueAttemptToken += 1
            return
        }

        advanceDraftFlow()
    }

    private func advanceDraftFlow() {
        hasAttemptedDraftContinue = false
        draftContinueAttemptToken = 0
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
        draftContinueAttemptToken = 0
    }

    func resetDraftFlow() {
        draftStep = .whereApplyingFrom
        hasAttemptedDraftContinue = false
        draftContinueAttemptToken = 0
    }

    func jumpToDraftStep(_ step: SNAPDraftStep) {
        draftStep = step
        hasAttemptedDraftContinue = false
        draftContinueAttemptToken = 0
    }

    func updateHousingStatus(_ status: HousingStatus?) {
        application.housingStatus = status

        guard status == .unhoused else {
            application.expeditedCandidate = false
            application.expeditedReason = nil
            application.requiresPermanentAddress = true
            application.allowCollateralContact = false
            application.allowPostponedVerification = false
            application.isExpeditedPathActive = false
            application.choseRegularPathInsteadOfExpedited = false
            return
        }

        // Unhoused routing: create an expedited pathway candidate with no permanent-address blocker.
        application.expeditedCandidate = true
        application.expeditedReason = "unhoused"
        application.requiresPermanentAddress = false
        application.allowCollateralContact = true
        application.allowPostponedVerification = true
    }

    func startExpeditedPath() {
        application.isExpeditedPathActive = true
        application.choseRegularPathInsteadOfExpedited = false
    }

    func continueRegularApplicationPath() {
        application.isExpeditedPathActive = false
        application.choseRegularPathInsteadOfExpedited = true
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
        draftStep = .whereApplyingFrom
        eligibility = SNAPEligibilityDraft()
        application = SNAPLegacyApplicationDraft()
        if let geofencedStateCode {
            application.state = geofencedStateCode
        }
        acceptedPrivacyNotice = false
        submittedAt = nil
        hasStartedGuidedDraft = false
        hasViewedNextSteps = false
        hasAttemptedDraftContinue = false
        draftContinueAttemptToken = 0
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

        if normalizedZIP.count == 5 {
            geofencedZIPCode = normalizedZIP
        } else if trimmed(application.zipCode).isEmpty {
            geofencedZIPCode = nil
        }

        if trimmed(application.zipCode).isEmpty,
           normalizedZIP.count == 5 {
            application.zipCode = normalizedZIP
        }

        if trimmed(application.residentialZIP).isEmpty,
           normalizedZIP.count == 5 {
            application.residentialZIP = normalizedZIP
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

    private func amount(from text: String?) -> Double? {
        let cleaned = trimmed(text).filter { $0.isNumber || $0 == "." }
        guard let value = Double(cleaned), value >= 0 else { return nil }
        return value
    }

    private func firstAvailableAmount(_ values: String?...) -> Double? {
        for value in values {
            if let amount = amount(from: value) {
                return amount
            }
        }
        return nil
    }

    private func combinedHousingAndUtilityEstimate() -> Double? {
        let housing = firstAvailableAmount(
            application.expeditedHousingCostEstimate,
            application.rentOrHousingCost
        )
        let utilities = firstAvailableAmount(
            application.expeditedUtilityEstimate,
            application.utilitiesCost
        )
        let paysUtilities = application.expeditedPaysUtilities

        switch paysUtilities {
        case .some(false):
            guard let housing else { return nil }
            return housing
        case .some(true), .none:
            guard let housing, let utilities else { return nil }
            return housing + utilities
        }
    }

    private func displayCurrencyOrUnknown(_ amount: Double?) -> String {
        guard let amount else { return "unknown" }
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.maximumFractionDigits = 0
        formatter.minimumFractionDigits = 0
        return formatter.string(from: NSNumber(value: amount)) ?? "$0"
    }

    private func yesNoNotSure(_ value: Bool?) -> String {
        guard let value else { return "am not sure if I have" }
        return value ? "have" : "do not have"
    }

    private var currentDraftQuestionCounts: (completed: Int, total: Int) {
        switch draftStep {
        case .whereApplyingFrom:
            var total = 2
            var completed = 0
            if !trimmed(application.state).isEmpty { completed += 1 }
            if application.housingStatus != nil { completed += 1 }
            if shouldCollectResidentialAddress {
                total += 2
                if !trimmed(application.residentialCity).isEmpty { completed += 1 }
                if !trimmed(application.residentialZIP).isEmpty { completed += 1 }
            }
            return (completed, total)

        case .applicantAge:
            let total = 1
            let completed = (application.applicantDateOfBirth != nil || application.applicantAge != nil) ? 1 : 0
            return (completed, total)

        case .householdBasics:
            let shouldAskMultiPersonFollowUps = (application.householdSize ?? 0) > 1
            var total = shouldAskMultiPersonFollowUps ? 9 : 5
            var completed = 0
            if application.householdSize != nil { completed += 1 }
            if shouldAskMultiPersonFollowUps {
                if application.buysAndPreparesFoodWithOthers != nil { completed += 1 }
                if application.spouseLivesWithUser != nil { completed += 1 }
                if application.childUnder22LivesWithParentInHome != nil { completed += 1 }
                if application.childrenInHousehold != nil { completed += 1 }
            }
            if application.anyoneAge60OrOlder != nil { completed += 1 }
            if application.anyoneWithDisability != nil { completed += 1 }
            if application.anyonePregnant != nil { completed += 1 }
            if application.anyoneUnhousedOrNoFixedMailingAddress != nil {
                completed += 1
            }
            if application.anyoneUnhousedOrNoFixedMailingAddress == .yes {
                total += 1
                if application.preferredSafeMailingContactOption != nil {
                    completed += 1
                }
            }
            return (completed, total)

        case .addressContact:
            let total = 3
            var completed = 0
            if application.preferredContactMethod != nil { completed += 1 }
            if !trimmed(application.contactEmail).isEmpty { completed += 1 }
            if !trimmed(application.contactPhone).isEmpty { completed += 1 }
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
            let isWorkingOrUnableStatus: Bool = {
                switch application.employmentStatus {
                case .employedFullTime, .employedPartTime, .selfEmployed, .unableToWork:
                    return true
                default:
                    return false
                }
            }()

            let visibleChecklistDocuments = SNAPDocumentType.allCases.filter { document in
                if document == .studentStatusDocuments {
                    return application.isCurrentlyEnrolledInHigherEducation == true
                        || application.studentStatus == .currentlyStudent
                }
                if document == .workStatusOrExemptions {
                    return isWorkingOrUnableStatus
                        || application.anyoneWithDisability == .yes
                        || application.hasDisabilityInHousehold == true
                        || application.isResponsibleForDependentChild == true
                        || application.isCurrentlyEnrolledInHigherEducation == true
                }
                if document == .childcareCostProof || document == .immigrationDocumentsIfRelevant {
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

    private var shouldCollectResidentialAddress: Bool {
        guard let housingStatus = application.housingStatus else { return false }
        switch housingStatus {
        case .stableHome, .temporaryHousing, .stayingWithOthers:
            return true
        case .unhoused:
            return false
        }
    }

    private var hasRequiredResidentialAddress: Bool {
        !trimmed(application.residentialCity).isEmpty
            && !trimmed(application.residentialZIP).isEmpty
    }
}
