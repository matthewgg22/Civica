import Foundation
import Testing
@testable import Civica

// Tests for the OBBBA audit Worktree B refactor: the standalone
// estimator no longer carries independent federal constants. Every
// threshold comes from SNAPBenefitEstimatorCalculator.rules, and
// the estimator's output must agree with the rules engine on every
// dollar value the audit flagged as divergent (max allotment,
// standard deduction, shelter cap, minimum benefit).

struct SNAPBenefitEstimatorCalculatorTests {

    /// Parity: the estimator's reported `maxAllotmentForHousehold
    /// Size` must equal `rules.maxAllotment(householdSize:asOf:)`
    /// for every household size in the slider range. If a future
    /// commit reintroduces estimator-local max allotment constants,
    /// this test fails immediately for whichever size diverges.
    @Test func maxAllotmentMatchesRulesEngineForEveryHouseholdSize() {
        let inputs = SNAPBenefitEstimatorInputs(
            householdSize: 1,
            elderlyOrDisabled: false,
            grossMonthlyIncome: 0,
            monthlyRent: 0,
            paysUtilitiesSeparately: false
        )
        let today = Date()
        for size in SNAPBenefitEstimatorCalculator.householdSizeRange {
            var sized = inputs
            sized.householdSize = size
            let outcome = SNAPBenefitEstimatorCalculator.calculate(sized)
            let detail = outcome.detail
            let fromRules = SNAPBenefitEstimatorCalculator.rules.maxAllotment(
                householdSize: size, asOf: today
            )
            #expect(
                detail.maxAllotmentForHouseholdSize == fromRules,
                "Estimator's max allotment for size \(size) (\(detail.maxAllotmentForHouseholdSize)) must match rules engine (\(fromRules))"
            )
        }
    }

    /// Parity: standard deduction must match the rules engine's
    /// answer for every bucket boundary (1, 4, 5, 6+).
    @Test func standardDeductionMatchesRulesEngineForBucketBoundaries() {
        let today = Date()
        for size in [1, 4, 5, 6, 8] {
            let inputs = SNAPBenefitEstimatorInputs(
                householdSize: size,
                elderlyOrDisabled: false,
                grossMonthlyIncome: 100,
                monthlyRent: 0,
                paysUtilitiesSeparately: false
            )
            let outcome = SNAPBenefitEstimatorCalculator.calculate(inputs)
            let fromRules = SNAPBenefitEstimatorCalculator.rules.standardDeduction(
                householdSize: size, asOf: today
            )
            #expect(
                outcome.detail.standardDeduction == fromRules,
                "Estimator's standard deduction for size \(size) (\(outcome.detail.standardDeduction)) must match rules engine (\(fromRules))"
            )
        }
    }

    /// The gross-income gate is the rules engine's exact table; a
    /// gross income one dollar over the threshold trips
    /// .grossIncomeOverLimit.
    @Test func grossIncomeGateUsesRulesEngineThreshold() {
        let today = Date()
        let size = 2
        let threshold = SNAPBenefitEstimatorCalculator.rules.grossIncomeLimit(
            householdSize: size, asOf: today
        )

        let belowInputs = SNAPBenefitEstimatorInputs(
            householdSize: size,
            elderlyOrDisabled: false,
            grossMonthlyIncome: threshold,
            monthlyRent: 100,
            paysUtilitiesSeparately: false
        )
        let belowOutcome = SNAPBenefitEstimatorCalculator.calculate(belowInputs)
        // At-threshold gross should not trip the gate (the gate fires
        // strictly above the threshold). The outcome can still be
        // ineligible for other reasons (e.g. zero-benefit), but not
        // .grossIncomeOverLimit.
        switch belowOutcome {
        case .ineligible(.grossIncomeOverLimit, _):
            Issue.record("Estimator tripped grossIncomeOverLimit at the threshold; gate should be strict >, not >=")
        default:
            break
        }

        var aboveInputs = belowInputs
        aboveInputs.grossMonthlyIncome = threshold + 1
        let aboveOutcome = SNAPBenefitEstimatorCalculator.calculate(aboveInputs)
        switch aboveOutcome {
        case .ineligible(.grossIncomeOverLimit, _):
            break
        default:
            Issue.record("Estimator did not trip grossIncomeOverLimit one dollar above the threshold")
        }
    }

    /// Elderly/disabled households waive the gross-income gate. A
    /// gross income above the threshold must NOT trip
    /// .grossIncomeOverLimit when elderlyOrDisabled is true.
    @Test func grossIncomeGateIsWaivedForElderlyOrDisabled() {
        let today = Date()
        let size = 2
        let threshold = SNAPBenefitEstimatorCalculator.rules.grossIncomeLimit(
            householdSize: size, asOf: today
        )
        let inputs = SNAPBenefitEstimatorInputs(
            householdSize: size,
            elderlyOrDisabled: true,
            grossMonthlyIncome: threshold + 500,
            monthlyRent: 0,
            paysUtilitiesSeparately: false
        )
        let outcome = SNAPBenefitEstimatorCalculator.calculate(inputs)
        switch outcome {
        case .ineligible(.grossIncomeOverLimit, _):
            Issue.record("Estimator tripped grossIncomeOverLimit for elderly/disabled household; the gate should be waived")
        default:
            break
        }
    }

    /// Federal-default has no SUA chart, so `paysUtilitiesSeparately`
    /// must not add a synthetic utility deduction. The estimator's
    /// excessShelterDeduction must equal the rent-only computation.
    @Test func paysUtilitiesSeparatelyAddsNothingWhenSUAUnavailable() {
        // Confirm precondition: the active rules engine has no SUA
        // chart. If a future change wires MA rules in here, this
        // test's precondition fails loudly and the test should be
        // rewritten to reflect SUA behavior.
        let suaValue = SNAPBenefitEstimatorCalculator.rules.suaValue(
            tier: .heatingCooling, asOf: Date()
        )
        guard suaValue == nil else {
            Issue.record("Test precondition broken: rules engine now returns an SUA value (\(String(describing: suaValue))). Rewrite this test to assert SUA substitution behavior.")
            return
        }

        let inputs = SNAPBenefitEstimatorInputs(
            householdSize: 2,
            elderlyOrDisabled: false,
            grossMonthlyIncome: 1_500,
            monthlyRent: 800,
            paysUtilitiesSeparately: true
        )
        let withSeparate = SNAPBenefitEstimatorCalculator.calculate(inputs)

        var bundled = inputs
        bundled.paysUtilitiesSeparately = false
        let withoutSeparate = SNAPBenefitEstimatorCalculator.calculate(bundled)

        #expect(
            withSeparate.detail.excessShelterDeduction == withoutSeparate.detail.excessShelterDeduction,
            "paysUtilitiesSeparately must not affect the deduction when the rules engine has no SUA chart"
        )
    }

    /// rulesVersion stamps must reach back to the underlying
    /// PolicySnapshot — the estimator now composes its version
    /// string from the rules engine, not from its own constants.
    @Test func rulesVersionTracksUnderlyingEngine() {
        let stamp = SNAPBenefitEstimatorCalculator.rulesVersion
        let engineStamp = SNAPBenefitEstimatorCalculator.rules.rulesVersion(asOf: Date())
        #expect(stamp.contains(engineStamp),
                "Estimator rulesVersion (\(stamp)) must reference the rules-engine version (\(engineStamp))")
    }
}
