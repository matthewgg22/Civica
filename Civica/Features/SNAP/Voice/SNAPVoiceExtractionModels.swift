import Foundation
import FoundationModels

// Per-step @Generable extraction schemas for voice-first SNAP intake.
// FoundationModels (iOS 26) cannot @Generable the production enums in
// SNAPModels.swift without modifying that file, so each constrained
// choice is mirrored here as an @Generable enum with a toModelEnum()
// extension. When the production model stabilizes, the mirrors should
// fold back into the production enums via direct @Generable annotation.
//
// Schemas are intentionally shrunken to match Civica's grouped Answers
// structs — the LLM only extracts fields the typed flow actually stores.

// MARK: - Mirror enums

@available(iOS 26.0, *)
@Generable
enum HousingStatusGen: String {
    case stableHome
    case temporaryHousing
    case stayingWithOthers
    case unhoused

    func toModelEnum() -> HousingStatus {
        switch self {
        case .stableHome: return .stableHome
        case .temporaryHousing: return .temporaryHousing
        case .stayingWithOthers: return .stayingWithOthers
        case .unhoused: return .unhoused
        }
    }
}

@available(iOS 26.0, *)
@Generable
enum PreferredContactMethodGen: String {
    case phone
    case text
    case email
    case mail

    func toModelEnum() -> PreferredContactMethod {
        switch self {
        case .phone: return .phone
        case .text: return .text
        case .email: return .email
        case .mail: return .mail
        }
    }
}

@available(iOS 26.0, *)
@Generable
enum SNAPDocumentTypeGen: String {
    case photoID
    case proofOfAddress
    case proofOfIncome
    case rentOrHousingCostProof
    case utilityBill
    case studentStatusDocuments
    case workStatusOrExemptions
    case childcareCostProof
    case immigrationDocumentsIfRelevant

    func toModelEnum() -> SNAPDocumentType {
        switch self {
        case .photoID: return .photoID
        case .proofOfAddress: return .proofOfAddress
        case .proofOfIncome: return .proofOfIncome
        case .rentOrHousingCostProof: return .rentOrHousingCostProof
        case .utilityBill: return .utilityBill
        case .studentStatusDocuments: return .studentStatusDocuments
        case .workStatusOrExemptions: return .workStatusOrExemptions
        case .childcareCostProof: return .childcareCostProof
        case .immigrationDocumentsIfRelevant: return .immigrationDocumentsIfRelevant
        }
    }
}

// SNAPIncomeAnswers carries its own local Tri enum distinct from the
// package-level SNAPTernaryChoice. Income extraction maps through here.
@available(iOS 26.0, *)
@Generable
enum IncomeTernaryGen: String {
    case yes
    case no
    case notSure

    func toModelEnum() -> SNAPIncomeAnswers.Tri {
        switch self {
        case .yes: return .yes
        case .no: return .no
        case .notSure: return .notSure
        }
    }
}

// MARK: - Cross-cutting distress signals

@available(iOS 26.0, *)
@Generable
struct DistressSignalExtraction {
    @Guide(description: "Speaker mentioned no food, going hungry, or running out of food today")
    var noFoodToday: Bool

    @Guide(description: "Speaker mentioned no money or no income this month")
    var noIncomeThisMonth: Bool

    @Guide(description: "Speaker mentioned eviction, shelter, sleeping in car, or being unhoused")
    var unstableHousing: Bool

    @Guide(description: "Speaker mentioned children in the household without food")
    var childrenWithoutFood: Bool

    @Guide(description: "Overall confidence 0.0 to 1.0 in the presence of any distress signal above")
    var confidence: Double
}

// MARK: - Per-step extraction structs

@available(iOS 26.0, *)
@Generable
struct WhereApplyingFromExtraction: SNAPDraftPatchProducing {
    @Guide(description: "Two-letter US state abbreviation, e.g. MA, NY, CA. Nil if not stated.")
    var state: String?
    var stateConfidence: Double?

    @Guide(description: "Housing situation category")
    var housingStatus: HousingStatusGen?
    var housingStatusConfidence: Double?

    func apply(to draft: inout SNAPApplicationDraft, confidence: inout [SNAPFieldKey: Double]) {
        assignNonEmpty(state, to: \.whereApplying.stateCode, in: &draft)
        record(stateConfidence, for: .stateCode, in: &confidence)

        if let housingStatus {
            draft.whereApplying.housingStatus = housingStatus.toModelEnum()
            record(housingStatusConfidence, for: .housingStatus, in: &confidence)
        }
    }
}

@available(iOS 26.0, *)
@Generable
struct HouseholdBasicsExtraction: SNAPDraftPatchProducing {
    @Guide(description: "Total number of people in the food household as a short label, e.g. \"1\", \"2\", \"3-4\", \"5+\". Always include the speaker. Nil if not stated.")
    var householdSize: String?
    var householdSizeConfidence: Double?

    @Guide(description: "Are there any children under 18 in the household?")
    var hasMinorInHousehold: Bool?
    var hasMinorInHouseholdConfidence: Double?

    // OBBBA §10102(a): only relevant when hasMinorInHousehold is true.
    @Guide(description: "Are any of those children under 14? Only extract when hasMinorInHousehold is true.")
    var hasChildUnder14InHousehold: Bool?
    var hasChildUnder14InHouseholdConfidence: Double?

    @Guide(description: "Is anyone in the household elderly (60+) or has a disability?")
    var hasElderlyOrDisabled: Bool?
    var hasElderlyOrDisabledConfidence: Double?

    func apply(to draft: inout SNAPApplicationDraft, confidence: inout [SNAPFieldKey: Double]) {
        assignNonEmpty(householdSize, to: \.household.householdSize, in: &draft)
        record(householdSizeConfidence, for: .householdSize, in: &confidence)

        assign(hasMinorInHousehold, to: \.household.hasMinorInHousehold, in: &draft)
        record(hasMinorInHouseholdConfidence, for: .hasMinorInHousehold, in: &confidence)

        assign(hasChildUnder14InHousehold, to: \.household.hasChildUnder14InHousehold, in: &draft)
        record(hasChildUnder14InHouseholdConfidence, for: .hasChildUnder14InHousehold, in: &confidence)

        assign(hasElderlyOrDisabled, to: \.household.hasElderlyOrDisabled, in: &draft)
        record(hasElderlyOrDisabledConfidence, for: .hasElderlyOrDisabled, in: &confidence)
    }
}

@available(iOS 26.0, *)
@Generable
struct ApplicantAgeExtraction: SNAPDraftPatchProducing {
    @Guide(description: "Speaker's age in years. Range 14 to 110.")
    var applicantAge: Int?
    var applicantAgeConfidence: Double?

    func apply(to draft: inout SNAPApplicationDraft, confidence: inout [SNAPFieldKey: Double]) {
        // Civica stores DOB, not age. Approximate by subtracting years from today;
        // the typed flow re-derives age from DOB the same way (Calendar dateComponents).
        guard let applicantAge else { return }
        let clamped = max(14, min(110, applicantAge))
        guard let dob = Calendar.current.date(byAdding: .year, value: -clamped, to: Date()) else { return }
        draft.applicantAge.dateOfBirth = dob
        record(applicantAgeConfidence, for: .dateOfBirth, in: &confidence)
    }
}

@available(iOS 26.0, *)
@Generable
struct AddressContactExtraction: SNAPDraftPatchProducing {
    @Guide(description: "Email address. Nil if not stated.")
    var contactEmail: String?
    var contactEmailConfidence: Double?

    @Guide(description: "Phone number, digits only. Nil if not stated.")
    var contactPhone: String?
    var contactPhoneConfidence: Double?

    @Guide(description: "Preferred contact method")
    var preferredContactMethod: PreferredContactMethodGen?
    var preferredContactMethodConfidence: Double?

    func apply(to draft: inout SNAPApplicationDraft, confidence: inout [SNAPFieldKey: Double]) {
        assignNonEmpty(contactEmail, to: \.contact.email, in: &draft)
        record(contactEmailConfidence, for: .email, in: &confidence)

        assignNonEmpty(contactPhone, to: \.contact.phone, in: &draft)
        record(contactPhoneConfidence, for: .phone, in: &confidence)

        if let preferredContactMethod {
            draft.contact.preferredMethod = preferredContactMethod.toModelEnum()
            record(preferredContactMethodConfidence, for: .preferredMethod, in: &confidence)
        }
    }
}

@available(iOS 26.0, *)
@Generable
struct IncomeExtraction: SNAPDraftPatchProducing {
    @Guide(description: "Is anyone in the household currently earning money from a job or self-employment?")
    var anyoneEarning: IncomeTernaryGen?
    var anyoneEarningConfidence: Double?

    @Guide(description: "Total gross monthly income in US dollars from all earned sources. Range 0 to 100000.")
    var grossMonthlyIncome: Double?
    var grossMonthlyIncomeConfidence: Double?

    @Guide(description: "Does income change month to month?")
    var incomeChangesMonthToMonth: IncomeTernaryGen?
    var incomeChangesMonthToMonthConfidence: Double?

    @Guide(description: "Does the household receive any unearned income such as unemployment, social security, child support, or VA benefits?")
    var hasUnearnedIncome: IncomeTernaryGen?
    var hasUnearnedIncomeConfidence: Double?

    func apply(to draft: inout SNAPApplicationDraft, confidence: inout [SNAPFieldKey: Double]) {
        if let anyoneEarning {
            draft.income.anyoneEarning = anyoneEarning.toModelEnum()
            record(anyoneEarningConfidence, for: .anyoneEarning, in: &confidence)
        }
        if let gross = decimalCurrency(grossMonthlyIncome, clampingTo: 0...100_000) {
            draft.income.grossMonthlyIncome = gross
            record(grossMonthlyIncomeConfidence, for: .grossMonthlyIncome, in: &confidence)
        }
        if let incomeChangesMonthToMonth {
            draft.income.incomeChangesMonthToMonth = incomeChangesMonthToMonth.toModelEnum()
            record(incomeChangesMonthToMonthConfidence, for: .incomeChangesMonthToMonth, in: &confidence)
        }
        if let hasUnearnedIncome {
            draft.income.hasUnearnedIncome = hasUnearnedIncome.toModelEnum()
            record(hasUnearnedIncomeConfidence, for: .hasUnearnedIncome, in: &confidence)
        }
    }
}

@available(iOS 26.0, *)
@Generable
struct StudentStatusExtraction: SNAPDraftPatchProducing {
    @Guide(description: "Currently enrolled in higher education (college, university, vocational program)?")
    var enrolledInHigherEd: Bool?
    var enrolledInHigherEdConfidence: Double?

    @Guide(description: "Enrolled at least half time?")
    var enrolledHalfTime: Bool?
    var enrolledHalfTimeConfidence: Double?

    @Guide(description: "Works at least 20 hours per week?")
    var works20PlusHours: Bool?
    var works20PlusHoursConfidence: Double?

    @Guide(description: "Participates in a federal or state work-study program?")
    var inWorkStudy: Bool?
    var inWorkStudyConfidence: Double?

    @Guide(description: "Responsible for a dependent child?")
    var responsibleForDependentChild: Bool?
    var responsibleForDependentChildConfidence: Double?

    func apply(to draft: inout SNAPApplicationDraft, confidence: inout [SNAPFieldKey: Double]) {
        assign(enrolledInHigherEd, to: \.studentStatus.enrolledInHigherEd, in: &draft)
        record(enrolledInHigherEdConfidence, for: .enrolledInHigherEd, in: &confidence)

        assign(enrolledHalfTime, to: \.studentStatus.enrolledHalfTime, in: &draft)
        record(enrolledHalfTimeConfidence, for: .enrolledHalfTime, in: &confidence)

        assign(works20PlusHours, to: \.studentStatus.works20PlusHours, in: &draft)
        record(works20PlusHoursConfidence, for: .works20PlusHours, in: &confidence)

        assign(inWorkStudy, to: \.studentStatus.inWorkStudy, in: &draft)
        record(inWorkStudyConfidence, for: .inWorkStudy, in: &confidence)

        assign(responsibleForDependentChild, to: \.studentStatus.responsibleForDependentChild, in: &draft)
        record(responsibleForDependentChildConfidence, for: .responsibleForDependentChild, in: &confidence)
    }
}

@available(iOS 26.0, *)
@Generable
struct ExpensesExtraction: SNAPDraftPatchProducing {
    @Guide(description: "Monthly rent or housing cost in US dollars. Range 0 to 20000.")
    var monthlyRentOrHousing: Double?
    var monthlyRentOrHousingConfidence: Double?

    // OBBBA §10104 (eff. 2025-07-04) removed internet from the SNAP
    // excess-shelter deduction. The Guide explicitly excludes internet
    // so the LLM doesn't roll an internet bill into the utilities total.
    @Guide(description: "Monthly utilities cost in US dollars — electricity, heat, gas, water, phone. Do NOT include internet; SNAP does not count internet as a utility. Range 0 to 5000.")
    var monthlyUtilities: Double?
    var monthlyUtilitiesConfidence: Double?

    @Guide(description: "Monthly childcare cost in US dollars. Range 0 to 10000.")
    var monthlyChildcare: Double?
    var monthlyChildcareConfidence: Double?

    @Guide(description: "Monthly medical expenses in US dollars. Range 0 to 10000.")
    var monthlyMedical: Double?
    var monthlyMedicalConfidence: Double?

    func apply(to draft: inout SNAPApplicationDraft, confidence: inout [SNAPFieldKey: Double]) {
        if let rent = decimalCurrency(monthlyRentOrHousing, clampingTo: 0...20_000) {
            draft.expenses.monthlyRentOrHousing = rent
            record(monthlyRentOrHousingConfidence, for: .monthlyRentOrHousing, in: &confidence)
        }
        if let utilities = decimalCurrency(monthlyUtilities, clampingTo: 0...5_000) {
            draft.expenses.monthlyUtilities = utilities
            record(monthlyUtilitiesConfidence, for: .monthlyUtilities, in: &confidence)
        }
        if let childcare = decimalCurrency(monthlyChildcare, clampingTo: 0...10_000) {
            draft.expenses.monthlyChildcare = childcare
            record(monthlyChildcareConfidence, for: .monthlyChildcare, in: &confidence)
        }
        if let medical = decimalCurrency(monthlyMedical, clampingTo: 0...10_000) {
            draft.expenses.monthlyMedical = medical
            record(monthlyMedicalConfidence, for: .monthlyMedical, in: &confidence)
        }
    }
}

@available(iOS 26.0, *)
@Generable
struct DocumentsChecklistExtraction: SNAPDraftPatchProducing {
    @Guide(description: "Document types the speaker said they already have available.")
    var documentsAvailable: [SNAPDocumentTypeGen]?
    var documentsAvailableConfidence: Double?

    func apply(to draft: inout SNAPApplicationDraft, confidence: inout [SNAPFieldKey: Double]) {
        guard let documentsAvailable, !documentsAvailable.isEmpty else { return }
        for doc in documentsAvailable {
            draft.documentsChecklist.documentsAvailable.insert(doc.toModelEnum())
        }
        record(documentsAvailableConfidence, for: .documentsAvailable, in: &confidence)
    }
}

// Review and Next Steps are read-only screens — voice intake has nothing
// to extract there. Stubs exist so the per-step routing in the service is
// exhaustive without needing optional-step handling.
@available(iOS 26.0, *)
@Generable
struct ReviewDraftExtraction: SNAPDraftPatchProducing {
    @Guide(description: "Reserved. Always nil — review screen has no extractable fields.")
    var placeholder: String?

    func apply(to draft: inout SNAPApplicationDraft, confidence: inout [SNAPFieldKey: Double]) {}
}

@available(iOS 26.0, *)
@Generable
struct NextStepsExtraction: SNAPDraftPatchProducing {
    @Guide(description: "Reserved. Always nil — next-steps screen has no extractable fields.")
    var placeholder: String?

    func apply(to draft: inout SNAPApplicationDraft, confidence: inout [SNAPFieldKey: Double]) {}
}
