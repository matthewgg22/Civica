import Foundation

// Voice-intake patch protocol. Each per-step extraction struct in
// SNAPVoiceExtractionModels.swift conforms to this and applies itself
// to the in-memory SNAPApplicationDraft. Confidence values land in a
// parallel dictionary that drives the amber low-confidence highlights.
protocol SNAPDraftPatchProducing {
    func apply(
        to draft: inout SNAPApplicationDraft,
        confidence: inout [SNAPFieldKey: Double]
    )
}

// Closed enum covering every voice-fillable field on SNAPApplicationDraft.
// New voice-fillable fields must be added here so the compiler forces
// the @Generable schemas and apply() implementations to stay in sync.
enum SNAPFieldKey: String, Hashable, CaseIterable {
    // whereApplying
    case stateCode
    case housingStatus

    // household
    case householdSize
    case hasMinorInHousehold
    case hasElderlyOrDisabled

    // applicantAge
    case dateOfBirth

    // contact
    case email
    case phone
    case preferredMethod

    // income
    case anyoneEarning
    case grossMonthlyIncome
    case incomeChangesMonthToMonth
    case hasUnearnedIncome

    // studentStatus
    case enrolledInHigherEd
    case enrolledHalfTime
    case works20PlusHours
    case inWorkStudy
    case responsibleForDependentChild

    // expenses
    case monthlyRentOrHousing
    case monthlyUtilities
    case monthlyChildcare
    case monthlyMedical

    // documentsChecklist
    case documentsAvailable
}

// Confidence threshold below which a voice-filled field is rendered with
// the amber "needs review" border. Tuned against the prompt rule that
// asks the model to use 0.6–0.8 for paraphrased values and <0.7 for
// genuinely uncertain extractions.
enum SNAPVoiceConfidence {
    static let needsReviewThreshold: Double = 0.7
    static let distressSignalThreshold: Double = 0.6
}

// Helpers used by per-step extraction structs to merge optional values
// without overwriting prior user input with nil, and to convert the
// LLM's Double dollar amounts to Civica's Decimal-typed currency fields.
extension SNAPDraftPatchProducing {
    func assign<T>(_ value: T?, to keyPath: WritableKeyPath<SNAPApplicationDraft, T?>, in draft: inout SNAPApplicationDraft) {
        guard let value else { return }
        draft[keyPath: keyPath] = value
    }

    func assignNonEmpty(_ value: String?, to keyPath: WritableKeyPath<SNAPApplicationDraft, String?>, in draft: inout SNAPApplicationDraft) {
        guard let value, !value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
        draft[keyPath: keyPath] = value
    }

    func record(_ confidence: Double?, for key: SNAPFieldKey, in map: inout [SNAPFieldKey: Double]) {
        guard let confidence else { return }
        map[key] = max(0.0, min(1.0, confidence))
    }

    // Civica's currency-bearing draft fields are Decimal?. Voice extraction
    // produces Double (the LLM @Generable surface), so convert with clamping.
    func decimalCurrency(_ value: Double?, clampingTo range: ClosedRange<Double>) -> Decimal? {
        guard let value else { return nil }
        let clamped = min(max(value, range.lowerBound), range.upperBound)
        return Decimal(clamped)
    }
}
