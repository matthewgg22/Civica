import Foundation
import Testing
@testable import VoteNow

struct SNAPPrivacyBoundaryTests {
    @Test func snapDraftDoesNotContainSSNFields() {
        let labels = draftFieldLabels()
        let ssnKeywords = ["ssn", "socialsecurity", "social_security"]

        let hasSSNField = labels.contains { label in
            ssnKeywords.contains { keyword in label.contains(keyword) }
        }
        #expect(!hasSSNField)
    }

    @Test func snapDraftDoesNotContainBankAccountFields() {
        let labels = draftFieldLabels()
        let bankKeywords = ["bank_account", "bankaccount", "account_number", "accountnumber", "routing_number", "routingnumber", "iban"]

        let hasBankField = labels.contains { label in
            bankKeywords.contains { keyword in label.contains(keyword) }
        }
        #expect(!hasBankField)
    }

    @Test func snapDraftDoesNotContainDocumentImageFields() {
        let labels = draftFieldLabels()
        let documentImageKeywords = ["document_image", "documentimage", "upload", "image_data", "imagedata", "photo_data", "photodata"]

        let hasDocumentImageField = labels.contains { label in
            documentImageKeywords.contains { keyword in label.contains(keyword) }
        }
        #expect(!hasDocumentImageField)
    }

    @MainActor
    @Test func resetDraftClearsInMemoryValues() {
        let viewModel = SNAPApplicationViewModel()
        viewModel.currentStep = .confirmation
        viewModel.draftStep = .nextSteps
        viewModel.acceptedPrivacyNotice = true
        viewModel.eligibility = SNAPEligibilityDraft(
            isMassachusettsResident: true,
            isStudent: true,
            householdSizeText: "3",
            monthlyIncomeEstimateText: "2300"
        )

        viewModel.application.householdSize = 3
        viewModel.application.applicantAge = 28
        // CA is the launch state; reset behavior is state-agnostic
        // but the fixture follows the launch state by default. MA
        // reset coverage lives in MAStateRulesTests and the
        // SNAPLocalEligibilityEvaluatorTests MA case.
        viewModel.application.state = "CA"
        viewModel.application.zipCode = "94102"
        viewModel.application.housingStatus = .stableHome
        viewModel.application.studentStatus = .currentlyStudent
        viewModel.application.isCurrentlyEnrolledInHigherEducation = true
        viewModel.application.isEnrolledAtLeastHalfTime = true
        viewModel.application.worksAtLeastTwentyHoursPerWeek = true
        viewModel.application.participatesInWorkStudy = false
        viewModel.application.isResponsibleForDependentChild = false
        viewModel.application.monthlyIncomeEstimate = "2200"
        viewModel.application.incomeChangesMonthToMonth = true
        viewModel.application.employmentStatus = .employedPartTime
        viewModel.application.rentOrHousingCost = "1100"
        viewModel.application.utilitiesCost = "180"
        viewModel.application.childcareCostEstimate = "0"
        viewModel.application.medicalExpensesEstimate = "40"
        viewModel.application.hasChildren = false
        viewModel.application.hasDisabilityInHousehold = false
        viewModel.application.isSeniorHousehold = false
        viewModel.application.preferredContactMethod = .text
        viewModel.application.documentsAvailable = [.photoID, .proofOfIncome]

        viewModel.markStarted()
        viewModel.markReviewViewed()
        viewModel.markNextStepsViewed()
        viewModel.submitMockPacket()

        viewModel.resetDraft()

        #expect(viewModel.currentStep == .entry)
        #expect(viewModel.draftStep == .whereApplyingFrom)
        #expect(viewModel.acceptedPrivacyNotice == false)
        #expect(viewModel.submittedAt == nil)
        #expect(viewModel.hasStartedGuidedDraft == false)
        #expect(viewModel.hasViewedNextSteps == false)
        #expect(viewModel.eligibility.isMassachusettsResident == nil)
        #expect(viewModel.eligibility.isStudent == nil)
        #expect(viewModel.eligibility.householdSizeText.isEmpty)
        #expect(viewModel.eligibility.monthlyIncomeEstimateText.isEmpty)

        let draft = viewModel.application
        #expect(draft.householdSize == nil)
        #expect(draft.applicantAge == nil)
        #expect(draft.state == nil)
        #expect(draft.zipCode == nil)
        #expect(draft.housingStatus == nil)
        #expect(draft.studentStatus == nil)
        #expect(draft.isCurrentlyEnrolledInHigherEducation == nil)
        #expect(draft.isEnrolledAtLeastHalfTime == nil)
        #expect(draft.worksAtLeastTwentyHoursPerWeek == nil)
        #expect(draft.participatesInWorkStudy == nil)
        #expect(draft.isResponsibleForDependentChild == nil)
        #expect(draft.monthlyIncomeEstimate.isEmpty)
        #expect(draft.incomeChangesMonthToMonth == nil)
        #expect(draft.employmentStatus == nil)
        #expect(draft.rentOrHousingCost.isEmpty)
        #expect(draft.utilitiesCost.isEmpty)
        #expect(draft.childcareCostEstimate.isEmpty)
        #expect(draft.medicalExpensesEstimate.isEmpty)
        #expect(draft.hasChildren == nil)
        #expect(draft.hasDisabilityInHousehold == nil)
        #expect(draft.isSeniorHousehold == nil)
        #expect(draft.preferredContactMethod == nil)
        #expect(draft.documentsAvailable.isEmpty)
    }

    @MainActor
    @Test func locationPrefillOnlyFillsMissingStateAndZIP() {
        let viewModel = SNAPApplicationViewModel()

        viewModel.applyLocationPrefill(stateCode: "ma", zipCode: "02111-1234")
        #expect(viewModel.application.state == "MA")
        #expect(viewModel.application.zipCode == "02111")

        viewModel.application.state = "NY"
        viewModel.application.zipCode = "10001"
        viewModel.applyLocationPrefill(stateCode: "CA", zipCode: "94102")
        #expect(viewModel.application.state == "NY")
        #expect(viewModel.application.zipCode == "10001")
    }

    @MainActor
    @Test func selectingUnhousedSetsExpeditedCandidateFlags() {
        let viewModel = SNAPApplicationViewModel()

        viewModel.updateHousingStatus(.unhoused)

        #expect(viewModel.application.housingStatus == .unhoused)
        #expect(viewModel.application.expeditedCandidate == true)
        #expect(viewModel.application.expeditedReason == "unhoused")
        #expect(viewModel.application.requiresPermanentAddress == false)
        #expect(viewModel.application.allowCollateralContact == true)
        #expect(viewModel.application.allowPostponedVerification == true)
    }

    @MainActor
    @Test func selectingStableHousingDoesNotSetExpeditedCandidateFromHousingOnly() {
        let viewModel = SNAPApplicationViewModel()

        viewModel.updateHousingStatus(.stableHome)

        #expect(viewModel.application.housingStatus == .stableHome)
        #expect(viewModel.application.expeditedCandidate == false)
        #expect(viewModel.application.expeditedReason == nil)
        #expect(viewModel.application.requiresPermanentAddress == true)
    }

    @MainActor
    @Test func unhousedDoesNotRequirePermanentAddress() {
        let viewModel = SNAPApplicationViewModel()
        viewModel.updateHousingStatus(.unhoused)

        #expect(viewModel.application.requiresPermanentAddress == false)
        #expect(viewModel.canContinueDraftStep == false)

        viewModel.application.state = "MA"
        #expect(viewModel.canContinueDraftStep == true)
    }

    @MainActor
    @Test func userCanChooseRegularApplicationInsteadOfExpeditedPath() {
        let viewModel = SNAPApplicationViewModel()
        viewModel.updateHousingStatus(.unhoused)

        viewModel.startExpeditedPath()
        #expect(viewModel.application.isExpeditedPathActive == true)
        #expect(viewModel.application.choseRegularPathInsteadOfExpedited == false)

        viewModel.continueRegularApplicationPath()
        #expect(viewModel.application.isExpeditedPathActive == false)
        #expect(viewModel.application.choseRegularPathInsteadOfExpedited == true)
    }

    @Test func analyticsPayloadOnlyUsesAllowedKeysAndNoAnswers() {
        let payload = SNAPAnalytics.makeParameters(stepName: "income", stepIndex: 3)
        let keys = Set(payload.keys)

        #expect(keys.isSubset(of: SNAPAnalytics.allowedParameterKeys))
        #expect(keys == Set(["step_name", "step_index"]))

        let disallowedAnswerKeys = [
            "name",
            "address",
            "zip",
            "zip_code",
            "income",
            "household_size",
            "student_status",
            "ssn",
            "bank_account"
        ]

        for key in disallowedAnswerKeys {
            #expect(!keys.contains(key))
        }

        for draftField in draftFieldLabels() {
            #expect(!keys.contains(draftField))
        }
    }

    @Test func snapModuleDoesNotDependOnVoterProfileModels() throws {
        let snapDirectory = repositoryRoot()
            .appendingPathComponent("WeVote Information Page")
            .appendingPathComponent("Features")
            .appendingPathComponent("SNAP")

        let swiftFiles = try FileManager.default.contentsOfDirectory(
            at: snapDirectory,
            includingPropertiesForKeys: nil
        ).filter { $0.pathExtension == "swift" }

        let forbiddenModelReferences = [
            "myrepsviewmodel",
            "repsdata",
            "voterprofile",
            "voterregistrationmodel",
            "registrationaddress",
            "representativelookup",
            "partypreference",
            "electionlocation",
            "pollingplace"
        ]

        for fileURL in swiftFiles {
            let source = try String(contentsOf: fileURL, encoding: .utf8)
            let normalized = normalizedSourceForDependencyScan(source)

            for forbidden in forbiddenModelReferences {
                #expect(!normalized.contains(forbidden))
            }
        }
    }

    private func draftFieldLabels() -> [String] {
        Mirror(reflecting: SNAPApplicationDraft())
            .children
            .compactMap(\.label)
            .map { $0.lowercased() }
    }

    private func repositoryRoot() -> URL {
        URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
    }

    private func normalizedSourceForDependencyScan(_ source: String) -> String {
        let withoutLineComments = source
            .split(separator: "\n", omittingEmptySubsequences: false)
            .map { line -> String in
                let text = String(line)
                guard let commentRange = text.range(of: "//") else { return text }
                return String(text[..<commentRange.lowerBound])
            }
            .joined(separator: "\n")

        let withoutStringLiterals = withoutLineComments.replacingOccurrences(
            of: "\"(?:\\\\.|[^\"\\\\])*\"",
            with: "\"\"",
            options: .regularExpression
        )

        return withoutStringLiterals.lowercased()
    }
}
