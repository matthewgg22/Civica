import Foundation

// EXPERIMENTAL SILOED MODULE: SNAP flow models.
// All data in this file is in-memory only and scoped to the SNAP module.
enum SNAPCopy {
    // Global product/compliance disclaimer for prototype screens.
    static let globalDisclaimer = "This app helps prepare and screen applications. State SNAP agency makes final decision."
}

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
    case whereApplyingFrom
    case householdBasics
    case applicantAge
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
        case .whereApplyingFrom: return "Where are you currently residing?"
        case .householdBasics: return "Your Food Household"
        case .applicantAge: return "Applicant age"
        case .addressContact: return "Contact information"
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
        case .whereApplyingFrom:
            return "Share your state, housing status, and address details when requested."
        case .householdBasics:
            return "Start with who lives with you and shares food costs."
        case .applicantAge:
            return "Add your date of birth so we can estimate applicant age."
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

/// Legacy intake draft model. Preserved while the surfaces that
/// reference it (SNAPApplicationViewModel, SNAPPrivacyNoticeView,
/// SNAPReviewView, SNAPConfirmationView, SNAPApplicationGeneratorView,
/// SNAPDebugChecklistView) are migrated off it. The new orchestrator
/// path uses `SNAPApplicationDraft` (without the Legacy prefix) which
/// lives in SNAPReviewDraftFlow.swift.
struct SNAPLegacyApplicationDraft {
    // EXPERIMENTAL SILOED MODULE:
    // SNAP draft answers must remain session-only and in-memory.
    // Do not persist this model to UserDefaults, Keychain, Supabase, Firebase, or any backend
    // until a formal privacy and security review is complete.
    var householdSize: Int?
    var applicantAge: Int?
    var applicantDateOfBirth: Date?
    var state: String?
    var zipCode: String?
    var residentialStreetAddress: String = ""
    var residentialCity: String = ""
    var residentialZIP: String = ""
    var housingStatus: HousingStatus?
    var expeditedCandidate: Bool = false
    var expeditedReason: String?
    var requiresPermanentAddress: Bool = true
    var allowCollateralContact: Bool = false
    var allowPostponedVerification: Bool = false
    var isExpeditedPathActive: Bool = false
    var choseRegularPathInsteadOfExpedited: Bool = false
    var expeditedHasAnyID: Bool?
    var expeditedIDType: String = ""
    var expeditedHasCurrentIncome: Bool?
    var expeditedCurrentMonthIncomeAmount: String = ""
    var expeditedCashOrBankAmountNow: String = ""
    var expeditedHasCollateralContact: Bool?
    var expeditedCollateralContactName: String = ""
    var expeditedCollateralContactRole: String = ""
    var expeditedCollateralContactValue: String = ""
    var expeditedBestAgencyContactMethod: ExpeditedAgencyContactMethod?
    var studentStatus: StudentStatus?
    var isCurrentlyEnrolledInHigherEducation: Bool?
    var isEnrolledAtLeastHalfTime: Bool?
    var worksAtLeastTwentyHoursPerWeek: Bool?
    var participatesInWorkStudy: Bool?
    var isResponsibleForDependentChild: Bool?
    var monthlyIncomeEstimate: String = ""
    var incomeChangesMonthToMonth: Bool?
    var employmentStatus: EmploymentStatus?
    var buysAndPreparesFoodWithOthers: SNAPTernaryChoice?
    var spouseLivesWithUser: SNAPTernaryChoice?
    var childUnder22LivesWithParentInHome: SNAPTernaryChoice?
    var childrenInHousehold: SNAPTernaryChoice?
    var anyoneAge60OrOlder: SNAPTernaryChoice?
    var anyoneWithDisability: SNAPTernaryChoice?
    var anyonePregnant: SNAPTernaryChoice?
    var anyoneUnhousedOrNoFixedMailingAddress: SNAPTernaryChoice?
    var preferredSafeMailingContactOption: SNAPSafeMailingContactOption?
    var worksForEmployer: SNAPTernaryChoice?
    var employerOrJobType: String = ""
    var earnedGrossPayAmount: String = ""
    var earnedPayFrequency: SNAPPayFrequency?
    var earnedHoursPerWeek: String = ""
    var recentJobLossOrStoppedWorkChoice: SNAPTernaryChoice?
    var earnedLastPayDate: Date?
    var selfEmployedOrGigWork: SNAPTernaryChoice?
    var gigWorkTypeOrPlatform: String = ""
    var gigGrossReceiptsThisMonth: String = ""
    var gigBusinessExpensesThisMonth: String = ""
    var gigIncomeVariesMonthToMonth: SNAPTernaryChoice?
    var otherIncomeSources: [SNAPOtherIncomeSource] = []
    var rentOrHousingCost: String = ""
    var utilitiesCost: String = ""
    var childcareCostEstimate: String = ""
    var medicalExpensesEstimate: String = ""
    var hasChildren: Bool?
    var hasDisabilityInHousehold: Bool?
    var isSeniorHousehold: Bool?
    var isPregnant: Bool?
    var hasSpouseInHousehold: Bool?
    var hasChildUnder22LivingWithParent: Bool?
    var hasSubmittedOfficialSNAPApplication: Bool?
    var officialSNAPApplicationSubmissionDate: Date?
    var interviewScheduledOrCompleted: Bool?
    var documentDueDate: Date?
    var incomeSourceNotes: String = ""
    var recentJobLossOrStoppedWork: Bool?
    var expeditedGrossIncomeEstimate: String = ""
    var expeditedLiquidResourcesEstimate: String = ""
    var expeditedHousingCostEstimate: String = ""
    var expeditedPaysUtilities: Bool?
    var expeditedUtilityEstimate: String = ""
    var expeditedIsMigrantOrSeasonalFarmworker: Bool?
    var expeditedHasIdentityProofAvailable: Bool?
    var preferredContactMethod: PreferredContactMethod?
    var contactEmail: String = ""
    var contactPhone: String = ""
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

enum HousingStatus: String, CaseIterable, Identifiable, Codable {
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

enum ExpeditedAgencyContactMethod: String, CaseIterable, Identifiable {
    case phone = "phone"
    case email = "email"
    case other = "other"

    var id: String { rawValue }

    var label: String {
        switch self {
        case .phone: return "Phone Number"
        case .email: return "Email"
        case .other: return "Other"
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

    var exampleText: String {
        switch self {
        case .employedFullTime:
            return "Ex: Working 35+ hours per week at a job or salary position."
        case .employedPartTime:
            return "Ex: Working fewer than 35 hours per week, including hourly or irregular shifts."
        case .selfEmployed:
            return "Ex: Freelancing, gig work like Uber or DoorDash, contract work, or running a small business."
        case .unemployed:
            return "Ex: Unemployed, between jobs, recently laid off, or not earning income right now."
        case .unableToWork:
            return "Ex: A disability, medical condition, or caregiving responsibility prevents you from working."
        }
    }
}

enum SNAPTernaryChoice: String, CaseIterable, Identifiable {
    case yes = "yes"
    case no = "no"
    case notSure = "not_sure"

    var id: String { rawValue }

    var label: String {
        switch self {
        case .yes: return "Yes"
        case .no: return "No"
        case .notSure: return "Not sure"
        }
    }
}

enum SNAPPayFrequency: String, CaseIterable, Identifiable {
    case weekly = "weekly"
    case everyTwoWeeks = "every_two_weeks"
    case twiceAMonth = "twice_a_month"
    case monthly = "monthly"
    case irregular = "irregular"
    case notSure = "not_sure"

    var id: String { rawValue }

    var label: String {
        switch self {
        case .weekly: return "Weekly"
        case .everyTwoWeeks: return "Every 2 weeks"
        case .twiceAMonth: return "Twice a month"
        case .monthly: return "Monthly"
        case .irregular: return "Irregular"
        case .notSure: return "Not sure"
        }
    }
}

enum SNAPOtherIncomeSource: String, CaseIterable, Identifiable {
    case unemployment = "unemployment"
    case socialSecurity = "social_security_ssi_ssdi"
    case vaBenefits = "va_benefits"
    case childSupportReceived = "child_support_received"
    case cashHelpOrGifts = "cash_help_or_gifts"
    case otherRecurringSupport = "other_recurring_support"

    var id: String { rawValue }

    var label: String {
        switch self {
        case .unemployment: return "Unemployment"
        case .socialSecurity: return "Social Security / SSI / SSDI"
        case .vaBenefits: return "VA benefits"
        case .childSupportReceived: return "Child support received"
        case .cashHelpOrGifts: return "Cash help / gifts from others"
        case .otherRecurringSupport: return "Other recurring support"
        }
    }
}

enum SNAPSafeMailingContactOption: String, CaseIterable, Identifiable {
    case shelter = "shelter"
    case friendOrRelative = "friend_or_relative"
    case authorizedHelper = "authorized_helper"
    case emailOrPortal = "email_or_portal"
    case phone = "phone"
    case notSure = "not_sure"

    var id: String { rawValue }

    var label: String {
        switch self {
        case .shelter: return "Shelter"
        case .friendOrRelative: return "Friend/relative"
        case .authorizedHelper: return "Authorized helper"
        case .emailOrPortal: return "Email/portal"
        case .phone: return "Phone Number"
        case .notSure: return "Not sure"
        }
    }
}

enum PreferredContactMethod: String, CaseIterable, Identifiable, Codable {
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

enum SNAPDocumentType: String, CaseIterable, Identifiable, Codable {
    case photoID = "photo_id"
    case proofOfAddress = "proof_of_address"
    case proofOfIncome = "proof_of_income"
    case rentOrHousingCostProof = "rent_or_housing_cost_proof"
    case utilityBill = "utility_bill"
    case studentStatusDocuments = "student_status_documents"
    case workStatusOrExemptions = "work_status_or_exemptions"
    case childcareCostProof = "childcare_cost_proof"
    case immigrationDocumentsIfRelevant = "immigration_documents_if_relevant"

    var id: String { rawValue }

    var label: String {
        switch self {
        case .photoID: return "Identity"
        case .proofOfAddress: return "Residency"
        case .proofOfIncome: return "Income"
        case .rentOrHousingCostProof: return "Shelter / Housing Costs"
        case .utilityBill: return "Utility Costs"
        case .studentStatusDocuments: return "Student Status"
        case .workStatusOrExemptions: return "Work Status / Exemptions"
        case .childcareCostProof: return "Childcare cost proof"
        case .immigrationDocumentsIfRelevant: return "Immigration-related documents, only if the official application asks"
        }
    }
}
