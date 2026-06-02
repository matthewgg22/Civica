// Codable representation of the v0.6 fixture's facts shape. Mirrors
// packages/snap-rules/src/facts.ts and Civica Tests/CivicaTestProfile.swift
// — independent Swift encoding, not a reuse.

import Foundation

enum SUATier: String, Codable {
    case HCSUA, LUA, phone, none
}

struct Member: Codable {
    let member_id: String
    let age: Int
    let role: String
    let disability: Bool?
    let elderly: Bool?
    let student: String?
    let immigration: String?
    let five_yr_bar: String?
    let sponsored: Bool?
    let work_class: String?
    let abawd_months_used: Int?
    let disqual: [String]?
    let living: String?
}

struct IncomeLine: Codable {
    let member: String?
    let type: String?
    let amount: Double
    let freq: String?
    let anticipation: String?
    let source_status: String?
}

struct Shelter: Codable {
    let rent: Double
    let sua_tier: SUATier
    let sua_amount: Double
    let internet: Double?
    let homeless_deduction: Bool?
}

struct Deductions: Codable {
    let dependent_care: Double?
    let medical_unreimbursed: Double?
    let child_support_paid: Double?
}

// `assets` may be a number or a sentinel string.
enum AssetsField: Codable {
    case amount(Double)
    case categoricalNoAssetTest
    case notAuthored

    init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if let d = try? c.decode(Double.self) { self = .amount(d); return }
        let s = (try? c.decode(String.self)) ?? "n/a:not_authored"
        switch s {
        case "n/a:categorical_no_asset_test": self = .categoricalNoAssetTest
        default: self = .notAuthored
        }
    }
    func encode(to encoder: Encoder) throws {
        var c = encoder.singleValueContainer()
        switch self {
        case .amount(let d): try c.encode(d)
        case .categoricalNoAssetTest: try c.encode("n/a:categorical_no_asset_test")
        case .notAuthored: try c.encode("n/a:not_authored")
        }
    }
    var asNumber: Double? { if case .amount(let d) = self { return d }; return nil }
}

struct Facts: Codable {
    var household: [Member]
    var income: [IncomeLine]
    var shelter: Shelter
    var deductions: Deductions
    var assets: AssetsField
    var cat_elig: String
    var expedited: Bool?
    var sponsor_income: Double?
    // Pseudo-field — variants override via facts_patch.
    var as_of_date: String?
    // Variant-specific flags consumed by the composition gate.
    var must_combine_with_parent: Bool?
    var coresident_income_pct: Int?
    var shares_meals: Bool?
    var active_warrant: Bool?
}

// Earned-income classification mirrors the TS port.
let EARNED_TYPES: Set<String> = ["wages", "self_employment", "farm_se", "wages_contract"]

// Defensive against missing type (variant patches may not populate it on
// rows added against an empty base — see TS comment).
func isExcludedIncome(_ type: String?) -> Bool {
    guard let type else { return false }
    if type.hasPrefix("excluded") { return true }
    if type.hasPrefix("americorps_sn_excluded") { return true }
    if type.hasPrefix("americorps_vista_excluded") { return true }
    if type.contains("vendor") { return true }
    return false
}

struct IncomeAggregate {
    let earned: Double
    let unearned: Double
    let gross: Double
}

func aggregateIncome(_ facts: Facts) -> IncomeAggregate {
    var earned = 0.0, unearned = 0.0
    for line in facts.income {
        if isExcludedIncome(line.type) { continue }
        if let t = line.type, EARNED_TYPES.contains(t) { earned += line.amount }
        else { unearned += line.amount }
    }
    if earned < 0 {
        unearned = max(0.0, unearned + earned)
        earned = 0
    }
    // Sponsor income deeming (7 CFR 273.11(j)).
    if let sponsorInc = facts.sponsor_income, sponsorInc > 0,
       facts.household.contains(where: { $0.sponsored == true }) {
        unearned += sponsorInc
    }
    return IncomeAggregate(earned: earned, unearned: unearned, gross: earned + unearned)
}

func householdSize(_ facts: Facts) -> Int { facts.household.count }

func hasElderlyOrDisabled(_ facts: Facts) -> Bool {
    facts.household.contains { m in
        m.disability == true || m.elderly == true || m.age >= 60
    }
}
