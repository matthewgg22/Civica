// CivicaTestProfile.swift
//
// Swift Codable adapter for the Civica SNAP test-profile suite
// (civica_test_profiles.json, schema v0.6+).
//
// Drop this file into any Swift target (test or app) that needs to load
// the profile suite. Decodes the canonical JSON shape into typed structs;
// consumers walk `Profile.expectedByState` for state-keyed assertions or
// `Profile.expected.variants` for A/B variant assertions.
//
// Wire-shape policy: this file is the canonical Swift decoder. Schema
// evolves => this file is the first thing to update. Consumers should
// import these types rather than re-derive their own decoders.

import Foundation

// MARK: - Top-level

public struct CivicaTestProfileSuite: Decodable {
    public let meta: Meta
    public let profiles: [Profile]

    /// Lookup by legacy_id (e.g. "A01", "M28"). Stable across schema versions.
    public var byLegacyID: [String: Profile] {
        Dictionary(uniqueKeysWithValues: profiles.map { ($0.legacyID, $0) })
    }

    /// Lookup by semantic id (e.g. "A01-single-mother-2-kids-low-wage").
    public var byID: [String: Profile] {
        Dictionary(uniqueKeysWithValues: profiles.map { ($0.id, $0) })
    }

    /// Convenience loader from a filesystem path; reads + decodes in one call.
    public static func load(from url: URL) throws -> CivicaTestProfileSuite {
        let data = try Data(contentsOf: url)
        return try JSONDecoder().decode(CivicaTestProfileSuite.self, from: data)
    }
}

// MARK: - Meta

public struct Meta: Decodable {
    public let version: String
    public let fy: String
    public let basis: String?
    public let count: Int
    public let defaultState: String
    public let states: [String: StateLib]
    public let params: Params
    public let tolerances: Tolerances
    public let howToUse: String?
    public let caveats: [String]?

    enum CodingKeys: String, CodingKey {
        case version, fy, basis, count, states, params, tolerances, caveats
        case defaultState = "default_state"
        case howToUse = "how_to_use"
    }
}

public struct StateLib: Decodable {
    public let label: String
    public let bbce: Bool
    public let bbceThreshold: Int?
    public let bbceFplBasis: String?  // "federal_fiscal_year" | "calendar_year" | null
    public let assetWaiver: Bool
    public let sua: String
    public let admin: String
    public let allotmentTier: String
    public let drugFelonyBan: Bool
    public let abawdWaiverAvail: Bool
    public let suaByTier: [String: Double]?  // null when SUA not authored for this state

    enum CodingKeys: String, CodingKey {
        case label, bbce, sua, admin
        case bbceThreshold = "bbce_threshold"
        case bbceFplBasis = "bbce_fpl_basis"
        case assetWaiver = "asset_waiver"
        case allotmentTier = "allotment_tier"
        case drugFelonyBan = "drug_felony_ban"
        case abawdWaiverAvail = "abawd_waiver_avail"
        case suaByTier = "sua_by_tier"
    }
}

public struct Params: Decodable {
    public let fy: String
    public let tolerance: Int
    public let sd: [String: Double]            // household size (str) -> standard deduction
    public let fpl: [String: Double]           // household size (str) -> 100% FPL monthly
    public let assetLimit: Double
    public let assetLimitEd: Double
    public let homelessDed: Double
    public let minBenefit: Double
    public let shelterCap: Double
    public let suaByState: [String: [String: Double]?]
    public let allotmentTables: [String: [String: Double]]?

    enum CodingKeys: String, CodingKey {
        case fy, tolerance, sd, fpl
        case assetLimit = "asset_limit"
        case assetLimitEd = "asset_limit_ed"
        case homelessDed = "homeless_ded"
        case minBenefit = "min_benefit"
        case shelterCap = "shelter_cap"
        case suaByState = "sua_by_state"
        case allotmentTables = "allotment_tables"
    }
}

public struct Tolerances: Decodable {
    public let verdict: String      // "exact_match"
    public let benefit: String      // "exact_match"
    public let qcThresholdDollars: Double?
    public let note: String?

    enum CodingKeys: String, CodingKey {
        case verdict, benefit, note
        case qcThresholdDollars = "snap_qc_payment_error_threshold_dollars"
    }
}

// MARK: - Profile

public struct Profile: Decodable {
    public let id: String
    public let legacyID: String
    public let label: String
    public let asOfDate: String?
    public let facts: Facts
    public let requires: [String]
    public let oracleBasis: String
    public let citation: String
    public let errorSurface: ErrorSurface
    public let negativeControl: Bool?
    public let mustReject: Bool?
    public let pairedWith: String?
    public let integrity: IntegrityBlock?

    public let expectedByState: [String: StateExpectation]?
    public let expected: VariantBlock?

    enum CodingKeys: String, CodingKey {
        case id, label, facts, requires, citation, integrity, expected
        case legacyID = "legacy_id"
        case asOfDate = "as_of_date"
        case oracleBasis = "oracle_basis"
        case errorSurface = "error_surface"
        case negativeControl = "negative_control"
        case mustReject = "must_reject"
        case pairedWith = "paired_with"
        case expectedByState = "expected_by_state"
    }

    /// Convenience accessor. Returns the expected verdict for `state`, or nil
    /// if this profile is variant-shaped (use `expected.variants` instead).
    public func expectedVerdict(in state: String) -> Verdict? {
        expectedByState?[state]?.verdict
    }

    /// Returns the expected benefit amount for `state` if both (a) the profile
    /// is state-shaped and (b) the state has an authored SUA. Otherwise nil —
    /// callers MUST NOT assert dollar amounts when this returns nil.
    public func expectedBenefit(in state: String) -> Double? {
        expectedByState?[state]?.benefit
    }
}

public enum Verdict: String, Decodable {
    case approve = "APPROVE"
    case deny = "DENY"
}

public struct StateExpectation: Decodable {
    public let verdict: Verdict
    public let eligible: Bool?
    public let benefit: Double?
}

public struct VariantBlock: Decodable {
    public let variants: [String: Variant]
}

public struct Variant: Decodable {
    public let factsPatch: [String: JSONValue]
    public let verdict: Verdict
    public let benefit: Double?
    public let note: String?

    enum CodingKeys: String, CodingKey {
        case verdict, benefit, note
        case factsPatch = "facts_patch"
    }
}

public struct ErrorSurface: Decodable {
    public let mode: String?     // "flip" | "amount"
    public let element: String?  // e.g. "311_wages", "363_shelter"
}

public struct IntegrityBlock: Decodable {
    public let qcShouldFlag: Bool
    public let errorElement: String?
    public let reason: String?
    /// Union-shaped: dict payload (e.g. `{"medical_unreimbursed": 300}`) for
    /// numeric-edit integrity tests; bare string (e.g. `"abawd_subject"`)
    /// for status-edit integrity tests. Same for `agencyKeyed`.
    public let correctInput: JSONValue?
    public let agencyKeyed: JSONValue?
    public let correctStatus: String?
    public let correctMethod: String?

    enum CodingKeys: String, CodingKey {
        case reason
        case qcShouldFlag = "qc_should_flag"
        case errorElement = "error_element"
        case correctInput = "correct_input"
        case agencyKeyed = "agency_keyed"
        case correctStatus = "correct_status"
        case correctMethod = "correct_method"
    }
}

// MARK: - Facts

public struct Facts: Decodable {
    public let household: [Member]
    public let income: [Income]
    public let shelter: Shelter
    public let deductions: Deductions
    public let assets: AssetsField
    public let catElig: String
    public let expedited: Bool?
    public let sponsorIncome: Double?

    enum CodingKeys: String, CodingKey {
        case household, income, shelter, deductions, assets, expedited
        case catElig = "cat_elig"
        case sponsorIncome = "sponsor_income"
    }
}

public struct Member: Decodable {
    public let memberID: String
    public let age: Int
    public let role: String
    public let disability: Bool?
    public let elderly: Bool?
    public let student: String?
    public let immigration: String?
    public let fiveYrBar: String?
    public let sponsored: Bool?
    public let workClass: String?
    public let abawdMonthsUsed: Int?
    public let disqual: [String]?
    public let living: String?

    enum CodingKeys: String, CodingKey {
        case age, role, disability, elderly, student, immigration, sponsored, disqual, living
        case memberID = "member_id"
        case fiveYrBar = "five_yr_bar"
        case workClass = "work_class"
        case abawdMonthsUsed = "abawd_months_used"
    }
}

public struct Income: Decodable {
    public let member: String
    public let type: String
    public let amount: Double
    public let freq: String?
    public let anticipation: String?
    public let sourceStatus: String?

    enum CodingKeys: String, CodingKey {
        case member, type, amount, freq, anticipation
        case sourceStatus = "source_status"
    }
}

public struct Shelter: Decodable {
    public let rent: Double
    public let suaTier: ProfileSUATier
    public let suaAmount: Double
    public let internet: Double?
    public let homelessDeduction: Bool?

    enum CodingKeys: String, CodingKey {
        case rent, internet
        case suaTier = "sua_tier"
        case suaAmount = "sua_amount"
        case homelessDeduction = "homeless_deduction"
    }
}

/// Profile-side SUA tier enum (HCSUA / LUA / phone / none) — distinct from
/// the engine's `Civica.SUATier` (heatingCooling / nonHeating / phoneOnly /
/// none) to avoid name collision when this adapter is imported into a
/// target that also imports the engine.
public enum ProfileSUATier: String, Decodable {
    case hcsua = "HCSUA"
    case lua = "LUA"
    case phone
    case none
}

public struct Deductions: Decodable {
    public let dependentCare: Double?
    public let medicalUnreimbursed: Double?
    public let childSupportPaid: Double?

    enum CodingKeys: String, CodingKey {
        case dependentCare = "dependent_care"
        case medicalUnreimbursed = "medical_unreimbursed"
        case childSupportPaid = "child_support_paid"
    }
}

/// `assets` decodes as either a Double or one of the sentinel strings
/// `"n/a:categorical_no_asset_test"` / `"n/a:not_authored"`.
public enum AssetsField: Decodable {
    case amount(Double)
    case categoricalNoAssetTest
    case notAuthored

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let d = try? container.decode(Double.self) {
            self = .amount(d); return
        }
        let s = try container.decode(String.self)
        switch s {
        case "n/a:categorical_no_asset_test": self = .categoricalNoAssetTest
        case "n/a:not_authored": self = .notAuthored
        default: self = .notAuthored
        }
    }
}

// MARK: - JSONValue (untyped pass-through for facts_patch + integrity payloads)

/// Minimal type-erased JSON value for fields whose shape varies by profile
/// (`facts_patch`, `correct_input`, `agency_keyed`). Use `.stringValue`,
/// `.doubleValue`, `.boolValue` to extract primitives; `.dictValue` /
/// `.arrayValue` for containers.
public indirect enum JSONValue: Decodable {
    case string(String)
    case double(Double)
    case bool(Bool)
    case null
    case array([JSONValue])
    case object([String: JSONValue])

    public init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if c.decodeNil() { self = .null; return }
        if let b = try? c.decode(Bool.self) { self = .bool(b); return }
        if let d = try? c.decode(Double.self) { self = .double(d); return }
        if let s = try? c.decode(String.self) { self = .string(s); return }
        if let a = try? c.decode([JSONValue].self) { self = .array(a); return }
        if let o = try? c.decode([String: JSONValue].self) { self = .object(o); return }
        self = .null
    }

    public var stringValue: String? { if case .string(let s) = self { return s }; return nil }
    public var doubleValue: Double? { if case .double(let d) = self { return d }; return nil }
    public var boolValue: Bool? { if case .bool(let b) = self { return b }; return nil }
    public var dictValue: [String: JSONValue]? { if case .object(let o) = self { return o }; return nil }
    public var arrayValue: [JSONValue]? { if case .array(let a) = self { return a }; return nil }
}
