import Foundation
import Testing
@testable import Civica

/// Wires the engine to the canonical Civica SNAP test-profile suite
/// (data-ops/test-scenarios/civica/civica_test_profiles.json, v0.6).
///
/// This suite does NOT yet exercise per-profile verdict assertions — the
/// engine doesn't compose a top-level "compute SNAP verdict for a draft"
/// function, and 90+ of the 110 profiles test surfaces (ABAWD month
/// tracking, student exemption tiers, immigration five-year-bar, IPV,
/// lottery, sponsor income, etc.) that JsonDrivenStateRules doesn't
/// expose yet.
///
/// What it DOES exercise:
///   1. Schema-level params reconciliation between the dataset's
///      meta.params.sua_by_state and the engine's `suaValue(tier:)`
///      for CA + MA (the two states with authored production SUA).
///   2. min_benefit, shelter_cap, asset_limit pin against
///      meta.params (state-agnostic federal values).
///   3. Coverage report: counts profiles whose `requires[]` is fully
///      covered by the engine surfaces we expose today vs. those that
///      require unimplemented surfaces. The report itself isn't an
///      assertion — it's printed so reviewers see roadmap progress.
///
/// Adding a new pinned invariant: add a scenario to the dataset's
/// declarative file, regenerate, and the assertions below pick it up
/// automatically. Adding a NEW engine surface: implement it, add it
/// to `engineSurfaces` below, watch the coverage count rise.
struct SNAPEngineBatchScenariosTests {

    private let fy26Date = Self.iso("2026-03-15")

    // MARK: - Suite loading (one-time)

    /// Walk up from this source file to the repo root, then resolve the
    /// vendored v0.6 dataset. Avoids needing to add a bundle resource
    /// (which would require pbxproj edits per the project conventions).
    private static func datasetURL() throws -> URL {
        let sourceFile = URL(fileURLWithPath: #filePath)
        // .../Civica/Civica Tests/SNAPEngineBatchScenariosTests.swift
        //   parent: Civica Tests/
        //   parent: repo root
        let repoRoot = sourceFile
            .deletingLastPathComponent()
            .deletingLastPathComponent()
        return repoRoot
            .appendingPathComponent("data-ops")
            .appendingPathComponent("test-scenarios")
            .appendingPathComponent("civica")
            .appendingPathComponent("civica_test_profiles.json")
    }

    private static let suite: CivicaTestProfileSuite = {
        do {
            return try CivicaTestProfileSuite.load(from: try datasetURL())
        } catch {
            // Returning an empty suite means the suite-load test below
            // fails loudly with a readable message rather than silently
            // skipping every other test.
            return CivicaTestProfileSuite(
                meta: Meta(
                    version: "LOAD_ERROR: \(error)",
                    fy: "0",
                    basis: nil,
                    count: 0,
                    defaultState: "??",
                    states: [:],
                    params: Params(
                        fy: "0",
                        tolerance: 0,
                        sd: [:],
                        fpl: [:],
                        assetLimit: 0,
                        assetLimitEd: 0,
                        homelessDed: 0,
                        minBenefit: 0,
                        shelterCap: 0,
                        suaByState: [:],
                        allotmentTables: nil
                    ),
                    tolerances: Tolerances(
                        verdict: "exact_match", benefit: "exact_match",
                        qcThresholdDollars: nil, note: nil
                    ),
                    howToUse: nil, caveats: nil
                ),
                profiles: []
            )
        }
    }()

    // MARK: - Pre-flight

    /// Fails fast if the dataset didn't load. Every other test depends
    /// on `suite` being populated — without this guard, downstream
    /// failures would all look like "empty array, 0 tests run."
    @Test func suiteLoadedSuccessfully() {
        #expect(Self.suite.profiles.isEmpty == false,
                "Dataset failed to load — see meta.version sentinel: \(Self.suite.meta.version)")
        #expect(Self.suite.meta.version.hasPrefix("0.6") || Self.suite.meta.version.hasPrefix("0.7"),
                "Expected v0.6+ dataset, got \(Self.suite.meta.version)")
    }

    // MARK: - Per-state SUA reconciliation (the load-bearing one)

    /// CA SUA values in the dataset must match what
    /// JsonDrivenStateRules(stateCode:"CA").suaValue returns. If these
    /// drift, every benefit assertion downstream is silently invalid.
    @Test func caSUAValuesReconcileWithEngine() {
        let rules = JsonDrivenStateRules(stateCode: "CA")
        guard let datasetSua = Self.suite.meta.params.suaByState["CA"] ?? nil else {
            Issue.record("Dataset has no authored CA SUA — unexpected for v0.6")
            return
        }
        // HCSUA / LUA / phone — assert each tier matches.
        assertSUA(rules: rules, tier: .heatingCooling, expected: datasetSua["HCSUA"], label: "CA HCSUA")
        assertSUA(rules: rules, tier: .nonHeating,    expected: datasetSua["LUA"],   label: "CA LUA")
        assertSUA(rules: rules, tier: .phoneOnly,     expected: datasetSua["phone"], label: "CA phone")
    }

    /// MA SUA values pinned to DTA 106 CMR 364.976 (914 / 556 / 64).
    /// Same load-bearing role as CA: drift here invalidates the MA
    /// pilot's benefit story.
    @Test func maSUAValuesReconcileWithEngine() {
        let rules = JsonDrivenStateRules(stateCode: "MA")
        guard let datasetSua = Self.suite.meta.params.suaByState["MA"] ?? nil else {
            Issue.record("Dataset has no authored MA SUA — MA pilot integration broken")
            return
        }
        assertSUA(rules: rules, tier: .heatingCooling, expected: datasetSua["HCSUA"], label: "MA HCSUA")
        assertSUA(rules: rules, tier: .nonHeating,    expected: datasetSua["LUA"],   label: "MA LUA")
        assertSUA(rules: rules, tier: .phoneOnly,     expected: datasetSua["phone"], label: "MA phone")
    }

    /// Dataset must explicitly declare TX/KS/AK as unauthored —
    /// otherwise consumers might trust illustrative numbers as
    /// production assertions. Catches regression where someone
    /// accidentally lands real-looking values without verification.
    @Test func unauthoredStatesAreExplicitlyNull() {
        let suaByState = Self.suite.meta.params.suaByState
        for state in ["TX", "KS", "AK"] {
            let v = suaByState[state] ?? nil
            #expect(v == nil,
                    "[\(state)] expected SUA = null (illustrative state, not authored), got \(v ?? [:])")
        }
    }

    // MARK: - Federal-default params reconciliation

    /// Asset limits — federal values, state-agnostic. Engine reads
    /// these from FederalDefaultRules; dataset embeds same.
    @Test func assetLimitsReconcile() {
        let rules = JsonDrivenStateRules(stateCode: "CA")  // CA waives asset; values still defined federally
        let dataset = Self.suite.meta.params
        #expect(rules.assetLimit(isElderlyOrDisabled: false, asOf: fy26Date)
                    == Decimal(dataset.assetLimit),
                "non-E/D asset limit dataset=\(dataset.assetLimit) engine=\(rules.assetLimit(isElderlyOrDisabled: false, asOf: fy26Date))")
        #expect(rules.assetLimit(isElderlyOrDisabled: true, asOf: fy26Date)
                    == Decimal(dataset.assetLimitEd),
                "E/D asset limit dataset=\(dataset.assetLimitEd) engine=\(rules.assetLimit(isElderlyOrDisabled: true, asOf: fy26Date))")
    }

    /// Standard deduction per HH size. Federal values published in
    /// FNS COLA memo; dataset and engine should agree.
    @Test(arguments: [1, 2, 3, 4, 5, 6])
    func standardDeductionReconciles(_ size: Int) {
        let rules = JsonDrivenStateRules(stateCode: "CA")
        let datasetSD = Self.suite.meta.params.sd[String(size)]
        guard let expected = datasetSD else {
            Issue.record("Dataset has no SD for HH=\(size)")
            return
        }
        let actual = rules.standardDeduction(householdSize: size, asOf: fy26Date)
        #expect(actual == Decimal(expected),
                "HH=\(size) standard deduction: dataset=\(expected) engine=\(actual)")
    }

    /// Minimum benefit (1- or 2-person households, federal floor).
    @Test func minimumBenefitReconciles() {
        let rules = JsonDrivenStateRules(stateCode: "CA")
        let datasetMin = Self.suite.meta.params.minBenefit
        let engineMin = rules.minimumBenefit(asOf: fy26Date)
        #expect(engineMin == Decimal(datasetMin),
                "min benefit: dataset=\(datasetMin) engine=\(engineMin)")
    }

    /// Shelter cap for non-E/D households (federal). E/D bypass tested
    /// implicitly via `shelterDeductionCap(isElderlyOrDisabled: true) == nil`.
    @Test func shelterDeductionCapReconciles() {
        let rules = JsonDrivenStateRules(stateCode: "CA")
        let datasetCap = Self.suite.meta.params.shelterCap
        let engineCap = rules.shelterDeductionCap(isElderlyOrDisabled: false, asOf: fy26Date)
        #expect(engineCap == Decimal(datasetCap),
                "shelter cap: dataset=\(datasetCap) engine=\(String(describing: engineCap))")
        // E/D bypass: cap is uncapped (nil) per 7 CFR 273.9(d)(6).
        #expect(rules.shelterDeductionCap(isElderlyOrDisabled: true, asOf: fy26Date) == nil,
                "E/D shelter cap should be nil (uncapped)")
    }

    // MARK: - Coverage report (not an assertion — informational)

    /// Engine surfaces that JsonDrivenStateRules currently exposes,
    /// keyed by the canonical taxonomy at
    /// data-ops/test-scenarios/civica/requires_taxonomy.json. Adding a
    /// new engine surface => add its tag here => coverage count rises.
    private static let engineSurfacesImplementedToday: Set<String> = [
        "test.gross_net_fpl",
        "shelter.sua.HCSUA",
        "shelter.sua.LUA",
        "shelter.sua.phone",
        "shelter.uncapped",
    ]

    /// Reports how many profiles could be driven end-to-end today if
    /// we had a verdict composer. NOT an assertion — passes always.
    /// Read the printed output to see roadmap progress.
    @Test func coverageReport() {
        let surfaces = Self.engineSurfacesImplementedToday
        var coveredCount = 0
        var blockingTags: [String: Int] = [:]

        for p in Self.suite.profiles {
            let requires = Set(p.requires)
            if requires.isSubset(of: surfaces) {
                coveredCount += 1
            } else {
                for blocker in requires.subtracting(surfaces) {
                    blockingTags[blocker, default: 0] += 1
                }
            }
        }

        let total = Self.suite.profiles.count
        let pctCovered = total > 0 ? Double(coveredCount) / Double(total) * 100.0 : 0.0
        print("""
        ─── Civica SNAP test-profile coverage report (v\(Self.suite.meta.version)) ───
          Profiles in suite:                  \(total)
          Driveable with today's engine:      \(coveredCount) (\(String(format: "%.0f", pctCovered))%)
          Need additional engine surfaces:    \(total - coveredCount)

          Top blockers (engine surfaces with most-blocked profiles):
        """)
        for (tag, count) in blockingTags.sorted(by: { $0.value > $1.value }).prefix(10) {
            print(String(format: "    %3d profiles  %@", count, tag))
        }
        print("─────────────────────────────────────────────────────────────────")
        // Non-assertion test — passes always.
        #expect(true)
    }

    // MARK: - Helpers

    private func assertSUA(rules: JsonDrivenStateRules, tier: SUATier, expected: Double?, label: String) {
        guard let expected = expected else {
            Issue.record("[\(label)] dataset value missing")
            return
        }
        let actual = rules.suaValue(tier: tier, asOf: fy26Date)
        #expect(actual == Decimal(expected),
                "[\(label)] dataset=\(expected) engine=\(String(describing: actual))")
    }

    private static func iso(_ s: String) -> Date {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        f.timeZone = TimeZone(identifier: "UTC")
        return f.date(from: s)!
    }
}
