import Foundation

// Two-stage expedited triage for SNAP intake.
//
// Stage 1: deterministic 7 CFR 273.2(i) hard rules — when any fire,
// confidence is pinned to 1.0 and the UI surfaces the regulatory
// citation. Each rule is named and individually testable.
//
// Stage 2: an `ExpeditedClassifier` that scores soft signals on a
// 0...1 confidence scale. Today's implementation is a calibrated
// weighted-heuristic (`HeuristicExpeditedClassifier`) — fast, fully
// on-device, deterministic. A future CoreML-backed implementation
// conforms to the same protocol with no architectural changes.
//
// The new intake fields the regulatory rules and heuristic depend on
// (liquid resources, migrant/seasonal farmworker status, housing
// situation, utility-shutoff notice, recent job loss) are introduced
// in subsequent commits. Rule and weight coverage expands with each.

// MARK: - Hard rules (7 CFR 273.2(i))

enum ExpeditedHardRule: String, Sendable, Equatable, CaseIterable {
    /// 7 CFR 273.2(i)(1)(i) — liquid resources < $100 AND gross monthly
    /// income < $150.
    case lowIncomeLowResources

    /// 7 CFR 273.2(i)(1)(ii) — migrant or seasonal farmworker with
    /// destitute resources. Approximated for v1 as
    /// `migrantSeasonalFarmworker && liquidResources < $100`; revisit
    /// when intake captures resource accessibility.
    case migrantSeasonalDestitute

    /// 7 CFR 273.2(i)(1)(iii) — combined housing + utilities exceed
    /// the household's gross monthly income plus liquid resources.
    case housingExceedsResources

    var citation: String {
        switch self {
        case .lowIncomeLowResources:    return "7 CFR 273.2(i)(1)(i)"
        case .migrantSeasonalDestitute: return "7 CFR 273.2(i)(1)(ii)"
        case .housingExceedsResources:  return "7 CFR 273.2(i)(1)(iii)"
        }
    }

    var headline: String {
        switch self {
        case .lowIncomeLowResources:
            return "Very low income and resources"
        case .migrantSeasonalDestitute:
            return "Migrant or seasonal farmworker with destitute resources"
        case .housingExceedsResources:
            return "Housing costs exceed income plus resources"
        }
    }
}

// MARK: - Confidence state

enum ExpeditedConfidenceState: String, Sendable, Equatable {
    case high       // >= 0.75 — full amber banner
    case uncertain  // 0.4 ..< 0.75 — banner + clarifying question
    case low        // < 0.4 — banner hidden

    static func from(_ confidence: Double) -> Self {
        if confidence >= 0.75 { return .high }
        if confidence >= 0.4  { return .uncertain }
        return .low
    }
}

// MARK: - Result

struct ExpeditedTriageResult: Equatable, Sendable {
    let firedHardRules: [ExpeditedHardRule]
    let softConfidence: Double      // 0.0 ... 1.0 from the classifier
    let combinedConfidence: Double  // 1.0 if any hard rule fired, else softConfidence
    let state: ExpeditedConfidenceState
    let rationale: [String]

    /// Boolean compatible with `SNAPEligibilityResult.expeditedEligible`
    /// — true when any hard rule fired OR the classifier is high-confidence.
    var expeditedEligible: Bool {
        !firedHardRules.isEmpty || softConfidence >= 0.75
    }
}

// MARK: - Classifier protocol

protocol ExpeditedClassifier: Sendable {
    func predict(_ draft: SNAPApplicationDraft) async -> Double
}

// MARK: - Heuristic placeholder

/// Calibrated weighted-sum-then-sigmoid scorer. Ships as the Stage 2
/// classifier until a distilled CoreML model is available.
///
/// Prior logit -1.5 (base rate ~0.18). Signals are added as
/// independent log-odds contributions; `softConfidence` is the
/// sigmoid of the summed logit.
///
/// Calibration spot-check (with all signals wired in):
///   • one strong signal (recent job loss alone)  → ~0.31  → .low
///   • two moderate signals                       → ~0.40  → .uncertain
///   • three moderate signals                     → ~0.65  → .uncertain
///   • many signals                               → >0.75  → .high
///
/// Weights for fields not yet introduced are added in the commits
/// that introduce those fields.
struct HeuristicExpeditedClassifier: ExpeditedClassifier {
    init() {}

    func predict(_ draft: SNAPApplicationDraft) async -> Double {
        var z = -1.5  // base-rate prior

        let gross = (draft.income.grossMonthlyIncome as NSDecimalNumber?)?.doubleValue ?? 0
        let rent = (draft.expenses.monthlyRentOrHousing as NSDecimalNumber?)?.doubleValue ?? 0
        let utilities = (draft.expenses.monthlyUtilities as NSDecimalNumber?)?.doubleValue ?? 0

        if let resources = draft.income.liquidResources,
           (resources as NSDecimalNumber).doubleValue < 250 {
            z += 1.2
        }
        if draft.expenses.utilityShutoffNotice == .yes { z += 1.0 }
        if draft.income.recentJobLoss30d == .yes { z += 0.7 }

        // (rent + utilities) / max(gross, 1) > 0.7
        if (rent + utilities) / max(gross, 1) > 0.7 { z += 0.6 }

        if draft.household.hasMinorInHousehold == true { z += 0.5 }
        if draft.income.incomeChangesMonthToMonth == .yes { z += 0.4 }
        if draft.household.hasElderlyOrDisabled == true { z += 0.3 }

        return 1.0 / (1.0 + exp(-z))
    }
}

// MARK: - Evaluation

/// Runs Stage 1 hard rules synchronously, then Stage 2 classifier
/// async. Combined confidence is 1.0 when any rule fires, otherwise
/// equals the classifier's soft confidence.
func evaluateTriage(
    draft: SNAPApplicationDraft,
    classifier: any ExpeditedClassifier = HeuristicExpeditedClassifier()
) async -> ExpeditedTriageResult {
    let fired = firedHardRules(in: draft)
    let soft = await classifier.predict(draft)
    let combined = fired.isEmpty ? soft : 1.0
    let rationale = buildRationale(fired: fired, draft: draft, soft: soft)
    return ExpeditedTriageResult(
        firedHardRules: fired,
        softConfidence: soft,
        combinedConfidence: combined,
        state: .from(combined),
        rationale: rationale
    )
}

private func firedHardRules(in draft: SNAPApplicationDraft) -> [ExpeditedHardRule] {
    var hits: [ExpeditedHardRule] = []

    let gross = (draft.income.grossMonthlyIncome as NSDecimalNumber?)?.doubleValue ?? 0
    let rent = (draft.expenses.monthlyRentOrHousing as NSDecimalNumber?)?.doubleValue ?? 0
    let utilities = (draft.expenses.monthlyUtilities as NSDecimalNumber?)?.doubleValue ?? 0
    // Treat an unanswered resources field as $0 — matches the
    // legacy evaluator's conservative bias toward over-detection.
    let liquidResources = (draft.income.liquidResources as NSDecimalNumber?)?.doubleValue ?? 0

    // Rule (i)(i): liquid resources < $100 AND gross income < $150.
    if liquidResources < 100 && gross < 150 {
        hits.append(.lowIncomeLowResources)
    }

    // Rule (i)(iii): housing + utilities exceed gross + resources.
    if (rent + utilities) > (gross + liquidResources) {
        hits.append(.housingExceedsResources)
    }

    // Rule (i)(ii) (migrant/seasonal destitute) requires the
    // migrantSeasonalFarmworker field introduced with the household
    // expansion — wired in that commit.

    return hits
}

private func buildRationale(
    fired: [ExpeditedHardRule],
    draft: SNAPApplicationDraft,
    soft: Double
) -> [String] {
    if !fired.isEmpty {
        return fired.map { "\($0.headline) (\($0.citation))" }
    }
    var reasons: [String] = []
    if draft.household.hasMinorInHousehold == true {
        reasons.append("Minor children in household")
    }
    if draft.income.incomeChangesMonthToMonth == .yes {
        reasons.append("Income varies month to month")
    }
    if draft.household.hasElderlyOrDisabled == true {
        reasons.append("Elderly or disabled member")
    }
    return reasons
}

// MARK: - Clarifying question

/// When the triage result is `.uncertain`, returns the section + a
/// short prompt for the most-discriminating unanswered soft signal.
/// Returns nil when there's nothing useful to ask (e.g., user is
/// already past every soft-signal screen).
///
/// Full implementation lands with the housing-situation section.
func clarifyingQuestion(
    for result: ExpeditedTriageResult,
    draft: SNAPApplicationDraft
) -> (SNAPApplicationSection, String)? {
    guard result.state == .uncertain else { return nil }
    return nil
}
