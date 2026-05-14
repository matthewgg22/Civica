import Foundation
import Testing
@testable import Civica

// Tests for the SNAPDraftPatchProducing protocol helpers and the
// per-step @Generable extraction structs. Protocol helpers run on all
// OS versions; extraction structs are iOS 26+ and guarded accordingly.

struct SNAPVoiceExtractionTests {

    // MARK: - Protocol helper conformer

    // Minimal concrete type to exercise the protocol extension methods
    // without requiring iOS 26 or @Generable.
    private struct NoopPatch: SNAPDraftPatchProducing {
        func apply(to draft: inout SNAPApplicationDraft, confidence: inout [SNAPFieldKey: Double]) {}
    }

    private let patch = NoopPatch()

    // MARK: - decimalCurrency

    @Test func decimalCurrencyConvertsInRangeValue() {
        let result = patch.decimalCurrency(1_500.0, clampingTo: 0...100_000)
        #expect(result == Decimal(1_500))
    }

    @Test func decimalCurrencyClampsBelowMin() {
        let result = patch.decimalCurrency(-50.0, clampingTo: 0...100_000)
        #expect(result == Decimal(0))
    }

    @Test func decimalCurrencyClampAboveMax() {
        let result = patch.decimalCurrency(200_000.0, clampingTo: 0...100_000)
        #expect(result == Decimal(100_000))
    }

    @Test func decimalCurrencyReturnsNilForNilInput() {
        let result = patch.decimalCurrency(nil, clampingTo: 0...100_000)
        #expect(result == nil)
    }

    // MARK: - record

    @Test func recordClampsBelowZero() {
        var confidence: [SNAPFieldKey: Double] = [:]
        patch.record(-0.3, for: .stateCode, in: &confidence)
        #expect(confidence[.stateCode] == 0.0)
    }

    @Test func recordClampsAboveOne() {
        var confidence: [SNAPFieldKey: Double] = [:]
        patch.record(1.5, for: .stateCode, in: &confidence)
        #expect(confidence[.stateCode] == 1.0)
    }

    @Test func recordStoresValidConfidence() {
        var confidence: [SNAPFieldKey: Double] = [:]
        patch.record(0.85, for: .householdSize, in: &confidence)
        #expect(confidence[.householdSize] == 0.85)
    }

    @Test func recordSkipsNilConfidence() {
        var confidence: [SNAPFieldKey: Double] = [.stateCode: 0.9]
        patch.record(nil, for: .stateCode, in: &confidence)
        #expect(confidence[.stateCode] == 0.9) // unchanged
    }

    // MARK: - assign

    @Test func assignWritesNonNilValue() {
        var draft = SNAPApplicationDraft()
        patch.assign(true, to: \.household.hasMinorInHousehold, in: &draft)
        #expect(draft.household.hasMinorInHousehold == true)
    }

    @Test func assignSkipsNilDoesNotOverwriteExistingValue() {
        var draft = SNAPApplicationDraft()
        draft.household.hasMinorInHousehold = true
        patch.assign(nil as Bool?, to: \.household.hasMinorInHousehold, in: &draft)
        #expect(draft.household.hasMinorInHousehold == true)
    }

    // MARK: - assignNonEmpty

    @Test func assignNonEmptyWritesNonEmptyString() {
        var draft = SNAPApplicationDraft()
        patch.assignNonEmpty("CA", to: \.whereApplying.stateCode, in: &draft)
        #expect(draft.whereApplying.stateCode == "CA")
    }

    @Test func assignNonEmptySkipsEmptyString() {
        var draft = SNAPApplicationDraft()
        draft.whereApplying.stateCode = "MA"
        patch.assignNonEmpty("", to: \.whereApplying.stateCode, in: &draft)
        #expect(draft.whereApplying.stateCode == "MA")
    }

    @Test func assignNonEmptySkipsWhitespaceOnlyString() {
        var draft = SNAPApplicationDraft()
        draft.whereApplying.stateCode = "NY"
        patch.assignNonEmpty("   ", to: \.whereApplying.stateCode, in: &draft)
        #expect(draft.whereApplying.stateCode == "NY")
    }

    @Test func assignNonEmptySkipsNil() {
        var draft = SNAPApplicationDraft()
        draft.whereApplying.stateCode = "TX"
        patch.assignNonEmpty(nil, to: \.whereApplying.stateCode, in: &draft)
        #expect(draft.whereApplying.stateCode == "TX")
    }

    // MARK: - SNAPVoiceConfidence thresholds

    @Test func needsReviewThresholdIsSevenTenths() {
        #expect(SNAPVoiceConfidence.needsReviewThreshold == 0.7)
    }

    @Test func distressSignalThresholdIsSixTenths() {
        #expect(SNAPVoiceConfidence.distressSignalThreshold == 0.6)
    }

    // MARK: - SNAPFieldKey coverage

    @Test func fieldKeyCoversAllVoiceFillableFields() {
        // Ensures no field silently loses its key if SNAPApplicationDraft
        // gains new sections. Update the expected count when new fields
        // are added to the voice-fillable surface.
        let expectedMinimumCount = 22
        #expect(SNAPFieldKey.allCases.count >= expectedMinimumCount)
    }

    // MARK: - Per-step extraction (iOS 26+)

    @Test func whereApplyingExtractionAppliesStateAndHousing() {
        guard #available(iOS 26.0, *) else { return }
        var extraction = WhereApplyingFromExtraction()
        extraction.state = "CA"
        extraction.stateConfidence = 0.95
        extraction.housingStatus = .stableHome
        extraction.housingStatusConfidence = 0.8

        var draft = SNAPApplicationDraft()
        var confidence: [SNAPFieldKey: Double] = [:]
        extraction.apply(to: &draft, confidence: &confidence)

        #expect(draft.whereApplying.stateCode == "CA")
        #expect(draft.whereApplying.housingStatus == .stableHome)
        #expect(confidence[.stateCode] == 0.95)
        #expect(confidence[.housingStatus] == 0.8)
    }

    @Test func whereApplyingExtractionSkipsNilState() {
        guard #available(iOS 26.0, *) else { return }
        var extraction = WhereApplyingFromExtraction()
        extraction.state = nil

        var draft = SNAPApplicationDraft()
        draft.whereApplying.stateCode = "TX"
        var confidence: [SNAPFieldKey: Double] = [:]
        extraction.apply(to: &draft, confidence: &confidence)

        #expect(draft.whereApplying.stateCode == "TX") // unchanged
    }

    @Test func householdBasicsExtractionAppliesAllFields() {
        guard #available(iOS 26.0, *) else { return }
        var extraction = HouseholdBasicsExtraction()
        extraction.householdSize = "4"
        extraction.householdSizeConfidence = 1.0
        extraction.hasMinorInHousehold = true
        extraction.hasMinorInHouseholdConfidence = 0.9
        extraction.hasElderlyOrDisabled = false
        extraction.hasElderlyOrDisabledConfidence = 0.75

        var draft = SNAPApplicationDraft()
        var confidence: [SNAPFieldKey: Double] = [:]
        extraction.apply(to: &draft, confidence: &confidence)

        #expect(draft.household.householdSize == "4")
        #expect(draft.household.hasMinorInHousehold == true)
        #expect(draft.household.hasElderlyOrDisabled == false)
        #expect(confidence[.householdSize] == 1.0)
        #expect(confidence[.hasMinorInHousehold] == 0.9)
        #expect(confidence[.hasElderlyOrDisabled] == 0.75)
    }

    @Test func incomeExtractionConvertsDoubleToDecimalAndClamps() {
        guard #available(iOS 26.0, *) else { return }
        var extraction = IncomeExtraction()
        extraction.grossMonthlyIncome = 3_200.50
        extraction.grossMonthlyIncomeConfidence = 0.88
        extraction.anyoneEarning = .yes
        extraction.hasUnearnedIncome = .no
        extraction.incomeChangesMonthToMonth = .notSure

        var draft = SNAPApplicationDraft()
        var confidence: [SNAPFieldKey: Double] = [:]
        extraction.apply(to: &draft, confidence: &confidence)

        #expect(draft.income.grossMonthlyIncome == Decimal(3_200.50))
        #expect(draft.income.anyoneEarning == .yes)
        #expect(draft.income.hasUnearnedIncome == .no)
        #expect(draft.income.incomeChangesMonthToMonth == .notSure)
        #expect(confidence[.grossMonthlyIncome] == 0.88)
    }

    @Test func incomeExtractionClampsAboveMaxToHundredThousand() {
        guard #available(iOS 26.0, *) else { return }
        var extraction = IncomeExtraction()
        extraction.grossMonthlyIncome = 999_999.0

        var draft = SNAPApplicationDraft()
        var confidence: [SNAPFieldKey: Double] = [:]
        extraction.apply(to: &draft, confidence: &confidence)

        #expect(draft.income.grossMonthlyIncome == Decimal(100_000))
    }

    @Test func expensesExtractionAppliesAllFourFields() {
        guard #available(iOS 26.0, *) else { return }
        var extraction = ExpensesExtraction()
        extraction.monthlyRentOrHousing = 1_800
        extraction.monthlyRentOrHousingConfidence = 0.9
        extraction.monthlyUtilities = 120
        extraction.monthlyChildcare = 450
        extraction.monthlyMedical = 60

        var draft = SNAPApplicationDraft()
        var confidence: [SNAPFieldKey: Double] = [:]
        extraction.apply(to: &draft, confidence: &confidence)

        #expect(draft.expenses.monthlyRentOrHousing == Decimal(1_800))
        #expect(draft.expenses.monthlyUtilities == Decimal(120))
        #expect(draft.expenses.monthlyChildcare == Decimal(450))
        #expect(draft.expenses.monthlyMedical == Decimal(60))
        #expect(confidence[.monthlyRentOrHousing] == 0.9)
    }

    @Test func expensesExtractionSkipsNilFields() {
        guard #available(iOS 26.0, *) else { return }
        var extraction = ExpensesExtraction()
        extraction.monthlyRentOrHousing = nil
        extraction.monthlyUtilities = nil
        extraction.monthlyChildcare = nil
        extraction.monthlyMedical = nil

        var draft = SNAPApplicationDraft()
        var confidence: [SNAPFieldKey: Double] = [:]
        extraction.apply(to: &draft, confidence: &confidence)

        #expect(draft.expenses.monthlyRentOrHousing == nil)
        #expect(draft.expenses.monthlyUtilities == nil)
        #expect(draft.expenses.monthlyChildcare == nil)
        #expect(draft.expenses.monthlyMedical == nil)
    }

    @Test func studentStatusExtractionAppliesAllFiveFlags() {
        guard #available(iOS 26.0, *) else { return }
        var extraction = StudentStatusExtraction()
        extraction.enrolledInHigherEd = true
        extraction.enrolledInHigherEdConfidence = 0.95
        extraction.enrolledHalfTime = true
        extraction.works20PlusHours = false
        extraction.inWorkStudy = false
        extraction.responsibleForDependentChild = true

        var draft = SNAPApplicationDraft()
        var confidence: [SNAPFieldKey: Double] = [:]
        extraction.apply(to: &draft, confidence: &confidence)

        #expect(draft.studentStatus.enrolledInHigherEd == true)
        #expect(draft.studentStatus.enrolledHalfTime == true)
        #expect(draft.studentStatus.works20PlusHours == false)
        #expect(draft.studentStatus.inWorkStudy == false)
        #expect(draft.studentStatus.responsibleForDependentChild == true)
        #expect(confidence[.enrolledInHigherEd] == 0.95)
    }

    @Test func documentsChecklistExtractionInsertsIntoSet() {
        guard #available(iOS 26.0, *) else { return }
        var extraction = DocumentsChecklistExtraction()
        extraction.documentsAvailable = [.photoID, .proofOfIncome]
        extraction.documentsAvailableConfidence = 0.8

        var draft = SNAPApplicationDraft()
        var confidence: [SNAPFieldKey: Double] = [:]
        extraction.apply(to: &draft, confidence: &confidence)

        #expect(draft.documentsChecklist.documentsAvailable.contains(.photoID))
        #expect(draft.documentsChecklist.documentsAvailable.contains(.proofOfIncome))
        #expect(draft.documentsChecklist.documentsAvailable.count == 2)
        #expect(confidence[.documentsAvailable] == 0.8)
    }

    @Test func documentsChecklistExtractionSkipsEmptyArray() {
        guard #available(iOS 26.0, *) else { return }
        var extraction = DocumentsChecklistExtraction()
        extraction.documentsAvailable = []

        var draft = SNAPApplicationDraft()
        draft.documentsChecklist.documentsAvailable = [.photoID]
        var confidence: [SNAPFieldKey: Double] = [:]
        extraction.apply(to: &draft, confidence: &confidence)

        #expect(draft.documentsChecklist.documentsAvailable == [.photoID]) // unchanged
    }

    @Test func applicantAgeExtractionClampsToValidRange() {
        guard #available(iOS 26.0, *) else { return }
        var tooYoung = ApplicantAgeExtraction()
        tooYoung.applicantAge = 5

        var draft = SNAPApplicationDraft()
        var confidence: [SNAPFieldKey: Double] = [:]
        tooYoung.apply(to: &draft, confidence: &confidence)

        // Clamped to 14 — DOB should be ~14 years ago
        let age = Calendar.current.dateComponents([.year], from: draft.applicantAge.dateOfBirth!, to: Date()).year ?? 0
        #expect(age == 14)
    }

    @Test func reviewAndNextStepsExtractionAreNoops() {
        guard #available(iOS 26.0, *) else { return }
        var draft = SNAPApplicationDraft()
        draft.whereApplying.stateCode = "CA"
        let originalDraft = draft
        var confidence: [SNAPFieldKey: Double] = [:]

        ReviewDraftExtraction().apply(to: &draft, confidence: &confidence)
        NextStepsExtraction().apply(to: &draft, confidence: &confidence)

        #expect(draft == originalDraft)
        #expect(confidence.isEmpty)
    }
}
