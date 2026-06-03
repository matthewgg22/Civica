// Federal SNAP tables (FY26) + state policies (CA, MA).
//
// SOURCES (same as the TS port — independently encoded here):
//   FNS COLA memo (August 2025) — max allotment, standard deduction
//   HHS Poverty Guidelines (January 2025 Federal Register) — FPL table
//   CDSS ACIN I-46-25 — CA SUA values
//   DTA 106 CMR 364.976 — MA SUA values
//
// This file is INDEPENDENT of the iOS production engine (
// `Civica/Features/SNAP/Rules/FederalDefaultRules.swift`). The TS and
// Swift encodings should agree because both port from FNS/HHS, not from
// each other. Disagreements localize the bug.

import Foundation

struct FederalSnapshot {
    let fiscalYear: Int
    let effectiveStart: Date
    let effectiveEnd: Date
    let fplAnnualFirstPerson: Double
    let fplAnnualEachAdditional: Double
    let maxAllotment: [Int: Double]
    let maxAllotmentEachAdditional: Double
    let standardDeduction: [Int: Double]
    let shelterCap: Double
    let minimumBenefit: Double
    let homelessDeduction: Double
    let assetLimitHousehold: Double
    let assetLimitEd: Double
    let earnedIncomeDeductionRate: Double
    let medicalFloor: Double
}

private func mkDate(_ y: Int, _ m: Int, _ d: Int) -> Date {
    var c = DateComponents()
    c.year = y; c.month = m; c.day = d
    c.timeZone = TimeZone(identifier: "UTC")
    return Calendar(identifier: .gregorian).date(from: c)!
}

let FY25 = FederalSnapshot(
    fiscalYear: 2025,
    effectiveStart: mkDate(2024, 10, 1),
    effectiveEnd:   mkDate(2025, 9, 30),
    fplAnnualFirstPerson: 15060,
    fplAnnualEachAdditional: 5380,
    maxAllotment: [1:292, 2:536, 3:768, 4:975, 5:1158, 6:1390, 7:1536, 8:1756],
    maxAllotmentEachAdditional: 220,
    standardDeduction: [1:204, 2:204, 3:204, 4:217, 5:254, 6:291],
    shelterCap: 712,
    minimumBenefit: 23,
    homelessDeduction: 179.66,
    assetLimitHousehold: 3000,
    assetLimitEd: 4500,
    earnedIncomeDeductionRate: 0.20,
    medicalFloor: 35
)

let FY26 = FederalSnapshot(
    fiscalYear: 2026,
    effectiveStart: mkDate(2025, 10, 1),
    effectiveEnd:   mkDate(2026, 9, 30),
    fplAnnualFirstPerson: 15660,
    fplAnnualEachAdditional: 5500,
    maxAllotment: [1:298, 2:546, 3:785, 4:994, 5:1183, 6:1421, 7:1571, 8:1789],
    maxAllotmentEachAdditional: 224,
    standardDeduction: [1:209, 2:209, 3:209, 4:223, 5:261, 6:299],
    shelterCap: 744,
    minimumBenefit: 24,
    homelessDeduction: 198.99,
    assetLimitHousehold: 3000,
    assetLimitEd: 4500,
    earnedIncomeDeductionRate: 0.20,
    medicalFloor: 35
)

let GROSS_INCOME_TEST_RATIO = 1.30
let NET_INCOME_TEST_RATIO = 1.00

let SNAPSHOTS = [FY25, FY26]

enum SnapshotError: Error { case noTableForDate(String) }

func snapshotFor(_ asOf: Date) throws -> FederalSnapshot {
    for s in SNAPSHOTS where asOf >= s.effectiveStart && asOf <= s.effectiveEnd {
        return s
    }
    throw SnapshotError.noTableForDate("\(asOf)")
}

func fplMonthly(size: Int, asOf: Date) throws -> Double {
    let s = try snapshotFor(asOf)
    precondition(size >= 1)
    let annual = s.fplAnnualFirstPerson + s.fplAnnualEachAdditional * Double(size - 1)
    return annual / 12.0
}

func standardDeductionFor(size: Int, asOf: Date) throws -> Double {
    let s = try snapshotFor(asOf)
    if size <= 3 { return s.standardDeduction[1]! }
    if size == 4 { return s.standardDeduction[4]! }
    if size == 5 { return s.standardDeduction[5]! }
    return s.standardDeduction[6]!
}

func maxAllotmentFor(size: Int, asOf: Date) throws -> Double {
    let s = try snapshotFor(asOf)
    precondition(size >= 1)
    if let v = s.maxAllotment[size] { return v }
    let largest = s.maxAllotment.keys.max()!
    if size > largest {
        return s.maxAllotment[largest]! + s.maxAllotmentEachAdditional * Double(size - largest)
    }
    fatalError("no max_allotment for size \(size)")
}

func assetLimitFor(isED: Bool, asOf: Date) throws -> Double {
    let s = try snapshotFor(asOf)
    return isED ? s.assetLimitEd : s.assetLimitHousehold
}

// ─── State policies ──────────────────────────────────────────────────────

enum BBCEFPLBasis: String { case federalFiscalYear, calendarYear, none }

struct StatePolicy {
    let stateCode: String
    let bbce: Bool
    let bbceThresholdPct: Double?
    let bbceFplBasis: BBCEFPLBasis
    let assetWaiver: Bool
    let suaByTier: [SUATier: Double]?    // nil = not authored
    let drugFelonyBan: Bool
    let abawdWaiverAvail: Bool
    let rmpOperated: Bool
}

let CA_POLICY = StatePolicy(
    stateCode: "CA",
    bbce: true,
    bbceThresholdPct: 200,
    bbceFplBasis: .federalFiscalYear,
    assetWaiver: true,
    suaByTier: [.HCSUA: 663, .LUA: 170, .phone: 20, .none: 0],
    drugFelonyBan: false,
    abawdWaiverAvail: true,
    rmpOperated: true
)

let MA_POLICY = StatePolicy(
    stateCode: "MA",
    bbce: true,
    bbceThresholdPct: 200,
    bbceFplBasis: .calendarYear,
    assetWaiver: true,
    suaByTier: [.HCSUA: 914, .LUA: 556, .phone: 64, .none: 0],
    drugFelonyBan: false,
    abawdWaiverAvail: true,
    rmpOperated: false
)

let TX_POLICY = StatePolicy(
    stateCode: "TX", bbce: true, bbceThresholdPct: 165, bbceFplBasis: .federalFiscalYear,
    assetWaiver: true, suaByTier: nil, drugFelonyBan: true,
    abawdWaiverAvail: false, rmpOperated: false
)
let KS_POLICY = StatePolicy(
    stateCode: "KS", bbce: false, bbceThresholdPct: nil, bbceFplBasis: .none,
    assetWaiver: false, suaByTier: nil, drugFelonyBan: false,
    abawdWaiverAvail: false, rmpOperated: false
)
let AK_POLICY = StatePolicy(
    stateCode: "AK", bbce: false, bbceThresholdPct: nil, bbceFplBasis: .none,
    assetWaiver: false, suaByTier: nil, drugFelonyBan: false,
    abawdWaiverAvail: true, rmpOperated: false
)

enum PolicyError: Error { case unknownState(String) }

func statePolicyFor(_ state: String) throws -> StatePolicy {
    switch state {
    case "CA": return CA_POLICY
    case "MA": return MA_POLICY
    case "TX": return TX_POLICY
    case "KS": return KS_POLICY
    case "AK": return AK_POLICY
    default: throw PolicyError.unknownState(state)
    }
}

// SNAP rounds half AWAY from zero (Python ROUND_HALF_UP, Swift
// .plain on positive values).
func roundDollar(_ v: Double) -> Double {
    let sign = v < 0 ? -1.0 : 1.0
    return sign * (abs(v)).rounded(.toNearestOrAwayFromZero)
}
