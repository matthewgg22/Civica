import Foundation

// EXPERIMENTAL SILOED MODULE: SNAP flow models.
// All data in this file is in-memory only and scoped to the SNAP module.
enum SNAPApplicationStep: Int, CaseIterable, Identifiable {
    case eligibilityIntro
    case privacyNotice
    case application
    case review
    case confirmation

    var id: Int { rawValue }

    var title: String {
        switch self {
        case .eligibilityIntro: return "SNAP Eligibility Intro"
        case .privacyNotice: return "Privacy Notice"
        case .application: return "Application Draft"
        case .review: return "Review"
        case .confirmation: return "Confirmation"
        }
    }
}

// EXPERIMENTAL SILOED MODULE:
// iPhone-first guided draft steps. One question group per screen.
enum SNAPDraftStep: Int, CaseIterable, Identifiable {
    case householdBasics
    case addressContact
    case income
    case studentStatus
    case expenses
    case documentsChecklist
    case reviewDraft
    case nextSteps

    var id: Int { rawValue }

    var title: String {
        switch self {
        case .householdBasics: return "Household basics"
        case .addressContact: return "Contact preference"
        case .income: return "Income"
        case .studentStatus: return "Student status"
        case .expenses: return "Monthly expenses"
        case .documentsChecklist: return "Preparation checklist"
        case .reviewDraft: return "Review your application"
        case .nextSteps: return "Next steps"
        }
    }

    var helperCopy: String {
        switch self {
        case .householdBasics:
            return "Start with who lives with you and shares food costs."
        case .addressContact:
            return "Choose how you would prefer to be reached if you later ask for help."
        case .income:
            return "Give a simple estimate so your draft is easier to review."
        case .studentStatus:
            return "Answer student questions only if you are enrolled in higher education."
        case .expenses:
            return "Add broad monthly cost estimates before continuing to official steps."
        case .documentsChecklist:
            return "Mark what you already have or may want to gather before the official application."
        case .reviewDraft:
            return "Review your application answers for missing or incorrect information before continuing."
        case .nextSteps:
            return "Use your draft to continue through the official state SNAP process."
        }
    }
}

struct SNAPEligibilityDraft {
    var isMassachusettsResident: Bool?
    var isStudent: Bool?
    var householdSizeText: String = ""
    var monthlyIncomeEstimateText: String = ""

    var mayQualifyHint: Bool {
        isMassachusettsResident == true
    }
}

struct SNAPApplicationDraft {
    // EXPERIMENTAL SILOED MODULE:
    // SNAP draft answers must remain session-only and in-memory.
    // Do not persist this model to UserDefaults, Keychain, Supabase, Firebase, or any backend
    // until a formal privacy and security review is complete.
    var householdSize: Int?
    var applicantAge: Int?
    var state: String?
    var zipCode: String?
    var housingStatus: HousingStatus?
    var studentStatus: StudentStatus?
    var isCurrentlyEnrolledInHigherEducation: Bool?
    var isEnrolledAtLeastHalfTime: Bool?
    var worksAtLeastTwentyHoursPerWeek: Bool?
    var participatesInWorkStudy: Bool?
    var isResponsibleForDependentChild: Bool?
    var monthlyIncomeEstimate: String = ""
    var incomeChangesMonthToMonth: Bool?
    var employmentStatus: EmploymentStatus?
    var rentOrHousingCost: String = ""
    var utilitiesCost: String = ""
    var childcareCostEstimate: String = ""
    var medicalExpensesEstimate: String = ""
    var hasChildren: Bool?
    var hasDisabilityInHousehold: Bool?
    var isSeniorHousehold: Bool?
    var preferredContactMethod: PreferredContactMethod?
    var documentsAvailable: [SNAPDocumentType] = []

    // Guardrail reminder: this prototype must not include SSN, full immigration status,
    // bank account numbers, or document upload payloads.
    static let blockedSensitiveFields: [String] = [
        "ssn",
        "social_security_number",
        "immigration_status_full",
        "bank_account_number",
        "routing_number"
    ]
}

struct SNAPReviewLineItem: Identifiable {
    let id = UUID()
    let label: String
    let value: String
}

enum HousingStatus: String, CaseIterable, Identifiable {
    case stableHome = "stable_home"
    case temporaryHousing = "temporary_housing"
    case stayingWithOthers = "staying_with_others"
    case unhoused = "unhoused"

    var id: String { rawValue }

    var label: String {
        switch self {
        case .stableHome: return "Stable home"
        case .temporaryHousing: return "Temporary housing"
        case .stayingWithOthers: return "Staying with others"
        case .unhoused: return "Unhoused"
        }
    }
}

enum StudentStatus: String, CaseIterable, Identifiable {
    case currentlyStudent = "currently_student"
    case notStudent = "not_student"
    case recentlyLeftSchool = "recently_left_school"
    case unsure = "unsure"

    var id: String { rawValue }

    var label: String {
        switch self {
        case .currentlyStudent: return "Currently a student"
        case .notStudent: return "Not a student"
        case .recentlyLeftSchool: return "Recently left school"
        case .unsure: return "Not sure"
        }
    }
}

enum EmploymentStatus: String, CaseIterable, Identifiable {
    case employedFullTime = "employed_full_time"
    case employedPartTime = "employed_part_time"
    case selfEmployed = "self_employed"
    case unemployed = "unemployed"
    case unableToWork = "unable_to_work"

    var id: String { rawValue }

    var label: String {
        switch self {
        case .employedFullTime: return "Employed full-time"
        case .employedPartTime: return "Employed part-time"
        case .selfEmployed: return "Self-employed"
        case .unemployed: return "Not currently working"
        case .unableToWork: return "Unable to work"
        }
    }
}

enum PreferredContactMethod: String, CaseIterable, Identifiable {
    case phone = "phone"
    case text = "text"
    case email = "email"
    case mail = "mail"

    var id: String { rawValue }

    var label: String {
        switch self {
        case .phone: return "Phone call"
        case .text: return "Text message"
        case .email: return "Email"
        case .mail: return "Mail"
        }
    }
}

enum SNAPDocumentType: String, CaseIterable, Identifiable {
    case photoID = "photo_id"
    case proofOfAddress = "proof_of_address"
    case proofOfIncome = "proof_of_income"
    case rentOrHousingCostProof = "rent_or_housing_cost_proof"
    case utilityBill = "utility_bill"
    case studentStatusDocuments = "student_status_documents"
    case childcareCostProof = "childcare_cost_proof"
    case immigrationDocumentsIfRelevant = "immigration_documents_if_relevant"

    var id: String { rawValue }

    var label: String {
        switch self {
        case .photoID: return "Photo ID, if requested later"
        case .proofOfAddress: return "Proof of address"
        case .proofOfIncome: return "Proof of income"
        case .rentOrHousingCostProof: return "Rent or housing cost proof"
        case .utilityBill: return "Utility bill"
        case .studentStatusDocuments: return "Student status documents"
        case .childcareCostProof: return "Childcare cost proof"
        case .immigrationDocumentsIfRelevant: return "Immigration-related documents, only if the official application asks"
        }
    }
}
