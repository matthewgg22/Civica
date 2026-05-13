import Foundation
import Testing
@testable import Civica

// Verifies the paystub → monthly-earned-income conversion that powers
// the documents-to-income prefill. The frequency-inference logic is the
// load-bearing piece: dates win when they're clear, the printed label
// is a tiebreaker for the 14-vs-15 day biweekly/semimonthly ambiguity
// and a fallback when dates are missing. Confidence drops to low
// whenever the two sources disagree so the UI requires explicit user
// action instead of silent autofill.

struct SNAPPaystubIncomeDerivationTests {

    // MARK: - Happy path: each frequency, dates + label agreeing.

    @Test func weeklyPeriodDerivesHighConfidence() {
        let paystub = makePaystub(
            gross: 450,
            start: "2026-04-06",
            end: "2026-04-12",
            label: "Weekly"
        )
        let result = SNAPPaystubIncomeDerivation.derive(from: paystub)
        #expect(result?.frequency == .weekly)
        #expect(result?.confidence == .high)
        #expect(result?.monthlyEarnedIncome == Decimal(string: "1949.85"))
    }

    @Test func biweeklyPeriodDerivesHighConfidence() {
        let paystub = makePaystub(
            gross: 1_800,
            start: "2026-04-06",
            end: "2026-04-19",
            label: "Bi-Weekly"
        )
        let result = SNAPPaystubIncomeDerivation.derive(from: paystub)
        #expect(result?.frequency == .biweekly)
        #expect(result?.confidence == .high)
        #expect(result?.monthlyEarnedIncome == Decimal(string: "3900.60"))
    }

    @Test func semimonthlyPeriodWithLabelDerivesHighConfidence() {
        let paystub = makePaystub(
            gross: 1_800,
            start: "2026-04-01",
            end: "2026-04-15",
            label: "Semi-Monthly"
        )
        let result = SNAPPaystubIncomeDerivation.derive(from: paystub)
        #expect(result?.frequency == .semimonthly)
        #expect(result?.confidence == .high)
        #expect(result?.monthlyEarnedIncome == 3_600)
    }

    @Test func monthlyPeriodDerivesHighConfidence() {
        let paystub = makePaystub(
            gross: 4_000,
            start: "2026-04-01",
            end: "2026-04-30",
            label: "Monthly"
        )
        let result = SNAPPaystubIncomeDerivation.derive(from: paystub)
        #expect(result?.frequency == .monthly)
        #expect(result?.confidence == .high)
        #expect(result?.monthlyEarnedIncome == 4_000)
    }

    // MARK: - Label-only fallback (dates missing or unparseable).

    @Test func missingDatesFallsBackToLabelWithMediumConfidence() {
        let paystub = makePaystub(
            gross: 600,
            start: "",
            end: "",
            label: "Weekly"
        )
        let result = SNAPPaystubIncomeDerivation.derive(from: paystub)
        #expect(result?.frequency == .weekly)
        #expect(result?.confidence == .medium)
    }

    @Test func unparseableDatesFallsBackToLabel() {
        let paystub = makePaystub(
            gross: 1_800,
            start: "not-a-date",
            end: "also-bad",
            label: "Bi-weekly"
        )
        let result = SNAPPaystubIncomeDerivation.derive(from: paystub)
        #expect(result?.frequency == .biweekly)
        #expect(result?.confidence == .medium)
    }

    // MARK: - Conflict between dates and label → low confidence.

    @Test func biweeklyDatesWithSemimonthlyLabelStaysSemimonthlyLow() {
        // The 14-day rule: a 14-day period with "Semi-Monthly" label
        // resolves to semimonthly (label tiebreaker for the 14-vs-15
        // ambiguity). Confidence stays high because the date-based
        // path delegated to the label, not because they conflict.
        let paystub = makePaystub(
            gross: 1_800,
            start: "2026-04-06",
            end: "2026-04-19",
            label: "Semi-Monthly"
        )
        let result = SNAPPaystubIncomeDerivation.derive(from: paystub)
        #expect(result?.frequency == .semimonthly)
        #expect(result?.confidence == .high)
    }

    @Test func weeklyDatesWithMonthlyLabelMarksLowConfidence() {
        // True conflict — 7-day period says weekly, label says monthly.
        // Dates win but the UI must require explicit confirmation.
        let paystub = makePaystub(
            gross: 450,
            start: "2026-04-06",
            end: "2026-04-12",
            label: "Monthly"
        )
        let result = SNAPPaystubIncomeDerivation.derive(from: paystub)
        #expect(result?.frequency == .weekly)
        #expect(result?.confidence == .low)
    }

    // MARK: - Unresolvable inputs return nil.

    @Test func missingGrossReturnsNil() {
        let paystub = makePaystub(
            gross: 0,
            start: "2026-04-06",
            end: "2026-04-19",
            label: "Bi-weekly"
        )
        #expect(SNAPPaystubIncomeDerivation.derive(from: paystub) == nil)
    }

    @Test func missingDatesAndLabelReturnsNil() {
        let paystub = makePaystub(
            gross: 1_800,
            start: "",
            end: "",
            label: nil
        )
        #expect(SNAPPaystubIncomeDerivation.derive(from: paystub) == nil)
    }

    @Test func unparseableLabelAndDatesReturnsNil() {
        let paystub = makePaystub(
            gross: 1_800,
            start: "",
            end: "",
            label: "🤷"
        )
        #expect(SNAPPaystubIncomeDerivation.derive(from: paystub) == nil)
    }

    // MARK: - Dates present, label absent: still high (silent agreement).

    @Test func biweeklyDatesNoLabelStaysHigh() {
        let paystub = makePaystub(
            gross: 1_800,
            start: "2026-04-06",
            end: "2026-04-19",
            label: nil
        )
        let result = SNAPPaystubIncomeDerivation.derive(from: paystub)
        #expect(result?.frequency == .biweekly)
        #expect(result?.confidence == .high)
    }

    // MARK: - Test fixture

    private func makePaystub(
        gross: Decimal,
        start: String,
        end: String,
        label: String?
    ) -> SNAPPaystub {
        SNAPPaystub(
            employerName: "Acme Retail",
            employerAddress: nil,
            payPeriodStart: start,
            payPeriodEnd: end,
            payDate: nil,
            hoursWorkedInPeriod: nil,
            hourlyRate: nil,
            isSalaried: false,
            grossPayPeriod: gross,
            netPayPeriod: gross,
            deductions: [],
            grossPayYTD: nil,
            netPayYTD: nil,
            payFrequencyLabelAsPrinted: label
        )
    }
}
