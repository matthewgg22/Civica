import Foundation

// Policy-as-code surface for SNAP eligibility. One conformer per
// state (plus a FederalDefaultRules fallback); each owns the
// thresholds, deduction tables, student exemption rules, expedited
// criteria, and ABAWD posture for that jurisdiction.
//
// The `asOf:` parameter is load-bearing. SNAP rules change: federal
// poverty guidelines re-issue every Oct 1 (FY boundary), state
// emergency rules come and go, BBCE thresholds get re-legislated.
// Conformers encode thresholds as date-keyed snapshots and select
// the active one from `asOf:`. The version stamp returned by
// `rulesVersion(asOf:)` lands in SNAPEligibilityResult.rulesVersion
// and is rendered in the audit footer of SNAPDecisionMathView.
//
// Method names and shapes mirror the Python rules engine in
// backend/civic_api/snap/rules/ so the Swift offline gate and the
// Python authoritative engine can be cross-checked on the same
// contract. When the backend is wired in over HTTP, conformers
// here act as the offline mirror.

protocol SNAPStateRuleEngine {
    /// Two-letter USPS state code, or "FEDERAL_DEFAULT" for the
    /// federal-baseline fallback used when no state-specific
    /// conformer is registered.
    var stateCode: String { get }
    var displayName: String { get }

    /// Monthly gross-income gate. For BBCE-expanded states this
    /// is higher than the federal 130% FPL line.
    func grossIncomeLimit(householdSize: Int, asOf: Date) -> Decimal

    /// Monthly net-income gate (100% FPL federally). BBCE states
    /// effectively waive this for most households, but the value
    /// is still returned so backend deduction math can use it.
    func netIncomeLimit(householdSize: Int, asOf: Date) -> Decimal

    /// Federal/state standard deduction applied to gross income
    /// before net-income calculation. Varies by household size.
    func standardDeduction(householdSize: Int, asOf: Date) -> Decimal

    /// Cap on the excess-shelter deduction. Returns nil when the
    /// cap does not apply (elderly/disabled households federally).
    func shelterDeductionCap(isElderlyOrDisabled: Bool, asOf: Date) -> Decimal?

    /// Evaluates the SNAP student gate (7 CFR 273.5) against the
    /// applicant draft. Federal exceptions plus any state-specific
    /// additions (MA DTA-approved self-sufficiency programs, CA
    /// EOPS, NY ACE, etc.).
    func studentExemption(for draft: SNAPApplicationDraft, asOf: Date) -> StudentExemption

    /// Expedited service thresholds (7 CFR 273.2(i)) — federal
    /// floor; states may not weaken them but can broaden.
    func expeditedCriteria(asOf: Date) -> ExpeditedCriteria

    /// Whether ABAWD time-limit rules apply to this applicant
    /// today, accounting for the age band, dependents, and any
    /// active state/area waiver.
    func abawdStatus(for draft: SNAPApplicationDraft, asOf: Date) -> ABAWDStatus

    /// Stable version stamp for the policy snapshot active on
    /// `asOf` — e.g. "MA-bbce-200pct-FY26", "federal-default-FY26".
    /// Stamped into SNAPEligibilityResult.rulesVersion for the
    /// audit footer.
    func rulesVersion(asOf: Date) -> String
}

// MARK: - Student exemption

/// Outcome of the 7 CFR 273.5 student gate. `categoricallyDisqualified`
/// is a categorical eligibility bar even when income passes; the
/// other cases let the income/asset path continue.
enum StudentExemption: Equatable {
    /// Not enrolled in higher ed, or enrolled less than half-time.
    /// Student gate does not apply.
    case notSubject

    /// Enrolled half-time+ but meets a federal or state exception.
    case exempted(reason: ExemptionReason)

    /// Enrolled half-time+ with no qualifying exception. Bars
    /// eligibility regardless of income.
    case categoricallyDisqualified

    /// Insufficient information in the draft to evaluate. Caller
    /// should defer rather than guess.
    case unknown
}

enum ExemptionReason: Equatable {
    case worksTwentyHoursPerWeek
    case workStudy
    case dependentChildCare
    case under18OrOver50
    case lessThanHalfTime
    /// State-specific exemption (MA self-sufficiency program,
    /// CA EOPS, etc.). Free-form so each state can name its own
    /// without forcing protocol-level enum churn.
    case stateSpecific(String)
}

// MARK: - Expedited service

/// Federal expedited-service thresholds, parametrized so future
/// state rules can override the floor.
struct ExpeditedCriteria: Equatable {
    /// Gate 1 income ceiling. Federal default: $150/mo.
    let grossIncomeUnder: Decimal
    /// Gate 1 liquid resources ceiling. Federal default: $100.
    let liquidResourcesAtOrUnder: Decimal
    /// Gate 2: rent + utilities exceed gross income + liquid
    /// resources. Federal default: true.
    let rentPlusUtilitiesGate: Bool
    /// Gate 3: migrant / seasonal farmworker destitute status.
    /// Federal default: true. App flow does not collect this yet.
    let migrantFarmworkerGate: Bool
}

// MARK: - ABAWD

/// Able-bodied adult without dependents (ABAWD) posture for the
/// applicant on `asOf`. The 3-month time limit kicks in for
/// subject applicants who aren't meeting work requirements and
/// aren't covered by a waiver.
enum ABAWDStatus: Equatable {
    /// Outside the ABAWD age band, has dependents under 18, is
    /// pregnant, or is otherwise federally exempt from the rule.
    case notSubject

    /// Subject to ABAWD work requirements and currently meeting
    /// them (20+ hours/week of qualifying work or training).
    case subjectActive

    /// Subject in principle but covered by a state-wide or
    /// area-level waiver in effect on `asOf`.
    case subjectInWaiver

    /// Subject and at risk of hitting the 3-month time limit;
    /// `monthsRemaining` is the federal estimate based on the
    /// applicant's reported work history.
    case subjectAtRisk(monthsRemaining: Int)

    /// Insufficient information in the draft to evaluate.
    case unknown
}

// MARK: - Policy snapshot helper

/// Date-keyed window used by conformers to encode an FY-by-FY
/// threshold table. `contains(_:)` is the only public entry point;
/// each conformer keeps its own private `[PolicySnapshot<T>]` and
/// picks the active one from `asOf:`.
struct PolicySnapshot<Value> {
    let effectiveFrom: Date
    let expiresOn: Date
    let value: Value
    /// Stable label for `rulesVersion(asOf:)`. Conformers compose
    /// this with their state prefix — e.g. MA prepends "MA-bbce-200pct-".
    let versionSuffix: String

    func contains(_ date: Date) -> Bool {
        date >= effectiveFrom && date <= expiresOn
    }
}

/// Convenience constructor — encodes effective/expires dates as
/// ISO strings so conformer files stay declarative and don't have
/// to hand-build DateComponents.
extension PolicySnapshot {
    static func iso(
        from: String,
        to: String,
        versionSuffix: String,
        value: Value
    ) -> PolicySnapshot<Value> {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withFullDate]
        guard
            let fromDate = formatter.date(from: from),
            let toDate = formatter.date(from: to)
        else {
            fatalError("PolicySnapshot.iso: invalid ISO date — from=\(from) to=\(to)")
        }
        return PolicySnapshot(
            effectiveFrom: fromDate,
            expiresOn: toDate,
            value: value,
            versionSuffix: versionSuffix
        )
    }
}
