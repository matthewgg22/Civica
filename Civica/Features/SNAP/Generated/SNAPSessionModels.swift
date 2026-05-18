import Foundation

// GENERATED — manual snapshot of the Pydantic schemas in
// backend/civic_api/snap/pipeline/schemas.py and
// backend/civic_api/snap/rules/interfaces.py.
//
// When you change one of those schemas, mirror the change here. There
// is no automated codegen yet (Phase D MVP); the parity is enforced
// by the wire-shape tests in WeVote Information PageTests/SNAPSessionModelsTests.swift.

// MARK: - Question topic
// Mirrors backend QuestionTopic. Stable identifier strings — never rename
// values; add new cases at the bottom and increment a schema version if
// you ever need to break compatibility.

enum SNAPQuestionTopic: String, Codable, Sendable {
    case householdState = "household_state"
    case householdComposition = "household_composition"
    case applicantAge = "applicant_age"
    case applicantCitizenship = "applicant_citizenship"
    case applicantStudentStatus = "applicant_student_status"
    case applicantStudentExemption = "applicant_student_exemption"
    case applicantDisability = "applicant_disability"
    case earnedIncome = "earned_income"
    case unearnedIncome = "unearned_income"
    case housingCost = "housing_cost"
    case utilityCosts = "utility_costs"
    case dependentCare = "dependent_care"
    case medicalExpensesElderlyDisabled = "medical_expenses_elderly_disabled"
    case childSupportPaid = "child_support_paid"
    case liquidAssets = "liquid_assets"
    case cashProgramReceipt = "cash_program_receipt"
    case homelessStatus = "homeless_status"
    case done
    case clarificationNeeded = "clarification_needed"
}

// MARK: - Expected input type

enum SNAPExpectedInputType: String, Codable, Sendable {
    case freeText = "free_text"
    case numericDollars = "numeric_dollars"
    case integer
    case yesNo = "yes_no"
    case date
    case choice
}

// MARK: - Eligibility result (subset the iOS verdict screen renders)

enum SNAPEligibilityStatus: String, Codable, Sendable {
    case eligible
    case ineligible
    case eligibleWithConditions = "eligible_with_conditions"
    case insufficientInformation = "insufficient_information"
}

struct SNAPRequiredVerification: Codable, Sendable, Hashable {
    let code: String
    let labelEn: String
    let labelEs: String
    let explanationEn: String
    let explanationEs: String
    let isRequiredForInitialApplication: Bool
    let canBePostponedForExpedited: Bool

    enum CodingKeys: String, CodingKey {
        case code
        case labelEn = "label_en"
        case labelEs = "label_es"
        case explanationEn = "explanation_en"
        case explanationEs = "explanation_es"
        case isRequiredForInitialApplication = "is_required_for_initial_application"
        case canBePostponedForExpedited = "can_be_postponed_for_expedited"
    }
}

/// Audit trail for the benefit amount calculation. Every deduction that
/// fed into the final number is itemized here. Mirrors the backend
/// BenefitCalculationDetail Pydantic model in
/// backend/civic_api/snap/rules/interfaces.py.
///
/// The "decision math exposed" view (HANDOFF board 23) renders one
/// row per line item in this struct, in this order.
struct SNAPBenefitCalculationDetail: Codable, Sendable, Equatable {
    let grossMonthlyIncome: Decimal
    let earnedIncomeDeduction: Decimal
    let standardDeduction: Decimal
    let dependentCareDeduction: Decimal
    let medicalDeduction: Decimal
    let childSupportDeduction: Decimal
    let excessShelterDeduction: Decimal
    let netMonthlyIncome: Decimal
    let thirtyPercentOfNet: Decimal
    let maxAllotmentForHouseholdSize: Decimal
    let monthlyBenefit: Decimal

    enum CodingKeys: String, CodingKey {
        case grossMonthlyIncome = "gross_monthly_income"
        case earnedIncomeDeduction = "earned_income_deduction"
        case standardDeduction = "standard_deduction"
        case dependentCareDeduction = "dependent_care_deduction"
        case medicalDeduction = "medical_deduction"
        case childSupportDeduction = "child_support_deduction"
        case excessShelterDeduction = "excess_shelter_deduction"
        case netMonthlyIncome = "net_monthly_income"
        case thirtyPercentOfNet = "thirty_percent_of_net"
        case maxAllotmentForHouseholdSize = "max_allotment_for_household_size"
        case monthlyBenefit = "monthly_benefit"
    }
}

struct SNAPEligibilityResult: Codable, Sendable, Equatable {
    let status: SNAPEligibilityStatus
    /// Decimal arrives over the wire as a JSON string; iOS decodes to Decimal.
    let monthlyBenefit: Decimal?
    let expeditedEligible: Bool
    let contributingFactors: [String]
    let requiredVerifications: [SNAPRequiredVerification]
    let benefitCalculation: SNAPBenefitCalculationDetail?
    let ineligibilityReason: String?
    let effectiveDate: String  // ISO date "YYYY-MM-DD"
    let rulesVersion: String

    enum CodingKeys: String, CodingKey {
        case status
        case monthlyBenefit = "monthly_benefit"
        case expeditedEligible = "expedited_eligible"
        case contributingFactors = "contributing_factors"
        case requiredVerifications = "required_verifications"
        case benefitCalculation = "benefit_calculation"
        case ineligibilityReason = "ineligibility_reason"
        case effectiveDate = "effective_date"
        case rulesVersion = "rules_version"
    }
}

// MARK: - Telemetry

struct SNAPTurnLLMTelemetry: Codable, Sendable, Equatable {
    let stage: String
    let modelUsed: String
    let providerUsed: String
    let inputTokens: Int
    let outputTokens: Int
    let latencyMs: Int
    let costUsd: Decimal

    enum CodingKeys: String, CodingKey {
        case stage
        case modelUsed = "model_used"
        case providerUsed = "provider_used"
        case inputTokens = "input_tokens"
        case outputTokens = "output_tokens"
        case latencyMs = "latency_ms"
        case costUsd = "cost_usd"
    }
}

// MARK: - TurnResult — the per-turn payload the orchestrator returns

struct SNAPTurnResult: Codable, Sendable, Equatable {
    let sessionId: String
    let turnIndex: Int
    let assistantQuestion: String
    let helperText: String?
    let expectedInputType: SNAPExpectedInputType
    let choiceOptions: [String]?
    let nextTopic: SNAPQuestionTopic
    let eligibilityPreview: SNAPEligibilityResult?
    let isTerminal: Bool
    let needsClarification: Bool
    let clarificationText: String?
    let needsUserConfirmation: Bool
    let costTelemetry: [SNAPTurnLLMTelemetry]
    let confidence: Double

    enum CodingKeys: String, CodingKey {
        case sessionId = "session_id"
        case turnIndex = "turn_index"
        case assistantQuestion = "assistant_question"
        case helperText = "helper_text"
        case expectedInputType = "expected_input_type"
        case choiceOptions = "choice_options"
        case nextTopic = "next_topic"
        case eligibilityPreview = "eligibility_preview"
        case isTerminal = "is_terminal"
        case needsClarification = "needs_clarification"
        case clarificationText = "clarification_text"
        case needsUserConfirmation = "needs_user_confirmation"
        case costTelemetry = "cost_telemetry"
        case confidence
    }
}

// MARK: - Wire request bodies

struct SNAPStartSessionRequest: Codable, Sendable {
    let state: String
    let language: String
}

struct SNAPStartSessionResponse: Codable, Sendable {
    let sessionId: String
    let openingTurn: SNAPTurnResult

    enum CodingKeys: String, CodingKey {
        case sessionId = "session_id"
        case openingTurn = "opening_turn"
    }
}

struct SNAPSendTurnRequest: Codable, Sendable {
    let userText: String

    enum CodingKeys: String, CodingKey {
        case userText = "user_text"
    }
}

struct SNAPRecoverSessionRequest: Codable, Sendable {
    let token: String
}
