import Foundation

// Swift mirror of packages/snap-rules/src/informal-housing/
//
// The branching logic in nextUnansweredQuestion() and validateIntake()
// from the TypeScript question bank is replicated here in Swift so the
// wizard can be driven entirely on-device without a network round-trip.
//
// Answers are stored as [String: String] keyed by `question.key`, matching
// the packet_answers.question_key / applicant_answer schema in Supabase.
// Multi-select answers are comma-separated strings (e.g. "plaid_recurring,money_app_history").

// MARK: - Answer kind

enum IHAnswerKind: String {
    case singleSelect = "single_select"
    case multiSelect  = "multi_select"
    case money        = "money"
    case boolean      = "boolean"
    case text         = "text"
    case personName   = "person_name"
}

// MARK: - Branch condition

/// Show this question only when the answer to `ifKey` is one of `ifIn`.
struct IHBranchCondition {
    let ifKey: String
    let ifIn: [String]

    func isSatisfied(by answers: [String: String]) -> Bool {
        guard let value = answers[ifKey] else { return false }
        return ifIn.contains(value)
    }
}

// MARK: - Option

struct IHOption: Identifiable {
    let value: String
    let label: String
    var id: String { value }
}

// MARK: - Question

struct IHQuestion: Identifiable {
    let key: String
    let prompt: String
    let helper: String?
    let kind: IHAnswerKind
    let options: [IHOption]
    let showWhen: IHBranchCondition?
    /// "hard" = must answer to proceed; "soft" = recommended but skippable.
    let required: Bool  // true = "hard"

    var id: String { key }
}

// MARK: - Question bank (mirrors INFORMAL_HOUSING_QUESTIONS)

enum IHQuestionBank {

    static let all: [IHQuestion] = [

        // Q1 — Root: arrangement kind
        IHQuestion(
            key: "ih_arrangement",
            prompt: "Which best describes where you're living right now?",
            helper: "Pick the closest match. We'll ask a few follow-ups based on your answer.",
            kind: .singleSelect,
            options: [
                IHOption(value: "family_rent",              label: "Paying rent to a family member"),
                IHOption(value: "doubled_up_friends",       label: "Sharing a place with friends or roommates (no lease in my name)"),
                IHOption(value: "room_rental_no_lease",     label: "Renting a room in someone's home (no written lease)"),
                IHOption(value: "motel_weekly",             label: "Staying in a motel or hotel"),
                IHOption(value: "homeless_no_shelter_cost", label: "I don't have a regular place to sleep at night"),
                IHOption(value: "homeless_with_cost",       label: "I'm homeless but paying for shelter (transitional, shelter stay)"),
                IHOption(value: "utilities_only",           label: "Living somewhere rent-free but I pay the utilities"),
                IHOption(value: "dv_shelter",               label: "Staying in a domestic violence shelter or victim-services housing"),
            ],
            showWhen: nil,
            required: true
        ),

        // Q2 — Monthly shelter cost (not shown for homeless-no-cost or DV shelter)
        IHQuestion(
            key: "ih_monthly_cost_usd",
            prompt: "About how much do you pay each month for housing?",
            helper: "Estimate is fine. If you pay weekly, give us the weekly amount and we'll convert.",
            kind: .money,
            options: [],
            showWhen: IHBranchCondition(
                ifKey: "ih_arrangement",
                ifIn: ["family_rent", "doubled_up_friends", "room_rental_no_lease",
                       "motel_weekly", "homeless_with_cost", "utilities_only"]
            ),
            required: true
        ),

        // Q3 — Payment cadence
        IHQuestion(
            key: "ih_cadence",
            prompt: "How often do you pay?",
            helper: nil,
            kind: .singleSelect,
            options: [
                IHOption(value: "monthly",   label: "Monthly"),
                IHOption(value: "weekly",     label: "Weekly"),
                IHOption(value: "biweekly",  label: "Every two weeks"),
                IHOption(value: "nightly",   label: "Nightly"),
                IHOption(value: "irregular", label: "Irregular / when I can"),
            ],
            showWhen: IHBranchCondition(
                ifKey: "ih_arrangement",
                ifIn: ["family_rent", "doubled_up_friends", "room_rental_no_lease",
                       "motel_weekly", "homeless_with_cost", "utilities_only"]
            ),
            required: true
        ),

        // Q4a — Payee relationship
        IHQuestion(
            key: "ih_payee_relationship",
            prompt: "What's your relationship to the person you pay?",
            helper: nil,
            kind: .singleSelect,
            options: [
                IHOption(value: "parent",   label: "Parent"),
                IHOption(value: "sibling",  label: "Sibling"),
                IHOption(value: "child",    label: "Adult child"),
                IHOption(value: "relative", label: "Other family member"),
                IHOption(value: "friend",   label: "Friend"),
                IHOption(value: "roommate", label: "Roommate I don't know well"),
                IHOption(value: "landlord", label: "Landlord (the person who owns the place)"),
            ],
            showWhen: IHBranchCondition(
                ifKey: "ih_arrangement",
                ifIn: ["family_rent", "doubled_up_friends", "room_rental_no_lease"]
            ),
            required: false
        ),

        // Q4b — Payee name
        IHQuestion(
            key: "ih_payee_name",
            prompt: "What's their name?",
            helper: "We'll only use this to confirm the payment if you connect your bank account or money app.",
            kind: .personName,
            options: [],
            showWhen: IHBranchCondition(
                ifKey: "ih_arrangement",
                ifIn: ["family_rent", "doubled_up_friends", "room_rental_no_lease"]
            ),
            required: false
        ),

        // Q5 — Evidence
        IHQuestion(
            key: "ih_evidence_kind",
            prompt: "Which of these can you show as proof?",
            helper: "Pick all that apply. The more we can confirm, the stronger your packet.",
            kind: .multiSelect,
            options: [
                IHOption(value: "plaid_recurring",         label: "Bank transfer history"),
                IHOption(value: "money_app_history",       label: "Venmo, Zelle, or CashApp history"),
                IHOption(value: "third_party_attestation", label: "Signed letter from the person I pay"),
                IHOption(value: "lodging_receipt",         label: "Motel / weekly stay receipts"),
                IHOption(value: "utility_bills_only",      label: "Utility bills in my name"),
                IHOption(value: "shelter_provider_letter", label: "Letter from a shelter"),
                IHOption(value: "coc_hmis_verification",   label: "Letter from a homeless services provider"),
                IHOption(value: "self_attestation_only",   label: "Nothing — just my word"),
            ],
            showWhen: nil,
            required: false
        ),

        // Q6 — Exclusive use
        IHQuestion(
            key: "ih_exclusive_use",
            prompt: "Do you have a room or area that's yours alone, or do you share a sleeping space?",
            helper: nil,
            kind: .singleSelect,
            options: [
                IHOption(value: "exclusive_room",   label: "I have my own room"),
                IHOption(value: "exclusive_corner", label: "I have a private corner / partitioned space"),
                IHOption(value: "shared_space",     label: "I share a sleeping space (couch, floor, shared bed)"),
            ],
            showWhen: IHBranchCondition(
                ifKey: "ih_arrangement",
                ifIn: ["doubled_up_friends", "room_rental_no_lease"]
            ),
            required: false
        ),

        // Q7 — Separate household
        IHQuestion(
            key: "ih_separate_household",
            prompt: "Do you buy and prepare food separately from the other people you live with?",
            helper: "SNAP rules treat people who share food as one household. If you eat separately, you can apply on your own.",
            kind: .boolean,
            options: [
                IHOption(value: "true",  label: "Yes, I buy and prepare food separately"),
                IHOption(value: "false", label: "No, we share food"),
            ],
            showWhen: IHBranchCondition(
                ifKey: "ih_arrangement",
                ifIn: ["family_rent", "doubled_up_friends", "room_rental_no_lease", "utilities_only"]
            ),
            required: true
        ),

        // Q8 — Motel nightly rate
        IHQuestion(
            key: "ih_motel_nightly_rate",
            prompt: "About how much per night?",
            helper: nil,
            kind: .money,
            options: [],
            showWhen: IHBranchCondition(ifKey: "ih_arrangement", ifIn: ["motel_weekly"]),
            required: false
        ),

        // Q9 — Homeless-with-cost: where
        IHQuestion(
            key: "ih_homeless_setting",
            prompt: "Where are you staying that costs money?",
            helper: nil,
            kind: .singleSelect,
            options: [
                IHOption(value: "transitional_housing", label: "Transitional housing program"),
                IHOption(value: "shelter_paid",         label: "Shelter that charges a daily/weekly fee"),
                IHOption(value: "vehicle_parking_fee",  label: "Vehicle parking / safe-parking program fee"),
                IHOption(value: "other",                label: "Something else"),
            ],
            showWhen: IHBranchCondition(ifKey: "ih_arrangement", ifIn: ["homeless_with_cost"]),
            required: false
        ),

        // Q10 — DV shelter — minimal data, NEVER location
        IHQuestion(
            key: "ih_dv_can_provide_letter",
            prompt: "Can you safely get a letter from the shelter, or would that be unsafe?",
            helper: "It's OK if you can't — we'll handle it. We never ask for shelter address or details.",
            kind: .singleSelect,
            options: [
                IHOption(value: "yes_letter_safe",  label: "Yes, I can get a letter"),
                IHOption(value: "no_letter_unsafe", label: "No, asking for a letter would put me at risk"),
                IHOption(value: "unsure",           label: "I'm not sure yet"),
            ],
            showWhen: IHBranchCondition(ifKey: "ih_arrangement", ifIn: ["dv_shelter"]),
            required: true
        ),

        // Q11 — Stability check
        IHQuestion(
            key: "ih_months_at_current",
            prompt: "How many months have you been at this place?",
            helper: nil,
            kind: .singleSelect,
            options: [
                IHOption(value: "less_than_1", label: "Less than a month"),
                IHOption(value: "1_to_3",      label: "1–3 months"),
                IHOption(value: "3_to_12",     label: "3–12 months"),
                IHOption(value: "over_12",     label: "Over a year"),
            ],
            showWhen: IHBranchCondition(
                ifKey: "ih_arrangement",
                ifIn: ["family_rent", "doubled_up_friends", "room_rental_no_lease",
                       "motel_weekly", "utilities_only"]
            ),
            required: false
        ),
    ]
}

// MARK: - Branch evaluator (mirrors nextUnansweredQuestion)

extension IHQuestionBank {

    /// Returns all questions that are visible given the current answer set.
    static func visibleQuestions(for answers: [String: String]) -> [IHQuestion] {
        all.filter { q in
            guard let condition = q.showWhen else { return true }
            return condition.isSatisfied(by: answers)
        }
    }

    /// Returns the first visible question that hasn't been answered yet.
    /// Multi-select questions are considered unanswered if the stored value is empty.
    static func nextUnanswered(for answers: [String: String]) -> IHQuestion? {
        for q in all {
            if let condition = q.showWhen, !condition.isSatisfied(by: answers) {
                continue
            }
            let value = answers[q.key] ?? ""
            if value.isEmpty {
                return q
            }
        }
        return nil
    }

    /// Returns the visible question at the given index in the visible sequence.
    static func question(at index: Int, for answers: [String: String]) -> IHQuestion? {
        let visible = visibleQuestions(for: answers)
        guard index >= 0 && index < visible.count else { return nil }
        return visible[index]
    }
}

// MARK: - Validation result (mirrors IntakeValidationResult)

struct IHValidationResult {
    let isComplete: Bool
    let arrangement: String?
    let missingRequired: [String]
    let missingRecommended: [String]
}

extension IHQuestionBank {
    static func validate(answers: [String: String]) -> IHValidationResult {
        let arrangement = answers["ih_arrangement"]
        var missingRequired: [String] = []
        var missingRecommended: [String] = []

        for q in all {
            if let condition = q.showWhen, !condition.isSatisfied(by: answers) { continue }
            let value = answers[q.key] ?? ""
            if value.isEmpty {
                if q.required { missingRequired.append(q.key) }
                else { missingRecommended.append(q.key) }
            }
        }

        return IHValidationResult(
            isComplete: missingRequired.isEmpty,
            arrangement: arrangement,
            missingRequired: missingRequired,
            missingRecommended: missingRecommended
        )
    }
}

// MARK: - Arrangement kind (mirrors InformalArrangementKind)

enum IHArrangementKind: String, CaseIterable {
    case familyRent             = "family_rent"
    case doubledUpFriends       = "doubled_up_friends"
    case roomRentalNoLease      = "room_rental_no_lease"
    case motelWeekly            = "motel_weekly"
    case homelessNoShelterCost  = "homeless_no_shelter_cost"
    case homelessWithCost       = "homeless_with_cost"
    case utilitiesOnly          = "utilities_only"
    case dvShelter              = "dv_shelter"

    var displayLabel: String {
        switch self {
        case .familyRent:            return "Paying rent to a family member"
        case .doubledUpFriends:      return "Sharing a place with friends or roommates"
        case .roomRentalNoLease:     return "Renting a room (no written lease)"
        case .motelWeekly:           return "Staying in a motel or hotel"
        case .homelessNoShelterCost: return "No regular place to sleep at night"
        case .homelessWithCost:      return "Homeless but paying for shelter"
        case .utilitiesOnly:         return "Paying utilities only"
        case .dvShelter:             return "Domestic violence shelter"
        }
    }
}

// MARK: - Shelter effect (mirrors SHELTER_EFFECT)

struct IHShelterEffect {
    let homelessDeductionEligible: Bool
    let hasShelterCost: Bool
    let suaEligible: Bool
    let note: String
}

extension IHArrangementKind {

    var shelterEffect: IHShelterEffect {
        switch self {
        case .familyRent:
            return IHShelterEffect(
                homelessDeductionEligible: false,
                hasShelterCost: true,
                suaEligible: true,
                note: "Verify amount via recurring payment evidence; family member should be willing to confirm if asked."
            )
        case .doubledUpFriends:
            return IHShelterEffect(
                homelessDeductionEligible: false,
                hasShelterCost: true,
                suaEligible: true,
                note: "Shared housing — confirm SNAP household composition is separate from the host household, and that applicant pays a fixed share."
            )
        case .roomRentalNoLease:
            return IHShelterEffect(
                homelessDeductionEligible: false,
                hasShelterCost: true,
                suaEligible: true,
                note: "Confirm room rental is exclusive use (not couch surfing) and rent amount is stable."
            )
        case .motelWeekly:
            return IHShelterEffect(
                homelessDeductionEligible: false,
                hasShelterCost: true,
                suaEligible: false,
                note: "Convert nightly/weekly to monthly equivalent. SUA does not apply — utilities are included in lodging cost."
            )
        case .homelessNoShelterCost:
            return IHShelterEffect(
                homelessDeductionEligible: true,
                hasShelterCost: false,
                suaEligible: false,
                note: "Standard $198.99/mo homeless shelter deduction applies. SUA does not apply (no utility costs)."
            )
        case .homelessWithCost:
            return IHShelterEffect(
                homelessDeductionEligible: true,
                hasShelterCost: true,
                suaEligible: false,
                note: "May elect homeless deduction ($198.99) OR actual shelter cost (whichever is higher). Compare both."
            )
        case .utilitiesOnly:
            return IHShelterEffect(
                homelessDeductionEligible: false,
                hasShelterCost: true,
                suaEligible: true,
                note: "Only utility cost counts as shelter expense; rent portion is $0 (landlord pays)."
            )
        case .dvShelter:
            return IHShelterEffect(
                homelessDeductionEligible: true,
                hasShelterCost: false,
                suaEligible: false,
                note: "Treated as homeless for shelter purposes. Privacy-sensitive — collect minimum necessary evidence."
            )
        }
    }
}

// MARK: - Submit request

/// Payload sent to the enrollment API to persist informal housing answers.
/// Mirrors the packet_answers table: each entry is one (question_key, applicant_answer) pair.
struct IHSubmitRequest: Encodable {
    struct Answer: Encodable {
        let question_key: String
        let question_label: String
        let applicant_answer: String
    }
    let answers: [Answer]
}
