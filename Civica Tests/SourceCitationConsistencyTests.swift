import Foundation
import Testing
@testable import Civica

// Asserts that FederalDefaultRules output at FY26 matches the
// canonical signoff values in docs/snap_source_citation_fy26_federal.json.
//
// Why this test exists:
//   The source-citation signoff document
//   (docs/SNAP-source-citation-signoff.md) names the dollar values
//   counsel reviewed. If a future PR changes a value in
//   FederalDefaultRules.swift but forgets the doc — or vice versa —
//   we'd ship eligibility math counsel never signed off on.
//
//   The JSON fixture is the single source of truth. Both the
//   markdown signoff doc and this test consume it. Drift in either
//   direction trips this test.
//
// When FY27 lands:
//   1. Update docs/snap_source_citation_fy26_federal.json (or rename
//      to fy27 and update VERIFIED_FISCAL_YEAR below)
//   2. Update FederalDefaultRules.swift snapshot tables
//   3. This test asserts the two stay in lockstep
//
// Per the engineering signoff policy (AI verification = engineering
// signoff), the JSON file is the authoritative engineering-verified
// record. Counsel signoff layers on top via the .md document.

struct SourceCitationConsistencyTests {

    private static let VERIFIED_FISCAL_YEAR = "FY26"

    /// 2026-03-15 — inside the FY26 snapshot window (2025-10-01 to
    /// 2026-09-30). Same date the federal/state rules tests use so
    /// the consistency check exercises the active snapshot.
    private let fy26Date: Date = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withFullDate]
        return f.date(from: "2026-03-15")!
    }()

    private let rules = FederalDefaultRules()

    // MARK: - Fixture loading

    /// Parses the canonical JSON. Returns nil and skips the test
    /// (via #expect with no body) if the file is missing — surfaces
    /// the drift as a test failure rather than crashing.
    private func loadFixture() -> SourceCitationFixture? {
        let testFile = URL(fileURLWithPath: #file)
        // #file: <repo>/Civica Tests/SourceCitationConsistencyTests.swift
        // → drop file → drop "Civica Tests" → repo root
        let repoRoot = testFile
            .deletingLastPathComponent()
            .deletingLastPathComponent()
        let jsonURL = repoRoot
            .appendingPathComponent("docs")
            .appendingPathComponent("snap_source_citation_fy26_federal.json")
        guard let data = try? Data(contentsOf: jsonURL) else {
            Issue.record("Could not read fixture at \(jsonURL.path)")
            return nil
        }
        do {
            return try JSONDecoder().decode(SourceCitationFixture.self, from: data)
        } catch {
            Issue.record("Failed to decode fixture JSON: \(error)")
            return nil
        }
    }

    // MARK: - Fixture sanity

    @Test func fixtureFiscalYearMatchesExpectation() {
        guard let fixture = loadFixture() else { return }
        #expect(fixture.fiscalYear == Self.VERIFIED_FISCAL_YEAR)
    }

    // MARK: - Row 5: max allotments

    @Test func row5MaxAllotmentsMatchEngine() {
        guard let fixture = loadFixture() else { return }
        for (sizeStr, expected) in fixture.rows.row5MaxAllotments.perSize {
            let size = Int(sizeStr)!
            let actual = rules.maxAllotment(householdSize: size, asOf: fy26Date)
            #expect(actual == Decimal(expected),
                "Row 5 drift at HH=\(size): engine=\(actual), doc=\(expected)")
        }
    }

    @Test func row5PerAdditionalMatchesEngine() {
        guard let fixture = loadFixture() else { return }
        let perAdd = Decimal(fixture.rows.row5MaxAllotments.perAdditional)
        let eight = rules.maxAllotment(householdSize: 8, asOf: fy26Date)
        let nine = rules.maxAllotment(householdSize: 9, asOf: fy26Date)
        #expect(nine - eight == perAdd,
            "Row 5 per-additional drift: engine=\(nine - eight), doc=\(perAdd)")
    }

    // MARK: - Row 6: standard deduction

    @Test func row6StandardDeductionMatchesEngine() {
        guard let fixture = loadFixture() else { return }
        for (sizeStr, expected) in fixture.rows.row6StandardDeduction.perSize {
            let size = Int(sizeStr)!
            let actual = rules.standardDeduction(householdSize: size, asOf: fy26Date)
            #expect(actual == Decimal(expected),
                "Row 6 drift at HH=\(size): engine=\(actual), doc=\(expected)")
        }
    }

    // MARK: - Row 7: max excess shelter deduction

    @Test func row7ShelterDeductionCapMatchesEngine() {
        guard let fixture = loadFixture() else { return }
        let actual = rules.shelterDeductionCap(isElderlyOrDisabled: false, asOf: fy26Date)
        #expect(actual == Decimal(fixture.rows.row7MaxExcessShelterDeduction.cap),
            "Row 7 drift: engine=\(actual ?? -1), doc=\(fixture.rows.row7MaxExcessShelterDeduction.cap)")
    }

    @Test func row7ElderlyOrDisabledHasNoShelterCap() {
        // Codified in the JSON's description field — assert engine respects it.
        let actual = rules.shelterDeductionCap(isElderlyOrDisabled: true, asOf: fy26Date)
        #expect(actual == nil,
            "Engine should return nil cap for elderly/disabled households per row 7 description")
    }

    // MARK: - Row 8: minimum benefit

    @Test func row8MinimumBenefitMatchesEngine() {
        guard let fixture = loadFixture() else { return }
        let actual = rules.minimumBenefit(asOf: fy26Date)
        #expect(actual == Decimal(fixture.rows.row8MinimumBenefit.amount),
            "Row 8 drift: engine=\(actual), doc=\(fixture.rows.row8MinimumBenefit.amount)")
    }

    // MARK: - Row 9: gross income limits

    @Test func row9GrossIncomeLimitsMatchEngine() {
        guard let fixture = loadFixture() else { return }
        for (sizeStr, expected) in fixture.rows.row9GrossIncomeLimits.perSize {
            let size = Int(sizeStr)!
            let actual = rules.grossIncomeLimit(householdSize: size, asOf: fy26Date)
            #expect(actual == Decimal(expected),
                "Row 9 drift at HH=\(size): engine=\(actual), doc=\(expected)")
        }
    }

    @Test func row9PerAdditionalMatchesEngine() {
        guard let fixture = loadFixture() else { return }
        let perAdd = Decimal(fixture.rows.row9GrossIncomeLimits.perAdditional)
        let eight = rules.grossIncomeLimit(householdSize: 8, asOf: fy26Date)
        let nine = rules.grossIncomeLimit(householdSize: 9, asOf: fy26Date)
        #expect(nine - eight == perAdd)
    }

    // MARK: - Row 10: net income limits

    @Test func row10NetIncomeLimitsMatchEngine() {
        guard let fixture = loadFixture() else { return }
        for (sizeStr, expected) in fixture.rows.row10NetIncomeLimits.perSize {
            let size = Int(sizeStr)!
            let actual = rules.netIncomeLimit(householdSize: size, asOf: fy26Date)
            #expect(actual == Decimal(expected),
                "Row 10 drift at HH=\(size): engine=\(actual), doc=\(expected)")
        }
    }

    @Test func row10PerAdditionalMatchesEngine() {
        guard let fixture = loadFixture() else { return }
        let perAdd = Decimal(fixture.rows.row10NetIncomeLimits.perAdditional)
        let eight = rules.netIncomeLimit(householdSize: 8, asOf: fy26Date)
        let nine = rules.netIncomeLimit(householdSize: 9, asOf: fy26Date)
        #expect(nine - eight == perAdd)
    }

    // MARK: - Row 11: asset limits

    @Test func row11AssetLimitsMatchEngine() {
        guard let fixture = loadFixture() else { return }
        let actualStd = rules.assetLimit(isElderlyOrDisabled: false, asOf: fy26Date)
        let actualEld = rules.assetLimit(isElderlyOrDisabled: true, asOf: fy26Date)
        #expect(actualStd == Decimal(fixture.rows.row11AssetLimits.standardHousehold))
        #expect(actualEld == Decimal(fixture.rows.row11AssetLimits.elderlyOrDisabledHousehold))
    }
}

// MARK: - Fixture model

private struct SourceCitationFixture: Decodable {
    let fiscalYear: String
    let rows: Rows

    enum CodingKeys: String, CodingKey {
        case fiscalYear = "fiscal_year"
        case rows
    }

    struct Rows: Decodable {
        let row5MaxAllotments: MaxAllotments
        let row6StandardDeduction: StandardDeduction
        let row7MaxExcessShelterDeduction: ShelterCap
        let row8MinimumBenefit: MinimumBenefit
        let row9GrossIncomeLimits: IncomeLimits
        let row10NetIncomeLimits: IncomeLimits
        let row11AssetLimits: AssetLimits

        enum CodingKeys: String, CodingKey {
            case row5MaxAllotments = "row_5_max_allotments"
            case row6StandardDeduction = "row_6_standard_deduction"
            case row7MaxExcessShelterDeduction = "row_7_max_excess_shelter_deduction"
            case row8MinimumBenefit = "row_8_minimum_benefit"
            case row9GrossIncomeLimits = "row_9_gross_income_limits"
            case row10NetIncomeLimits = "row_10_net_income_limits"
            case row11AssetLimits = "row_11_asset_limits"
        }
    }

    struct MaxAllotments: Decodable {
        let perSize: [String: Int]
        let perAdditional: Int

        enum CodingKeys: String, CodingKey {
            case perSize = "per_size"
            case perAdditional = "per_additional"
        }
    }

    struct StandardDeduction: Decodable {
        let perSize: [String: Int]

        enum CodingKeys: String, CodingKey {
            case perSize = "per_size"
        }
    }

    struct ShelterCap: Decodable {
        let cap: Int
    }

    struct MinimumBenefit: Decodable {
        let amount: Int
    }

    struct IncomeLimits: Decodable {
        let perSize: [String: Int]
        let perAdditional: Int

        enum CodingKeys: String, CodingKey {
            case perSize = "per_size"
            case perAdditional = "per_additional"
        }
    }

    struct AssetLimits: Decodable {
        let standardHousehold: Int
        let elderlyOrDisabledHousehold: Int

        enum CodingKeys: String, CodingKey {
            case standardHousehold = "standard_household"
            case elderlyOrDisabledHousehold = "elderly_or_disabled_household"
        }
    }
}
